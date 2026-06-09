"""
Tier 2 — Distributional parity tests.

These compare the Python port's output distribution (over 1000 sims) against
the R reference ``toy_data.xlsx`` (10 sims).  Because R and NumPy use
different RNG streams, parity is statistical, not exact.

Marked ``@pytest.mark.slow`` — run with ``pytest -m slow``.
Maps to ``validation.md`` §Tier 2.
"""

import numpy as np
import pandas as pd
import pytest

from predictions.scenarios.wbepi_engine import run_seirdv

# Reference parameters from _r_reference/run.R
REF_PARAMS = dict(
    n_populations=4,
    ini_S=[1000, 3000, 12000, 2000],
    ini_I=[10, 0, 0, 1],
    ini_E=0,
    ini_R=0,
    ini_D=0,
    ini_V=0,
    beta=0.2,
    sigma=1 / 7,
    gamma=1 / 14,
    mu=0.3,
    interv_delay=10,
    interv_efficacy=0.25,
    interv_vacc_type=2,
    target_size=200,
    interv_release=28,
    time=365,
    diffusion=0.1,
)


def _load_r_ref(path) -> pd.DataFrame:
    """Load the R reference xlsx and ensure int dtypes."""
    df = pd.read_excel(path)
    # The R output may have float columns from xlsx; coerce to int
    for col in df.columns:
        if col not in ("sim", "step"):
            df[col] = df[col].astype(np.int64)
    df["sim"] = df["sim"].astype(np.int64)
    df["step"] = df["step"].astype(np.int64)
    return df


@pytest.mark.slow
class TestFinalStepMeans:
    """T2.1: Final-step compartment means within 5% relative or ±5 absolute."""

    def test_final_means(self, toy_data_path):
        r_df = _load_r_ref(toy_data_path)

        py_df = run_seirdv(**REF_PARAMS, n_sims=1000, rng=np.random.default_rng(1))

        r_final = r_df[r_df["step"] == 365]
        py_final = py_df[py_df["step"] == 365]

        compartments = ["S", "E", "I", "R", "D", "V"]
        for comp in compartments:
            for p in range(1, 5):
                col = f"{comp}[{p}]"
                r_mean = r_final[col].mean()
                py_mean = py_final[col].mean()

                abs_err = abs(py_mean - r_mean)
                rel_err = abs_err / max(abs(r_mean), 1e-10)

                assert rel_err <= 0.05 or abs_err <= 5, (
                    f"{col}: py_mean={py_mean:.2f} r_mean={r_mean:.2f} "
                    f"rel_err={rel_err:.4f} abs_err={abs_err:.2f}"
                )


@pytest.mark.slow
class TestTimeToPeak:
    """T2.2: Median peak-I time within the R reference's own estimation noise.

    Tolerance is adaptive: ``max(3, 2 × SE(R median))`` where
    ``SE(median) ≈ 1.253 × σ_R / sqrt(n_R)``. With the shipped 10-sim R
    toy dataset, the small-n SE on the R median is significant (≈3-9
    days depending on population). Hard-coding ±3 days produces false
    failures on the smallest-seed population where R's own median is
    only locally identified. When a 1000-sim R reference is generated
    (see ``validation.md``), the tolerance auto-tightens toward the
    floor of 3.
    """

    def test_peak_time(self, toy_data_path):
        r_df = _load_r_ref(toy_data_path)
        py_df = run_seirdv(**REF_PARAMS, n_sims=1000, rng=np.random.default_rng(2))

        for p in range(1, 5):
            col = f"I[{p}]"

            # R peak times
            r_peaks = r_df.groupby("sim")[col].apply(lambda s: s.idxmax())
            r_peak_steps = r_df.loc[r_peaks.values, "step"].values
            r_median = np.median(r_peak_steps)
            r_std = np.std(r_peak_steps, ddof=1)
            r_n = len(r_peak_steps)

            # Py peak times — Py has 1000 sims so its SE is negligible
            # relative to R's, so the comparison's noise is dominated by
            # R's median SE.
            py_peaks = py_df.groupby("sim")[col].apply(lambda s: s.idxmax())
            py_peak_steps = py_df.loc[py_peaks.values, "step"].values
            py_median = np.median(py_peak_steps)

            # SE of sample median ≈ 1.253 σ / sqrt(n). Use 2× as a
            # ~95% buffer; floor at 3 days for tight pops.
            r_se_median = 1.253 * r_std / np.sqrt(r_n)
            tol = max(3.0, 2.0 * r_se_median)

            assert abs(py_median - r_median) <= tol, (
                f"Pop {p}: py_median_peak={py_median} r_median_peak={r_median} "
                f"diff={abs(py_median - r_median):.1f} > tol={tol:.1f} days "
                f"(R n={r_n}, R σ={r_std:.1f})"
            )


