"""
Run refresh_oh_agents in a tight loop for development.

Usage (dev):
    python manage.py watch_oh_agents          # every 30s
    python manage.py watch_oh_agents --interval 10  # every 10s

Production: use cron / django_crontab instead — see CRONJOBS in settings.
"""
import time
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Continuously refresh oh_agents (dev convenience — use cron in prod)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval", type=int, default=30,
            help="Seconds between refreshes (default 30)",
        )

    def handle(self, *args, **options):
        interval = max(5, options["interval"])
        self.stdout.write(self.style.SUCCESS(
            f"Watching oh_agents · refresh every {interval}s · Ctrl-C to stop"
        ))
        try:
            while True:
                try:
                    call_command("refresh_oh_agents")
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"refresh failed: {e}"))
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nstopped")
