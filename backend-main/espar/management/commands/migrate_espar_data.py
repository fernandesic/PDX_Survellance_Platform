import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction
from espar.models import Sheet, Espar, Indicator
from utils.tenant_resolver import resolve_tenant
from pathlib import Path
import os
import re

class Command(BaseCommand):
    help = 'Migrate e-SPAR data from Excel to Database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing e-SPAR data before migration',
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Path to e-SPAR Excel file (default: data/e-SPAR/2022-24IHRScoreperCapacity_202510300223.xlsx)',
        )

    def handle(self, *args, **options):
        clear_data = options.get('clear', False)
        file_path = options.get('file')

        if not file_path:
            backend_dir = Path(__file__).resolve().parent.parent.parent.parent
            file_path = backend_dir.parent / 'data' / 'e-SPAR' / '2022-24IHRScoreperCapacity_202510300223.xlsx'

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'Excel file not found at {file_path}'))
            return

        self.stdout.write(self.style.SUCCESS(f'Starting e-SPAR data migration from: {file_path}'))

        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing e-SPAR data...'))
            Indicator.objects.all().delete()
            Espar.objects.all().delete()
            Sheet.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing data cleared.'))

        xls = pd.ExcelFile(file_path)
        
        # We assume sheets are years: 2022, 2023, 2024
        sheets_to_process = [s for s in xls.sheet_names if s.isdigit()]
        
        for sheet_name in sheets_to_process:
            self.stdout.write(f'Processing year: {sheet_name}')
            df = pd.read_excel(xls, sheet_name, skiprows=13)
            df = df.dropna(how='all')
            
            with transaction.atomic():
                sheet_obj, _ = Sheet.objects.get_or_create(name=sheet_name)
                
                for _, row in df.iterrows():
                    state_name = str(row.get('States Party of IHR', '')).strip()
                    if not state_name or state_name == 'nan':
                        continue
                        
                    espar_obj, _ = Espar.objects.update_or_create(
                        sheet=sheet_obj,
                        states=state_name,
                        defaults={
                            'tenant': resolve_tenant(name=state_name),
                        }
                    )
                    
                    # Indicators are columns like C.1, C.1.1, etc.
                    indicator_cols = [c for c in df.columns if re.match(r'^C\.\d+', str(c))]
                    
                    for col in indicator_cols:
                        val = row.get(col)
                        if pd.notna(val):
                            Indicator.objects.update_or_create(
                                espar=espar_obj,
                                code=col,
                                defaults={'value': int(val)}
                            )
            
            self.stdout.write(self.style.SUCCESS(f'  ✓ Migrated {sheet_name} data'))

        self.stdout.write(self.style.SUCCESS('e-SPAR migration complete!'))
