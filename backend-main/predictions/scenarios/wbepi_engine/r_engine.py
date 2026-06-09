"""
rpy2-backed implementation of ``run_seirdv``.

Drop-in replacement for ``runner.run_seirdv`` (the pure-Python port).
Same signature, same DataFrame output shape, same R-style 1-indexed
column names. Internally calls the upstream R ``wbepi`` package via
rpy2 instead of executing the model in Python.

Why this exists
---------------
The PDX team has decided to use the canonical R implementation as
the source of truth rather than maintain a parallel Python port.
This module is the bridge — it accepts ordinary Python kwargs,
converts them to R types, calls ``wbepi::run_seirdv``, and converts
the resulting R data.frame to a pandas DataFrame.

Architectural constraints
-------------------------
* **Lazy initialisation.** The R interpreter is loaded on the *first*
  call into ``run_seirdv`` rather than at module import time.
  Reason: Celery prefork workers cannot inherit an already-loaded R
  interpreter without segfaulting on the first R call inside the
  child. By deferring init until the first task body runs, we
  guarantee R initialises post-fork.
* **Single-process R.** R itself is single-threaded per process and
  rpy2 holds the GIL during R calls. Throughput scales with worker
  *processes*, not threads. Set Celery worker concurrency to 1 per
  process (see ``wbepi-rpy2/risks.md`` R-2).
* **Memory.** R does not aggressively release memory. Long-lived
  workers should be recycled (see Celery
  ``worker_max_tasks_per_child``). This module calls R's ``gc()``
  and Python's ``gc.collect()`` after each run as a small mitigation.

Seed / RNG handling
-------------------
The Python signature accepts ``rng: np.random.Generator``. R does not
share NumPy's RNG — it has its own Mersenne-Twister stream. To
preserve reproducibility:

* If ``rng`` is provided, we draw a 32-bit integer from it and pass
  to ``set.seed(...)`` in R. Same NumPy seed → same R seed → same
  R output (across runs of *this* function), even though the
  individual stochastic draws are not byte-identical to the Python
  port (which uses NumPy's PCG64 stream).
* If ``rng`` is omitted, R uses its own auto-seeded RNG.

Note: The Python port and the rpy2 path produce **statistically
equivalent** but **not byte-identical** outputs even with the same
seed input. This is the same situation the existing Tier-2
distributional tests already accept.

Public API
----------
``run_seirdv(**kwargs) -> pandas.DataFrame``

Plus diagnostics:
- ``health_check()`` returns the loaded R + wbepi versions.
- ``r_session_info()`` returns the result of R's ``sessionInfo()``.
- ``get_worker_rss_mb()`` returns the current process RSS in MB.
"""

from __future__ import annotations

import gc
import logging
import os
import resource
import threading
from collections.abc import Sequence

import numpy as np
import pandas as pd


# ─── Loggers ────────────────────────────────────────────────────

_log = logging.getLogger("wbepi")
_log_r = logging.getLogger("wbepi.r")


# ─── Lazy R initialisation ──────────────────────────────────────


_R_LOADED = False
_R_LOAD_LOCK = threading.Lock()
_WBEPI_RUN_SEIRDV = None  # populated on first init; set to ro.r['run_seirdv']
_WBEPI_VERSION: str | None = None
_R_VERSION: str | None = None


def _install_r_log_callbacks() -> None:
    """Route R's stdout / stderr / warnings through Python logging.

    Called once at R init time.  This replaces rpy2's default print-to-
    sys.stdout behaviour with structured log lines under the ``wbepi.r``
    logger.  Workers can then capture R output in Celery's log stream
    alongside Python tracebacks.

    Sprint R4 deliverable: "R warnings should appear in the Celery
    worker log alongside Python tracebacks."
    """
    import rpy2.rinterface_lib.callbacks as rcb

    def _r_write_console(text: str, console_type: int = 0) -> None:
        """Callback for R console output.

        console_type: 0 = stdout, 1 = stderr (R error/warning).
        """
        text = text.rstrip("\n")
        if not text:
            return
        if console_type == 1:
            _log_r.warning("[R stderr] %s", text)
        else:
            _log_r.info("[R stdout] %s", text)

    rcb.consolewrite_print = _r_write_console
    rcb.consolewrite_warnerror = lambda text: _r_write_console(text, 1)


