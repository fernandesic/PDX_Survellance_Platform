"""
Management command to compute outbreak risk predictions.
Queries real data from STAR Tracker, Sentinel, e-SPAR, and Readiness
to populate the OutbreakPrediction table.

Usage:
    python manage.py compute_predictions
"""

from django.core.management.base import BaseCommand
from predictions.composite_engine import compute_all_predictions


class Command(BaseCommand):
    help = 'Compute outbreak risk predictions from all data sources'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Computing outbreak predictions...'))
        self.stdout.write('Querying: STAR Tracker, Sentinel, e-SPAR, Readiness')
        self.stdout.write('=' * 60)
        
        result = compute_all_predictions()
        
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f"Done! Created: {result['created']}, "
            f"Updated: {result['updated']}, "
            f"Errors: {result['errors']}"
        ))
