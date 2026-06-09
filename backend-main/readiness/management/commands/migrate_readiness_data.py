import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from readiness.models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever,
)
from pathlib import Path
import os
import re
from utils.tenant_resolver import resolve_tenant

class Command(BaseCommand):
    help = 'Migrate Readiness data from CSV files in media/uploads/readiness/ to Database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing Readiness data before migration',
        )
        parser.add_argument(
            '--disease',
            type=str,
            help='Migrate specific disease (e.g. arbovirus)',
        )

    def handle(self, *args, **options):
        clear_data = options.get('clear', False)
        disease_filter = options.get('disease')

        backend_dir = Path(__file__).resolve().parent.parent.parent.parent
        data_dir = backend_dir / 'media' / 'uploads' / 'readiness'

        if not data_dir.exists():
            self.stdout.write(self.style.ERROR(f'Readiness data directory not found at {data_dir}'))
            return

        # Mapping of Model to (subfolder, CSV filename pattern)
        readiness_configs = [
            (ArboVirus, 'arbovirus', 'Arbovirus_dengue_readiness_with_category_percent'),
            (Cholera, 'cholera', 'Cholera_readiness_with_category_percent'),
            (CholeraSubNational, 'cholerasubnational', 'Cholera_subnational_readiness_with_category_percent'),
            (Cyclone, 'cyclone', 'Cyclone_readiness_with_category_percent'),
            (FVD, 'fvd', 'FVD_readiness_with_category_percent'),
            (FVDPoE, 'fvdpoe', 'FVD_PoE_readiness_with_category_percent'),
            (LassaFever, 'lassafever', 'lassaFeverreadiness_DataUnweighted'),
            (LassaFeverDistrict, 'lassafeverdistrict', 'LassaFever_districts_readiness_with_category_percent'),
            (Marburg, 'marburg', 'Marburg_readiness_with_category_percent'),
            (Meningitis, 'meningitis', 'Meningitis_readiness_with_category_percent'),
            (MeningitiseElimination, 'meningitiselimination', 'MeningitisElimination_readiness_with_category_percent'),
            (Mpox, 'mpox', 'MPox_national_readiness_with_category_percent'),
            (MpoxDistrict, 'mpoxdistrict', 'MPox_districts_readiness_with_category_percent'),
            (NaturalDisaster, 'naturaldisaster', 'NaturalDisasters_readiness_with_category_percent'),
            (RiftValleyFever, 'riftvalley', 'RiftValleyFever_readiness_with_category_percent'),
        ]

        # Column name mapping from CSV header (snake_cased) -> model field name
        COLUMN_MAP = {
            'questionid': 'question_id',
            'questionkey': 'question_key',
            'categorycode': 'category_code',
            'affectsscore': 'affects_score',
            'categoryscore': 'category_score',
            'categoryweight': 'category_weight',
            'questionscore': 'question_score',
            'questioncategoryweight': 'question_category_weight',
            'categorylanguage': 'category_language',
            'questionlanguage': 'question_language',
            'nationalynvalue': 'national_yn_value',
            'nationalyn': 'national_yn',
            'filename': 'file_name',
            'adminlevel': 'admin_level',
            'adminlevelname': 'admin_level_name',
            'filelanguage': 'file_language',
            'rowno': 'row_no',
            'key_ontable': 'key_on_table',
            'key': 'key_on_table',
            'h_times_m': 'h_times_m',
            'dataperiod': 'data_period',
            'dataperiodid': 'data_period_id',
            'hasinternationalpoe': 'has_international_poe',
            'poe_name': 'poe_name',
            'poename': 'poe_name',
            # _country columns
            'categoryweightsum_country': 'category_weight_sum_country',
            'weightedsum_country': 'weighted_sum_country',
            'categorypercent_country': 'category_percent_country',
            'categorypercent_country_pct': 'category_percent_country_pct',
            # _geo columns (sub-national/district/PoE models)
            'categoryweightsum_geo': 'category_weight_sum_geo',
            'weightedsum_geo': 'weighted_sum_geo',
            'categorypercent_geo': 'category_percent_geo',
            'categorypercent_geo_pct': 'category_percent_geo_pct',
        }

        def snake_case(s):
            return s.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_').replace('.', '_')

        def find_csv_file(subfolder_path, expected_name):
            # Try exact match first (with .csv)
            exact_path = subfolder_path / f"{expected_name}.csv"
            if exact_path.exists():
                return exact_path

            # Try pattern matching
            for csv_file in subfolder_path.glob('*.csv'):
                base = csv_file.stem.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('.', '_')
                expected = expected_name.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('.', '_')
                if expected in base or base.startswith(expected.split('_')[0]):
                    return csv_file

            # Last resort: return any CSV file in the subfolder
            any_csv = list(subfolder_path.glob('*.csv'))
            if any_csv:
                return any_csv[0]

            return None

        def get_model_fields(model_class):
            return {f.name for f in model_class._meta.get_fields() if not f.is_relation}

        total_records = 0

        for model_class, subfolder, csv_filename in readiness_configs:
            disease_key = model_class.__name__.lower()
            if disease_filter and disease_key != disease_filter.lower():
                continue

            subfolder_path = data_dir / subfolder
            if not subfolder_path.exists():
                self.stdout.write(self.style.WARNING(f'Subfolder not found: {subfolder}'))
                continue

            file_path = find_csv_file(subfolder_path, csv_filename)
            if not file_path:
                self.stdout.write(self.style.WARNING(f'No CSV file found in {subfolder}/'))
                continue

            self.stdout.write(f'Migrating {model_class.__name__} from {file_path.name}...')

            try:
                df = pd.read_csv(file_path, encoding='utf-8-sig')
                df = df.where(pd.notna(df), None)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Failed to read CSV: {e}'))
                continue

            model_fields = get_model_fields(model_class)
            objects_to_create = []

            for idx, row in df.iterrows():
                # Build the key
                key = row.get('Key')
                if key is None or (isinstance(key, float)):
                    key = row.get('Key_OnTable')
                if key is None or (isinstance(key, float)):
                    question_key = row.get('QuestionKey', '')
                    country = row.get('Country', '')
                    district = row.get('District', '')
                    poe = row.get('PoEName', '')
                    row_no = row.get('RowNo', idx)
                    data_period = row.get('DataPeriod', '')
                    parts = [str(question_key or ''), str(country or '')]
                    if district and not (isinstance(district, float)):
                        parts.append(str(district))
                    if poe and not (isinstance(poe, float)):
                        parts.append(str(poe))
                    if data_period and not (isinstance(data_period, float)):
                        parts.append(str(data_period))
                    parts.append(str(int(row_no) if row_no is not None and not (isinstance(row_no, float) and pd.isna(row_no)) else idx))
                    key = '_'.join(parts).replace(' ', '_')
                if not key or key == "__" or key == "_":
                    continue

                known_fields = {}
                extra_fields = {}

                for col in df.columns:
                    value = row.get(col)
                    if value is None:
                        continue
                    if isinstance(value, float) and pd.isna(value):
                        continue

                    field_name = snake_case(col)

                    # Apply column mapping
                    if field_name in COLUMN_MAP:
                        field_name = COLUMN_MAP[field_name]

                    if field_name in model_fields:
                        known_fields[field_name] = value
                    else:
                        extra_fields[field_name] = value

                if extra_fields:
                    known_fields['extra_data'] = extra_fields

                known_fields['key_on_table'] = key
                # Resolve tenant from country name (common to all 15 disease models)
                country_name = known_fields.get('country')
                known_fields['tenant'] = resolve_tenant(name=country_name)
                objects_to_create.append(model_class(**known_fields))

            # Use bulk operations for speed
            with transaction.atomic():
                if clear_data:
                    deleted_count = model_class.objects.all().delete()[0]
                    self.stdout.write(self.style.WARNING(f'  Cleared {deleted_count} existing records'))

                # Bulk create in batches of 500
                batch_size = 500
                created = 0
                for i in range(0, len(objects_to_create), batch_size):
                    batch = objects_to_create[i:i + batch_size]
                    model_class.objects.bulk_create(batch, ignore_conflicts=True)
                    created += len(batch)
                    self.stdout.write(f'  ... inserted {created}/{len(objects_to_create)} records')

            total_records += len(objects_to_create)
            self.stdout.write(self.style.SUCCESS(f'  Migrated {len(objects_to_create)} records for {model_class.__name__}'))

        self.stdout.write(self.style.SUCCESS(f'\nReadiness migration complete! Total: {total_records} records'))