def _ensure_r_loaded() -> None:
    """Load ``library(wbepi)`` exactly once per Python process.

    Idempotent and thread-safe. Raises ``RuntimeError`` with a useful
    diagnostic if the R package is missing or rpy2 cannot reach R.

    This must be called from inside the *worker* process, not the
    Django/Gunicorn parent (see module docstring).
    """
    global _R_LOADED, _WBEPI_RUN_SEIRDV, _WBEPI_VERSION, _R_VERSION

    if _R_LOADED:
        return

    with _R_LOAD_LOCK:
        if _R_LOADED:
            return

        try:
            import rpy2.robjects as ro  # imported lazily
        except ImportError as exc:
            raise RuntimeError(
                "rpy2 is not installed. Run wbepi-rpy2/setup_r_env.sh "
                "to bootstrap the environment."
            ) from exc

        try:
            installed = bool(
                ro.r('"wbepi" %in% rownames(installed.packages())')[0]
            )
        except Exception as exc:  # noqa: BLE001 — rpy2 R<->Python bridge raises arbitrary errors; rewrapped as RuntimeError
            raise RuntimeError(
                f"rpy2 cannot reach R: {exc}. Likely a stale wheel — "
                "rebuild rpy2 from source against the system R "
                "(see wbepi-rpy2/setup_r_env.sh)."
            ) from exc

        if not installed:
            raise RuntimeError(
                "wbepi R package is not installed in R's library. "
                "Run wbepi-rpy2/setup_r_env.sh."
            )

        # Install logging callbacks BEFORE loading wbepi so any R
        # startup messages are captured.
        _install_r_log_callbacks()

        ro.r("library(wbepi)")
        _WBEPI_RUN_SEIRDV = ro.r["run_seirdv"]
        _WBEPI_VERSION = ro.r('as.character(packageVersion("wbepi"))')[0]
        _R_VERSION = ro.r("R.version.string")[0]
        _R_LOADED = True

        _log.info(
            "R engine initialised: R %s, wbepi %s, PID %d",
            _R_VERSION, _WBEPI_VERSION, os.getpid(),
        )


def health_check() -> dict[str, str]:
    """Return a small diagnostic dict, loading R lazily if needed.

    Wrapped in a localconverter so calls from a fresh thread (one that
    has never seen rpy2's conversion rules) succeed.
    """
    from rpy2.robjects import conversion, default_converter
    with conversion.localconverter(default_converter):
        _ensure_r_loaded()
        return {
            "r_version": _R_VERSION or "",
            "wbepi_version": _WBEPI_VERSION or "",
        }


def r_session_info() -> str:
    """Return the result of R's ``sessionInfo()`` as a string."""
    import rpy2.robjects as ro
    from rpy2.robjects import conversion, default_converter
    with conversion.localconverter(default_converter):
        _ensure_r_loaded()
        return "\n".join(ro.r("capture.output(sessionInfo())"))


def get_worker_rss_mb() -> float:
    """Return the current process RSS in megabytes.

    Uses getrusage, available on macOS and Linux.  Returns -1 if
    unavailable.  Useful for monitoring R memory growth across tasks
    (Sprint R4 risk R-1).
    """
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        # macOS: ru_maxrss in bytes.  Linux: in kilobytes.
        import sys
        if sys.platform == "darwin":
            return usage.ru_maxrss / (1024 * 1024)
        else:
            return usage.ru_maxrss / 1024
    except (ImportError, AttributeError, OSError):
        return -1.0


# ─── Argument conversion ────────────────────────────────────────


def _to_int_vector(value: Sequence[int] | int | float | np.ndarray):
    """Python scalar/sequence → R IntVector."""
    import rpy2.robjects as ro
    if np.isscalar(value):
        return ro.IntVector([int(value)])
    arr = np.asarray(value)
    if arr.ndim != 1:
        raise ValueError(f"expected 1-D, got shape {arr.shape}")
    return ro.IntVector([int(v) for v in arr.tolist()])


