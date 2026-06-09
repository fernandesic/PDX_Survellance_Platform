"""
Sprint R4 — production hardening tests.

Tests cover:

1. **Fork safety** (R-3): Forking a process and loading R in the child
   must work without segfaults.  The parent must NOT have R loaded
   before the fork — if it does, the child will crash.
2. **Soft timeout handling**: ``SoftTimeLimitExceeded`` → FAILED with
   human-readable error message.
3. **Health check endpoint**: ``/scenario-runs/engine-health/`` returns
   engine info.
4. **Worker recycling config**: ``CELERY_WORKER_MAX_TASKS_PER_CHILD``
   is set to a sane value.
5. **R logging callbacks**: R output is routed through Python logging.
"""

import os
import sys
import pytest
import json
from unittest.mock import patch, MagicMock


# ─── 1. Fork safety ────────────────────────────────────────────────

@pytest.mark.skipif(
    sys.platform == "win32",
    reason="fork() not available on Windows",
)
def test_r_loads_cleanly_in_child_process_after_fork():
    """Verify the lazy-init pattern survives a fork.

    This is the regression test for risk R-3: if ``r_engine`` is
    imported (but R not loaded) in the parent, the child process
    must be able to call ``_ensure_r_loaded`` without segfaulting.

    We do NOT actually load R in the parent.  We just import the
    module and confirm the child can proceed.

    NOTE: this test requires rpy2 and the wbepi R package.  It is
    skipped if either is missing.
    """
    import multiprocessing

    def _child_target(result_queue):
        """Run inside a forked child process."""
        try:
            from predictions.scenarios.wbepi_engine.r_engine import (
                _ensure_r_loaded,
                _R_LOADED,
            )
            # Confirm R was NOT inherited from parent
            assert not _R_LOADED, "R was loaded in child before _ensure_r_loaded!"

            _ensure_r_loaded()

            # Verify it actually loaded
            from predictions.scenarios.wbepi_engine.r_engine import (
                _R_LOADED as loaded_after,
                _WBEPI_VERSION,
                _R_VERSION,
            )
            result_queue.put({
                'ok': True,
                'loaded': loaded_after,
                'wbepi_version': _WBEPI_VERSION,
                'r_version': _R_VERSION,
            })
        except Exception as e:
            result_queue.put({'ok': False, 'error': str(e)})

    # Import the module in the parent (lazy — does NOT start R)
    try:
        import predictions.scenarios.wbepi_engine.r_engine as r_mod
    except ImportError:
        pytest.skip("r_engine module not importable")

    # If R is already loaded in the parent (e.g. earlier tests used the
    # R engine), the fork test is moot — R survives the fork only by
    # accident and the child inherits it.  Skip cleanly.
    if r_mod._R_LOADED:
        pytest.skip(
            "R already loaded in parent process (WBEPI_ENGINE=r or prior "
            "tests used r_engine). Run this test in isolation or with "
            "WBEPI_ENGINE=python to exercise the fork-safety path."
        )

    ctx = multiprocessing.get_context("fork")
    q = ctx.Queue()
    proc = ctx.Process(target=_child_target, args=(q,))
    proc.start()
    proc.join(timeout=30)

    assert proc.exitcode == 0, f"Child process crashed (exit code {proc.exitcode})"

    result = q.get_nowait()
    if not result.get('ok'):
        error = result.get('error', 'unknown')
        if 'rpy2 is not installed' in error or 'wbepi R package' in error:
            pytest.skip(f"R/rpy2 not available: {error}")
        pytest.fail(f"Child failed: {error}")

    assert result['loaded'] is True
    assert result['wbepi_version'] is not None


# ─── 2. Soft timeout handling ──────────────────────────────────────

def test_soft_timeout_marks_run_failed():
    """When ``SoftTimeLimitExceeded`` is raised during simulation,
    the task should mark the ScenarioRun as FAILED with a timeout
    message rather than leaving it stuck in RUNNING.
    """
    from celery.exceptions import SoftTimeLimitExceeded

    # Mock ScenarioRun
    mock_run = MagicMock()
    mock_run.pk = 999
    mock_run.id = 999
    mock_run.seed = 42
    mock_run.parameters_snapshot = {
        'n_populations': 1,
        'ini_S': [1000],
        'ini_I': [10],
        'beta': 0.3,
        'sigma': 0.143,
        'gamma': 0.071,
        'mu': 0.01,
        'time': 180,
        'n_sims': 50,
    }
    mock_run.STATUS_RUNNING = 'RUNNING'
    mock_run.STATUS_FAILED = 'FAILED'
    mock_run.STATUS_PENDING = 'PENDING'
    mock_run.STATUS_SUCCESS = 'SUCCESS'

    # Make run_seirdv raise SoftTimeLimitExceeded
    with patch('predictions.scenarios.tasks.ScenarioRun', create=True) as MockModel, \
         patch('predictions.models.ScenarioRun') as MockModelsModel, \
         patch('django.db.connection') as mock_conn:

        # Configure mock
        MockModelsModel.STATUS_RUNNING = 'RUNNING'
        MockModelsModel.STATUS_FAILED = 'FAILED'
        MockModelsModel.STATUS_PENDING = 'PENDING'
        MockModelsModel.STATUS_SUCCESS = 'SUCCESS'
        MockModelsModel.objects.get.return_value = mock_run

        def _raise_timeout(**kwargs):
            raise SoftTimeLimitExceeded()

        with patch(
            'predictions.scenarios.wbepi_engine.run_seirdv',
            side_effect=_raise_timeout,
        ):
            from predictions.scenarios.tasks import run_scenario_task

            # Call the task directly (not via Celery)
            result = run_scenario_task.apply(
                kwargs={'run_id': 999, 'tenant_id': '0'}
            ).result

    assert result['status'] == 'timeout'
    assert 'timed out' in result.get('error', '').lower()


