"""
Management command to sync live data from GDELT and ReliefWeb
"""

from django.core.management.base import BaseCommand
from sentinel.models import Signal


class Command(BaseCommand):
    help = 'Sync live data from GDELT and ReliefWeb APIs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing signals before ingesting',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = Signal.objects.all().count()
            Signal.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'[CLEARED] {count} existing signals'))
        
        # Import here to avoid circular imports
        from sentinel.ingestion import sync_live_data
        
        self.stdout.write(self.style.SUCCESS('\n[SYNC] Starting live data sync...\n'))
        
        results = sync_live_data()
        
        self.stdout.write(self.style.SUCCESS(f'''
[DONE] Sync Complete!
   GDELT:     {results.get("gdelt", {})}
   ReliefWeb: {results.get("reliefweb", {})}
   Total:     {results.get("total_signals", 0)} signals in database
        '''))
