"""
rpy2-specific tests for ``r_engine.run_seirdv``.

These directly target the rpy2 backend (regardless of the
``WBEPI_ENGINE`` env var) to verify behaviours that are unique to the
R-via-rpy2 path: cold-start, error translation, column-name
preservation through the R↔pandas round-trip, determinism.

Each test imports ``r_engine`` lazily so the suite still works on
machines without R installed (those tests skip cleanly).
"""

from __future__ import annotations

import time

import numpy as np
import pytest

# Skip the whole module if R / rpy2 / wbepi are not available.
rpy2 = pytest.importorskip("rpy2.robjects")

try:
    if not bool(rpy2.r('"wbepi" %in% rownames(installed.packages())')[0]):
        pytest.skip("wbepi R package not installed", allow_module_level=True)
except Exception as _exc:
    pytest.skip(f"R/rpy2 not reachable: {_exc}", allow_module_level=True)


# Module under test (imported only after the skip check above).
from predictions.scenarios.wbepi_engine import r_engine


# ─── Health check + diagnostics ─────────────────────────────────


def test_health_check_returns_valid_versions():
    h = r_engine.health_check()
    assert "r_version" in h and "wbepi_version" in h
    assert h["r_version"].startswith("R version")
    # wbepi version is a dotted release like "0.1.0.999"
    assert h["wbepi_version"].count(".") >= 2


def test_get_active_engine_returns_python_or_r():
    """The package-level ``get_active_engine`` reports the env-var choice."""
    from predictions.scenarios.wbepi_engine import get_active_engine
    assert get_active_engine() in ("python", "r")


# ─── Output schema preserved through R ↔ pandas round-trip ──────


def test_column_names_preserve_r_style_brackets():
    df = r_engine.run_seirdv(
        n_populations=3, ini_S=[100, 200, 300], ini_I=[1, 0, 0],
        beta=0.3, sigma=0.2, gamma=0.1, mu=0.01,
        time=5, n_sims=2, rng=np.random.default_rng(0),
    )
    expected = ["sim", "step"]
    for prefix in ("S", "E", "I", "R", "D", "V"):
        expected.extend(f"{prefix}[{j}]" for j in (1, 2, 3))
    expected.extend(f"status[{j}]" for j in (1, 2, 3))
    assert list(df.columns) == expected


def test_dtypes_all_int64():
    """rpy2 sometimes returns int32; we must coerce everything to int64."""
    df = r_engine.run_seirdv(
        n_populations=1, ini_S=100, ini_I=1, beta=0.3, sigma=0.2, gamma=0.1,
        time=5, n_sims=1, rng=np.random.default_rng(0),
    )
    assert (df.dtypes == np.int64).all(), df.dtypes


def test_row_count_n_sims_times_time():
    df = r_engine.run_seirdv(
        n_populations=1, ini_S=100, ini_I=1, beta=0.3, sigma=0.2, gamma=0.1,
        time=20, n_sims=4, rng=np.random.default_rng(0),
    )
    assert df.shape[0] == 4 * 20


def test_status_column_is_zero_or_one():
    df = r_engine.run_seirdv(
        n_populations=1, ini_S=100, ini_I=1, beta=0.3, sigma=0.2, gamma=0.1,
        interv_delay=2, time=15, n_sims=3, rng=np.random.default_rng(0),
    )
    assert set(df["status[1]"].unique()) <= {0, 1}


# ─── Determinism / reproducibility ──────────────────────────────


def test_same_seed_produces_identical_output():
    kw = dict(n_populations=1, ini_S=100, ini_I=1, beta=0.3, sigma=0.2,
              gamma=0.1, time=10, n_sims=3)
    df1 = r_engine.run_seirdv(**kw, rng=np.random.default_rng(7))
    df2 = r_engine.run_seirdv(**kw, rng=np.random.default_rng(7))
    assert df1.equals(df2)


def test_different_seeds_diverge():
    kw = dict(n_populations=1, ini_S=1000, ini_I=10, beta=0.3, sigma=0.2,
              gamma=0.1, time=20, n_sims=5)
    df1 = r_engine.run_seirdv(**kw, rng=np.random.default_rng(1))
    df2 = r_engine.run_seirdv(**kw, rng=np.random.default_rng(2))
    assert not df1.equals(df2)


# ─── Conservation invariant ─────────────────────────────────────


def test_population_conservation_per_sim_per_pop():
    df = r_engine.run_seirdv(
        n_populations=2, ini_S=[1000, 500], ini_I=[10, 0], ini_E=[1, 0],
        beta=0.3, sigma=0.2, gamma=0.1, mu=0.05,
        time=30, n_sims=3, diffusion=0.1, rng=np.random.default_rng(0),
    )
    for sim_id in df["sim"].unique():
        sub = df[df["sim"] == sim_id]
        for j in (1, 2):
            totals = sum(sub[f"{c}[{j}]"] for c in "SEIRDV")
            assert (totals == totals.iloc[0]).all(), (
                f"population not conserved in sim {sim_id} pop {j}"
            )


# ─── Error translation ──────────────────────────────────────────


def test_invalid_n_populations_raises_value_error():
    with pytest.raises(ValueError, match="n_populations"):
        r_engine.run_seirdv(n_populations=0)


def test_invalid_interv_vacc_type_raises_before_r():
    with pytest.raises(ValueError, match="interv_vacc_type"):
        r_engine.run_seirdv(n_populations=1, interv_vacc_type=3)


def test_delta_with_diffusion_rejected():
    delta = np.eye(2)
    with pytest.raises(ValueError, match="'delta' or 'diffusion'"):
        r_engine.run_seirdv(n_populations=2, delta=delta, diffusion=0.1)


def test_r_runtime_error_translated_to_value_error():
    """A delta matrix of the wrong shape triggers an R-side error
    inside ``process_delta``. We must surface this as a Python
    ValueError carrying the original R message."""
    delta = np.eye(3)  # but n_populations=2
    with pytest.raises(ValueError) as excinfo:
        r_engine.run_seirdv(
            n_populations=2, delta=delta, ini_S=[100, 100],
            beta=0.3, sigma=0.2, gamma=0.1, time=5,
        )
    msg = str(excinfo.value)
    assert "wbepi::run_seirdv" in msg
    assert "process_delta" in msg or "n_populations" in msg


# ─── Cold-start vs warm-call latency ────────────────────────────


def test_warm_call_is_fast(rng):
    """After R is loaded, a small simulation completes in well under a second.

    The first call after import pays the R-init cost (~1-3s); we trigger
    it via ``health_check`` before measuring. Subsequent calls should
    be fast.
    """
    r_engine.health_check()  # ensure R is loaded

    kw = dict(n_populations=1, ini_S=100, ini_I=1, beta=0.3, sigma=0.2,
              gamma=0.1, time=5, n_sims=1)
    # Warm-up call (in case the very first call after import is slower)
    r_engine.run_seirdv(**kw, rng=rng)

    t0 = time.perf_counter()
    r_engine.run_seirdv(**kw, rng=rng)
    elapsed = time.perf_counter() - t0
    # Generous bound — Macs and CI runners differ. Failing this means
    # something pathological is happening (e.g. R is being re-loaded).
    assert elapsed < 1.5, f"warm rpy2 call took {elapsed:.2f}s"


# ─── Engine sanity check ────────────────────────────────────────


def test_engine_is_r():
    """The package-level ``run_seirdv`` must come from ``r_engine``."""
    import predictions.scenarios.wbepi_engine as pkg
    assert pkg.get_active_engine() == "r"
    assert pkg.run_seirdv.__module__ == "predictions.scenarios.wbepi_engine.r_engine"
