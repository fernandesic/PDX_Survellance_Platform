"""
Management command to load forecast CSV data into the ForecastData DB table.
Replaces file-based CSV reads with database queries.

Usage:
    python manage.py load_forecast_data          # Load all CSVs
    python manage.py load_forecast_data --clear   # Clear existing + reload
"""

import csv
import os
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

from predictions.models import ForecastData
from utils.tenant_resolver import resolve_tenant

DATA_DIR = os.path.join(settings.BASE_DIR, '..', 'data', 'predictions')


class Command(BaseCommand):
    help = 'Load forecast CSV data into the ForecastData database table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing ForecastData before loading',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = ForecastData.objects.count()
            ForecastData.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing ForecastData rows'))

        total = 0
        total += self._load_drc_master()
        total += self._load_moz_national()
        total += self._load_moz_district_summary()

        self.stdout.write(self.style.SUCCESS(f'✅ Loaded {total} total rows into ForecastData'))

    def _load_drc_master(self):
        """
        Load DRC_Cholera_Master_Cleaned_Weather.csv
        Each row is district-level daily data → stored as 'regional' type.
        Also used for national aggregation in views.
        """
        filepath = os.path.join(DATA_DIR, 'DRC_Cholera_Master_Cleaned_Weather.csv')
        if not os.path.exists(filepath):
            self.stdout.write(self.style.ERROR(f'File not found: {filepath}'))
            return 0

        self.stdout.write('Loading DRC Master CSV...')
        tenant = resolve_tenant(iso='COD')
        rows = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse date from DD-MM-YYYY format
                try:
                    date = datetime.strptime(row['Date'], '%d-%m-%Y').date()
                except (ValueError, KeyError):
                    continue

                # Parse optional weather fields
                temp = None
                rain = None
                try:
                    temp = float(row['Temp']) if row.get('Temp') else None
                except (ValueError, TypeError):
                    pass
                try:
                    rain = float(row['Rain']) if row.get('Rain') else None
                except (ValueError, TypeError):
                    pass

                rows.append(ForecastData(
                    country_iso='COD',
                    country_name='DR Congo',
                    disease='cholera',
                    data_type='regional',
                    date=date,
                    province=row.get('Province', ''),
                    district=row.get('District', ''),
                    cases=int(row.get('Cases') or 0),
                    deaths=int(row.get('Deaths') or 0),
                    temperature=temp,
                    rainfall=rain,
                    tenant=tenant,
                ))

        # Bulk create for speed
        ForecastData.objects.bulk_create(rows, batch_size=5000)
        self.stdout.write(self.style.SUCCESS(f'  DRC Master: {len(rows)} rows loaded'))
        return len(rows)

    def _load_moz_national(self):
        """
        Load MOZ_National_Cumulative_Predictions.csv
        National-level weekly data.
        """
        filepath = os.path.join(DATA_DIR, 'MOZ_National_Cumulative_Predictions.csv')
        if not os.path.exists(filepath):
            self.stdout.write(self.style.ERROR(f'File not found: {filepath}'))
            return 0

        self.stdout.write('Loading MOZ National CSV...')
        tenant = resolve_tenant(iso='MOZ')
        rows = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    date = datetime.strptime(row['Date'], '%Y-%m-%d').date()
                except (ValueError, KeyError):
                    continue

                rows.append(ForecastData(
                    country_iso='MOZ',
                    country_name='Mozambique',
                    disease='cholera',
                    data_type='national',
                    date=date,
                    cases=int(row.get('Cases', 0)),
                    deaths=int(row.get('Deaths', 0)),
                    cumulative_cases=int(row.get('National_Cumulative_Cases', 0)),
                    cumulative_deaths=int(row.get('National_Cumulative_Deaths', 0)),
                    tenant=tenant,
                ))

        ForecastData.objects.bulk_create(rows, batch_size=1000)
        self.stdout.write(self.style.SUCCESS(f'  MOZ National: {len(rows)} rows loaded'))
        return len(rows)

    def _load_moz_district_summary(self):
        """
        Load MOZ_District_Summary.csv
        District-level intervention plan data (no time-series, summary only).
        """
        filepath = os.path.join(DATA_DIR, 'MOZ_District_Summary.csv')
        if not os.path.exists(filepath):
            self.stdout.write(self.style.ERROR(f'File not found: {filepath}'))
            return 0

        self.stdout.write('Loading MOZ District Summary CSV...')
        tenant = resolve_tenant(iso='MOZ')
        rows = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(ForecastData(
                    country_iso='MOZ',
                    country_name='Mozambique',
                    disease='cholera',
                    data_type='district_summary',
                    province=row.get('Province', ''),
                    district=row.get('District', ''),
                    cases=int(row.get('Total_Cases', 0)),
                    deaths=int(row.get('Total_Deaths', 0)),
                    risk_level=row.get('Risk_Level', ''),
                    action_required=row.get('Action_Required', ''),
                    tenant=tenant,
                ))

        ForecastData.objects.bulk_create(rows, batch_size=1000)
        self.stdout.write(self.style.SUCCESS(f'  MOZ District Summary: {len(rows)} rows loaded'))
        return len(rows)
