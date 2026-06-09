"""
Management command: Backfill reported_cases and reported_deaths.

Scans all existing signals that have null cases/deaths and attempts
to extract numbers from their original_text using regex patterns.

Usage:
    python manage.py backfill_epi_numbers
    python manage.py backfill_epi_numbers --dry-run
"""

from django.core.management.base import BaseCommand
from django.db.models import Q
from sentinel.models import Signal
from sentinel.epi_extractor import extract_epi_numbers


class Command(BaseCommand):
    help = 'Backfill reported_cases and reported_deaths from original_text using regex extraction'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without writing to the database',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-extract for ALL signals, even those with existing values',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Limit how many signals to process (0 = all)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        limit = options['limit']

        # Find signals with missing cases OR deaths (or all if --force)
        if force:
            qs = Signal.objects.exclude(original_text='')
        else:
            qs = Signal.objects.filter(
                Q(reported_cases__isnull=True) | Q(reported_deaths__isnull=True)
            ).exclude(original_text='')

        if limit > 0:
            qs = qs[:limit]

        total = qs.count()
        updated = 0
        skipped = 0

        self.stdout.write(f"Processing {total} signals...")

        for sig in qs.iterator():
            epi = extract_epi_numbers(sig.original_text or '')

            if epi['cases'] is None and epi['deaths'] is None:
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"  [DRY-RUN] SIG-{sig.id}: "
                    f"cases={epi['cases']}, deaths={epi['deaths']} "
                    f"← \"{(sig.original_text or '')[:80]}...\""
                )
            else:
                fields_to_update = []
                if epi['cases'] is not None:
                    sig.reported_cases = epi['cases']
                    fields_to_update.append('reported_cases')
                if epi['deaths'] is not None:
                    sig.reported_deaths = epi['deaths']
                    fields_to_update.append('reported_deaths')

                if fields_to_update:
                    sig.save(update_fields=fields_to_update)

            updated += 1

        mode = "[DRY-RUN] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"\n{mode}Done! Updated: {updated}, Skipped (no numbers found): {skipped}, Total: {total}"
        ))
