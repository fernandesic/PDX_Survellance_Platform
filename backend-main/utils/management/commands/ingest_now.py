"""
Manually trigger sentinel ingestion right now (don't wait for scheduler).

By default the APScheduler in sentinel/scheduler.py uses IntervalTrigger
which only fires N minutes AFTER startup — so a freshly-restarted Django
process has zero ingested signals for 15+ minutes. This command kicks off
each ingestion immediately, then runs the One Health alert import so the
dashboard reflects real data without waiting.

Usage:
    python manage.py ingest_now
    python manage.py ingest_now --skip-import   # only ingest, don't push to oh_alerts
"""
import logging
import traceback

from django.core.management import call_command
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


def _safe_call(label, fn):
    """Run an ingestion function and report success/failure without aborting."""
    try:
        result = fn()
        return True, result
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


class Command(BaseCommand):
    help = "Run all sentinel ingestion functions immediately, then import to oh_alerts."

    def add_arguments(self, parser):
        parser.add_argument("--skip-import", action="store_true",
                            help="Only ingest sentinel signals; skip oh_alerts import.")
        parser.add_argument("--only", choices=["gdelt", "reliefweb", "allafrica", "who"],
                            help="Run only one source (default: all).")

    def handle(self, *args, **opts):
        from sentinel.ingestion import (
            ingest_from_gdelt, ingest_from_reliefweb,
            ingest_from_who_news, ingest_from_allafrica,
        )

        sources = {
            "gdelt": ("GDELT (news)", ingest_from_gdelt),
            "reliefweb": ("ReliefWeb (UN)", ingest_from_reliefweb),
            "allafrica": ("AllAfrica RSS", ingest_from_allafrica),
            "who": ("WHO News RSS", ingest_from_who_news),
        }

        only = opts.get("only")
        if only:
            sources = {only: sources[only]}

        self.stdout.write(self.style.HTTP_INFO("=== Triggering sentinel ingestion ==="))
        results = {}
        for key, (label, fn) in sources.items():
            self.stdout.write(f"  → {label}…")
            ok, info = _safe_call(label, fn)
            if ok:
                self.stdout.write(self.style.SUCCESS(f"     done ({info if info is not None else 'no return value'})"))
            else:
                self.stdout.write(self.style.ERROR(f"     FAILED — {info}"))
            results[key] = ok

        if not opts["skip_import"]:
            self.stdout.write(self.style.HTTP_INFO("\n=== Importing into oh_alerts ==="))
            try:
                call_command("import_sentinel_to_oh_alerts",
                             "--since-hours", "168",
                             "--verbose-rows")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"import failed: {e}"))
                traceback.print_exc()

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Run `python manage.py diagnose_oh_alerts` to verify."
        ))