def _to_r_matrix(arr: np.ndarray):
    """2-D ndarray → R numeric matrix with the same shape."""
    import rpy2.robjects as ro
    if arr.ndim != 2:
        raise ValueError(f"delta must be 2-D, got shape {arr.shape}")
    rows, cols = arr.shape
    flat = arr.flatten(order="F")  # R is column-major
    vec = ro.FloatVector([float(v) for v in flat.tolist()])
    return ro.r["matrix"](vec, nrow=rows, ncol=cols)


def _resolve_seed_for_r(rng: np.random.Generator | None) -> int | None:
    """Derive a 32-bit integer seed from a NumPy ``Generator``.

    Returns None when ``rng`` is None — caller will skip ``set.seed``
    and let R use its own auto-seed.
    """
    if rng is None:
        return None
    return int(rng.integers(0, 2**31 - 1))


# ─── Output conversion ──────────────────────────────────────────


def _rdf_to_pandas(rdf, expected_columns: list[str]) -> pd.DataFrame:
    """R data.frame → pandas DataFrame with R-style column names.

    rpy2's pandas converter sometimes mangles non-syntactic R column
    names (the bracketed ``S[1]`` columns) into ``S.1.`` etc. We bypass
    that by reading column names from R explicitly and copying values
    column-by-column.
    """
    import rpy2.robjects as ro
    columns = list(ro.r("names")(rdf))
    if columns != expected_columns:
        raise RuntimeError(
            "R returned unexpected columns. "
            f"got {columns!r}, expected {expected_columns!r}"
        )
    out: dict[str, np.ndarray] = {}
    for i, name in enumerate(columns):
        # ``rdf[i]`` is the i-th column as an R vector
        rcol = rdf[i]
        out[name] = np.asarray(list(rcol), dtype=np.int64)
    return pd.DataFrame(out, columns=columns)


def _expected_columns(n_populations: int) -> list[str]:
    """The 2 + 7·n column ordering R produces."""
    cols = ["sim", "step"]
    for prefix in ("S", "E", "I", "R", "D", "V"):
        cols.extend(f"{prefix}[{j}]" for j in range(1, n_populations + 1))
    cols.extend(f"status[{j}]" for j in range(1, n_populations + 1))
    return cols


# ─── Public entry point ─────────────────────────────────────────