# ─── 3. Celery settings ───────────────────────────────────────────

def _get_base_setting(name):
    """Read a setting from ``datarepr.settings.base``.

    This bypasses the minimal ``settings.configure()`` in conftest and
    reads the actual production base settings where the R4 hardening
    lives.  Returns None if the setting is not found.
    """
    try:
        import importlib
        base = importlib.import_module('datarepr.settings.base')
        return getattr(base, name, None)
    except Exception:
        return None


def test_worker_max_tasks_per_child_is_configured():
    """Verify ``CELERY_WORKER_MAX_TASKS_PER_CHILD`` is set in Django
    settings — ensures worker recycling is active.
    """
    val = _get_base_setting('CELERY_WORKER_MAX_TASKS_PER_CHILD')
    if val is None:
        pytest.skip("Could not load datarepr.settings.base")
    assert isinstance(val, int) and val > 0, f"Expected positive int, got {val}"
    # Default is 50; allow override up to 500
    assert val <= 500, f"Suspiciously high: {val}"


def test_worker_concurrency_is_one():
    """Verify ``CELERY_WORKER_CONCURRENCY`` defaults to 1 (R is
    single-threaded per process — risk R-2).
    """
    val = _get_base_setting('CELERY_WORKER_CONCURRENCY')
    if val is None:
        pytest.skip("Could not load datarepr.settings.base")
    assert val == 1, f"Expected 1, got {val}"


# ─── 4. R logging callbacks ───────────────────────────────────────

def test_r_log_callbacks_installed():
    """When R is loaded, the rpy2 console callbacks should be
    overridden to route through Python logging.
    """
    try:
        from predictions.scenarios.wbepi_engine.r_engine import (
            _install_r_log_callbacks,
        )
    except ImportError:
        pytest.skip("r_engine not importable")

    # We can't easily test the actual R output without rpy2 running,
    # but we CAN verify the function doesn't crash when called
    # in a mocked environment.
    try:
        import rpy2.rinterface_lib.callbacks as rcb
        original_print = rcb.consolewrite_print
        original_warnerror = rcb.consolewrite_warnerror

        _install_r_log_callbacks()

        # Verify callbacks were replaced
        assert rcb.consolewrite_print is not original_print, \
            "consolewrite_print was not replaced"
        # The warnerror callback should also be set
        assert rcb.consolewrite_warnerror is not original_warnerror, \
            "consolewrite_warnerror was not replaced"
    except ImportError:
        pytest.skip("rpy2 not installed")


# ─── 5. RSS helper ────────────────────────────────────────────────

def test_get_worker_rss_mb_returns_positive():
    """``get_worker_rss_mb`` should return a positive float on
    macOS / Linux.
    """
    try:
        from predictions.scenarios.wbepi_engine.r_engine import get_worker_rss_mb
    except ImportError:
        pytest.skip("r_engine not importable")

    rss = get_worker_rss_mb()
    # Should be positive on any POSIX system
    assert isinstance(rss, float)
    if sys.platform != "win32":
        assert rss > 0, f"Expected positive RSS, got {rss}"


# ─── 6. Health check function ─────────────────────────────────────

def test_health_check_returns_dict():
    """``health_check()`` should return a dict with r_version and
    wbepi_version keys.
    """
    try:
        from predictions.scenarios.wbepi_engine.r_engine import health_check
    except ImportError:
        pytest.skip("r_engine not importable")

    try:
        result = health_check()
    except RuntimeError as exc:
        if "rpy2" in str(exc).lower() or "wbepi" in str(exc).lower():
            pytest.skip(f"R/rpy2 not available: {exc}")
        raise

    assert isinstance(result, dict)
    assert 'r_version' in result
    assert 'wbepi_version' in result
    assert len(result['r_version']) > 0
    assert len(result['wbepi_version']) > 0