@pytest.mark.slow
class TestFinalAttackRate:
    """T2.3: Final attack rate median within ±0.05."""

    def test_attack_rate(self, toy_data_path):
        r_df = _load_r_ref(toy_data_path)
        py_df = run_seirdv(**REF_PARAMS, n_sims=1000, rng=np.random.default_rng(3))

        ini_living = np.array([1000, 3000, 12000, 2000]) + np.array([10, 0, 0, 1])

        for p in range(1, 5):
            r_final = r_df[r_df["step"] == 365]
            py_final = py_df[py_df["step"] == 365]

            r_ar = (r_final[f"R[{p}]"] + r_final[f"D[{p}]"]) / ini_living[p - 1]
            py_ar = (py_final[f"R[{p}]"] + py_final[f"D[{p}]"]) / ini_living[p - 1]

            assert abs(py_ar.median() - r_ar.median()) <= 0.05, (
                f"Pop {p}: py_median_AR={py_ar.median():.4f} "
                f"r_median_AR={r_ar.median():.4f}"
            )


@pytest.mark.slow
class TestResponseActivationStep:
    """T2.4: Median response activation step within ±2 days."""

    def test_activation_step(self, toy_data_path):
        r_df = _load_r_ref(toy_data_path)
        py_df = run_seirdv(**REF_PARAMS, n_sims=1000, rng=np.random.default_rng(4))

        for p in range(1, 5):
            col = f"status[{p}]"

            def _first_active(group):
                active = group[group[col] == 1]
                return active["step"].min() if len(active) > 0 else np.nan

            r_act = r_df.groupby("sim").apply(_first_active).dropna()
            py_act = py_df.groupby("sim").apply(_first_active).dropna()

            if len(r_act) == 0 and len(py_act) == 0:
                continue  # Neither had response activation

            r_med = r_act.median()
            py_med = py_act.median()
            assert abs(py_med - r_med) <= 2, (
                f"Pop {p}: py_median_act={py_med} r_median_act={r_med}"
            )


@pytest.mark.slow
class TestTotalDeaths:
    """T2.5: Total deaths median within ±10%."""

    def test_total_deaths(self, toy_data_path):
        r_df = _load_r_ref(toy_data_path)
        py_df = run_seirdv(**REF_PARAMS, n_sims=1000, rng=np.random.default_rng(5))

        d_cols = [f"D[{p}]" for p in range(1, 5)]

        r_final = r_df[r_df["step"] == 365]
        py_final = py_df[py_df["step"] == 365]

        r_total_d = r_final[d_cols].sum(axis=1)
        py_total_d = py_final[d_cols].sum(axis=1)

        r_med = r_total_d.median()
        py_med = py_total_d.median()

        rel_err = abs(py_med - r_med) / max(abs(r_med), 1)
        assert rel_err <= 0.10, (
            f"Total deaths: py_median={py_med:.1f} r_median={r_med:.1f} "
            f"rel_err={rel_err:.4f}"
        )