def run_seirdv(
    *,
    n_populations: int = 1,
    ini_S: Sequence[int] | int = 0,
    ini_I: Sequence[int] | int = 0,
    ini_E: Sequence[int] | int = 0,
    ini_R: Sequence[int] | int = 0,
    ini_D: Sequence[int] | int = 0,
    ini_V: Sequence[int] | int = 0,
    beta: float = 0.0,
    sigma: float = 0.0,
    gamma: float = 0.0,
    mu: float = 0.0,
    vacc_coverage: float = 0.0,
    vacc_efficacy: float = 0.0,
    interv_delay: int | float = 1e30,
    interv_efficacy: float = 0.0,
    interv_vacc_type: int = 1,
    interv_vacc_coverage: float = 0.0,
    target_size: float = 0.0,
    interv_release: int = 21,
    time: int = 1,
    diffusion: float = 0.0,
    delta: np.ndarray | None = None,
    n_sims: int = 1,
    rng: np.random.Generator | None = None,
) -> pd.DataFrame:
    """Run a stochastic SEIRDV simulation via the upstream R ``wbepi`` package.

    Drop-in replacement for ``predictions.scenarios.wbepi_engine.run_seirdv``
    (the pure-Python port). See module docstring for differences in
    seed handling and concurrency.

    Returns a pandas DataFrame with ``2 + 7·n_populations`` columns and
    ``n_sims · time`` rows, ordered ``(sim, step)``. Column names use
    R-style 1-indexed brackets: ``S[1]``, ``E[1]``, …, ``status[n]``.
    """
    if not isinstance(n_populations, int) or n_populations < 1:
        raise ValueError(
            f"n_populations must be a positive int, got {n_populations!r}"
        )
    if not isinstance(time, int) or time < 1:
        raise ValueError(f"time must be a positive int, got {time!r}")
    if not isinstance(n_sims, int) or n_sims < 1:
        raise ValueError(f"n_sims must be a positive int, got {n_sims!r}")
    if interv_vacc_type not in (1, 2):
        raise ValueError(
            f"interv_vacc_type must be 1 or 2, got {interv_vacc_type!r}"
        )
    if delta is not None and diffusion != 0.0:
        raise ValueError("Provide either 'delta' or 'diffusion', not both.")

    import rpy2.robjects as ro
    from rpy2.rinterface_lib.embedded import RRuntimeError
    from rpy2.robjects import conversion, default_converter

    # IMPORTANT: enter the converter context BEFORE any rpy2 work, including
    # ``_ensure_r_loaded`` (which itself calls ``ro.r(...)``). When run_seirdv
    # is invoked from a freshly-spawned thread (e.g. Django's threaded dev
    # server, or a Celery thread pool), the thread's contextvars do not
    # carry the rpy2 converter from the thread that initialised R. Without
    # the wrap below those threads error with
    # "Conversion rules for ``rpy2.robjects`` appear to be missing".
    with conversion.localconverter(default_converter):
        _ensure_r_loaded()

        # Look up the R function fresh inside the active converter context.
        # The cached ``_WBEPI_RUN_SEIRDV`` proxy is bound to the thread that
        # first initialised R, so reusing it across threads can mis-dispatch
        # conversion. Looking up in-scope is cheap and safe.
        wbepi_run_seirdv = ro.r["run_seirdv"]

        seed_int = _resolve_seed_for_r(rng)
        if seed_int is not None:
            ro.r("set.seed")(seed_int)

        # Build the kwargs dict for the R call.
        rkwargs: dict[str, object] = {
            "n_populations": int(n_populations),
            "ini_S": _to_int_vector(ini_S),
            "ini_E": _to_int_vector(ini_E),
            "ini_I": _to_int_vector(ini_I),
            "ini_R": _to_int_vector(ini_R),
            "ini_D": _to_int_vector(ini_D),
            "ini_V": _to_int_vector(ini_V),
            "beta": float(beta),
            "sigma": float(sigma),
            "gamma": float(gamma),
            "mu": float(mu),
            "vacc_coverage": float(vacc_coverage),
            "vacc_efficacy": float(vacc_efficacy),
            "interv_delay": float(interv_delay),
            "interv_efficacy": float(interv_efficacy),
            "interv_vacc_type": int(interv_vacc_type),
            "interv_vacc_coverage": float(interv_vacc_coverage),
            "target_size": float(target_size),
            "interv_release": int(interv_release),
            "time": int(time),
            "diffusion": float(diffusion),
            "n_sims": int(n_sims),
        }
        if delta is not None:
            rkwargs["delta"] = _to_r_matrix(np.asarray(delta, dtype=float))

        rss_before = get_worker_rss_mb()

        try:
            rdf = wbepi_run_seirdv(**rkwargs)
        except RRuntimeError as exc:
            # Surface R's complaint to the caller as a clean Python error.
            raise ValueError(
                f"wbepi::run_seirdv rejected the parameters: {exc}"
            ) from exc

        df = _rdf_to_pandas(rdf, expected_columns=_expected_columns(n_populations))

        # ── Post-run cleanup (Sprint R4 risk R-1) ───────────────────
        # Periodic gc inside R to keep RSS bounded across many calls.
        ro.r("gc")(verbose=False)
        # Also nudge Python's gc — rpy2 proxy objects sometimes linger.
        gc.collect()

        rss_after = get_worker_rss_mb()
        if rss_before > 0 and rss_after > 0:
            _log.debug(
                "RSS: %.1f MB → %.1f MB (Δ%.1f MB) after %d sims × %d steps",
                rss_before, rss_after, rss_after - rss_before,
                n_sims, time,
            )

        return df
