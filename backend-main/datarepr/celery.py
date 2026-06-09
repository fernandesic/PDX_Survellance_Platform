import os
import logging

from celery import Celery
from celery.signals import worker_process_init

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings')

logger = logging.getLogger('wbepi')

app = Celery('datarepr')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.conf.broker_connection_retry_on_startup = True

app.autodiscover_tasks()
# `predictions/scenarios/tasks.py` is nested below the app root, so the
# default INSTALLED_APPS scan misses it. Register it explicitly so
# `run_scenario_task` is routable from the worker.
app.autodiscover_tasks(packages=['predictions.scenarios'])


# ── Sprint R4: post-fork R pre-warm ─────────────────────────────
# R initialisation takes 1–3s on first call.  By triggering it here
# (after the fork, inside the child process) we absorb that latency
# at worker boot rather than on the first scenario task.
#
# Only fires when WBEPI_ENGINE=r — harmless no-op otherwise.
# Disabled by setting WBEPI_PREWARM=0 in the environment.

@worker_process_init.connect
def _prewarm_r_engine(**kwargs):
    """Pre-load the R interpreter inside the worker process.

    This MUST run post-fork (the signal guarantees that).  Loading R
    before the fork causes segfaults in the child (risk R-3).
    """
    if os.environ.get('WBEPI_PREWARM', '1') == '0':
        return

    try:
        from predictions.scenarios.wbepi_engine.r_engine import health_check
        info = health_check()
        logger.info(
            "R pre-warm OK: R %s, wbepi %s",
            info.get('r_version', '?'),
            info.get('wbepi_version', '?'),
        )
    except Exception as exc:  # noqa: BLE001 — pre-warm is best-effort; the lazy init in the first task will retry
        # Non-fatal — the first task will retry the lazy init anyway.
        logger.warning("R pre-warm failed (non-fatal): %s", exc)
