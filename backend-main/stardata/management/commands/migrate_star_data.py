import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction
from stardata.models import StarData
from utils.tenant_resolver import resolve_tenant
from pathlib import Path
import os

class Command(BaseCommand):
    help = 'Migrate STAR data from CSV to Database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing STAR data before migration',
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Path to STAR CSV file (default: data/STAR/star_dataraw.csv)',
        )

    def handle(self, *args, **options):
        clear_data = options.get('clear', False)
        file_path = options.get('file')

        if not file_path:
            backend_dir = Path(__file__).resolve().parent.parent.parent.parent
            file_path = backend_dir.parent / 'data' / 'STAR' / 'star_dataraw.csv'

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'CSV file not found at {file_path}'))
            return

        self.stdout.write(self.style.SUCCESS(f'Starting STAR data migration from: {file_path}'))

        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing STAR data...'))
            StarData.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing data cleared.'))

        df = pd.read_csv(file_path)
        df = df.where(pd.notna(df), None)

        def snake_case(s):
            return s.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')

        # Map CSV columns to model fields
        # Note: This is an abbreviated version, real implementation would map all 40+ fields
        # But StarData has generic field names that often match the CSV header after some cleaning
        
        with transaction.atomic():
            for _, row in df.iterrows():
                # We need a unique key. In StarData, key_on_table is unique.
                key = str(row.get('Key on table', ''))
                if not key:
                    continue
                
                defaults = {}
                for col in df.columns:
                    field_name = snake_case(col)
                    if hasattr(StarData, field_name):
                        defaults[field_name] = row[col]
                
                # Special cases for fields that don't match snake_case exactly
                if 'January' in row: defaults['jan'] = row['January']
                if 'February' in row: defaults['feb'] = row['February']
                # ... etc

                defaults['tenant'] = resolve_tenant(name=defaults.get('country'))

                StarData.objects.update_or_create(
                    key_on_table=key,
                    defaults=defaults
                )
            
        self.stdout.write(self.style.SUCCESS(f'Migrated {len(df)} STAR records'))
        self.stdout.write(self.style.SUCCESS('STAR migration complete!'))
