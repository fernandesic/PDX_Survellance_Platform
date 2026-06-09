"""Sentinel app config.

Auto-starts the APScheduler that drives sentinel ingestion AND the
One Health dashboard refresh (alerts, agents, HITL, weekly reference
pipeline) when Django is running as a long-lived process.
"""
import logging
import os
import sys

from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _should_start_scheduler() -> bool:
    """Return True only on long-running Django processes.

    Started:
      • runserver child process (RUN_MAIN=true)  — dev
      • gunicorn / uvicorn / uwsgi              — prod
      • daphne                                  — async/ws
      • OH_AUTOSTART_SCHEDULER=1                — explicit override

    Not started for:
      • manage.py migrate / shell / custom commands
      • tests
    """
    if os.environ.get("OH_AUTOSTART_SCHEDULER") == "1":
        return True

    if not sys.argv:
        return False

    argv0 = sys.argv[0] or ""
    long_running_servers = ("gunicorn", "uvicorn", "uwsgi", "daphne", "hypercorn")
    if any(s in argv0 for s in long_running_servers):
        return True

    if "runserver" in sys.argv:
        # Django runserver auto-reload spawns two processes — only the child
        # (RUN_MAIN=true) actually serves; start there to avoid duplicates.
        return os.environ.get("RUN_MAIN") == "true"

    return False


class SentinelConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "sentinel"

    def ready(self):
        if not _should_start_scheduler():
            return
        try:
            from sentinel.scheduler import start_scheduler
            start_scheduler()
            logger.info("[sentinel] APScheduler started — sentinel + OH dashboard "
                        "jobs will run automatically.")
        except Exception as e:  # noqa: BLE001 — AppConfig.ready: scheduler start failure must never block Django startup
            logger.exception("[sentinel] failed to auto-start scheduler: %s", e)
