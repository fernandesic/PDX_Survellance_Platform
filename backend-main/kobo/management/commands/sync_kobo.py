"""
sync_kobo — Django management command for KoboToolbox CHW ingestion.

Usage:
    python manage.py sync_kobo                    # Full sync
    python manage.py sync_kobo --dry-run          # Preview without saving
    python manage.py sync_kobo --limit 50         # Fetch at most 50
    python manage.py sync_kobo --since 2026-05-01 # Only after date
"""

import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime as django_parse_datetime

from kobo.ingestion import sync_kobo_submissions

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync CHW submissions from KoboToolbox into Sentinel signals'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Fetch and preview submissions without saving to the database',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of submissions to fetch (default: 100)',
        )
        parser.add_argument(
            '--since',
            type=str,
            default=None,
            help='Only fetch submissions after this date (YYYY-MM-DD or ISO datetime)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']
        since_str = options['since']

        since = None
        if since_str:
            # Try ISO datetime first, then date-only
            since = django_parse_datetime(since_str)
            if since is None:
                try:
                    since = datetime.strptime(since_str, '%Y-%m-%d')
                except ValueError:
                    self.stderr.write(
                        self.style.ERROR(
                            f"Invalid --since format: {since_str}. "
                            "Use YYYY-MM-DD or ISO datetime."
                        )
                    )
                    return

        if dry_run:
            self.stdout.write(self.style.WARNING('[DRY RUN] No data will be saved.'))

        self.stdout.write(
            f"Syncing Kobo submissions (limit={limit}, since={since}, dry_run={dry_run})..."
        )

        try:
            stats = sync_kobo_submissions(
                dry_run=dry_run,
                limit=limit,
                since=since,
            )
        except Exception as exc:
            self.stderr.write(
                self.style.ERROR(f"Sync failed: {exc}")
            )
            logger.exception("sync_kobo command failed")
            return

        self.stdout.write(self.style.SUCCESS(
            f"Kobo sync complete: "
            f"{stats['created']} created, "
            f"{stats['skipped']} skipped, "
            f"{stats['errors']} errors"
        ))
