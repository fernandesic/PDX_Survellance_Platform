"""
Continuously import sentinel signals into oh_alerts (dev convenience).

Usage:
    python manage.py watch_sentinel_import
    python manage.py watch_sentinel_import --interval 60

Production: use cron / django_crontab — see CRONJOBS in settings.
"""
import time
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Continuously import sentinel → oh_alerts (dev convenience)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval", type=int, default=300,
            help="Seconds between imports (default 300 = 5 min)",
        )
        parser.add_argument(
            "--since-hours", type=int, default=72,
            help="Pass through to import_sentinel_to_oh_alerts.",
        )

    def handle(self, *args, **opts):
        interval = max(30, opts["interval"])
        since = opts["since_hours"]
        self.stdout.write(self.style.SUCCESS(
            f"Watching sentinel → oh_alerts · refresh every {interval}s · Ctrl-C to stop"
        ))
        try:
            while True:
                try:
                    call_command("import_sentinel_to_oh_alerts", since_hours=since)
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"import failed: {e}"))
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nstopped")
