import csv
import os
import re
from django.core.management.base import BaseCommand
from pami.models import PamiData
from utils.tenant_resolver import resolve_tenant

class Command(BaseCommand):
    help = 'Import PAMI data from CSV files'

    def add_arguments(self, parser):
        parser.add_argument('--folder', type=str, help='Folder containing CSV files')

    def handle(self, *args, **options):
        # Default folder relative to backend-main
        folder = options['folder'] or '../frontend-main/dist/data/Pami'
        
        if not os.path.exists(folder):
            # Fallback for different environments
            alt_folder = os.path.join(os.getcwd(), '../frontend-main/dist/data/Pami')
            if os.path.exists(alt_folder):
                folder = alt_folder
            else:
                self.stdout.write(self.style.ERROR(f"Folder {folder} does not exist"))
                return

        # ── Explicit filename → country mapping ─────────────────────
        # Avoids broken string-replace inference
        COUNTRY_MAP = {
            'kenya_pamis_updated.csv': 'Kenya',
            'malawi.csv': 'Malawi',
            'nigeria.csv': 'Nigeria',
            'pamimozambique.csv': 'Mozambique',
            'south_africa_updated.csv': 'South Africa',
            'tanzania.csv': 'Tanzania',
            'uganda_updated.csv': 'Uganda',
            'zimbabwe.csv': 'Zimbabwe',
        }

        # Predefined header mapping for fuzzy matching
        # ADM2_NAME is first because it contains clean names that match ArcGIS shapefiles
        PROVINCE_HEADERS = ['admin_1', 'state', 'region', 'province', 'county', 'province *']
        DISTRICT_HEADERS = ['adm2_name', 'admin_2', 'lga', 'council', 'sub-county', 'district', 'district ', 'geographic unit (ta) ', 'pami_name']
        PRIORITY_HEADERS = ['priority_index', 'priority index', 'priority index ', 'priority i', 'pami index']
        RISK_HEADERS = ['risk', 'pamis', 'list', 'pami_statu', 'cat_b', 'pami_level', 'pami status', 'final_inde']

        def clean_value(val):
            """Strip non-ASCII garbage characters from CSV values."""
            if not val:
                return val
            # Remove non-printable / non-ASCII characters (e.g. the \ufffd from Kenya CSV)
            return re.sub(r'[^\x20-\x7E]', '', val).strip()

        def get_value(row, headers):
            for h in headers:
                # Try exact case
                if h in row:
                    return clean_value(row[h])
                # Check for case-insensitive and trailing spaces
                for key in row.keys():
                    if key.lower().strip() == h.lower().strip():
                        return clean_value(row[key])
            return None

        # Clear existing data before import to avoid duplicates
        PamiData.objects.all().delete()

        for filename in os.listdir(folder):
            if not filename.endswith('.csv'):
                continue
            
            filepath = os.path.join(folder, filename)

            # Use explicit mapping, fallback to cleaned inference
            country_name = COUNTRY_MAP.get(filename.lower())
            if not country_name:
                # Fallback: strip common suffixes/prefixes
                name = filename.lower()
                name = re.sub(r'_?updated', '', name)
                name = re.sub(r'_?pamis?', '', name)
                name = name.replace('.csv', '').replace('_', ' ').strip()
                country_name = name.title()
                self.stdout.write(self.style.WARNING(
                    f"No explicit mapping for '{filename}', inferred: '{country_name}'"
                ))

            self.stdout.write(self.style.SUCCESS(f"Importing {country_name} from {filename}..."))

            # Resolve tenant once per file — all rows share the same country
            tenant = resolve_tenant(name=country_name)

            try:
                with open(filepath, 'r', encoding='latin-1') as f:
                    reader = csv.DictReader(f)
                    count = 0
                    for row in reader:
                        province = get_value(row, PROVINCE_HEADERS)
                        district = get_value(row, DISTRICT_HEADERS)
                        priority_raw = get_value(row, PRIORITY_HEADERS)
                        risk = get_value(row, RISK_HEADERS)

                        # Parse priority as number, default to 0
                        priority = 0
                        if priority_raw:
                            try:
                                priority = int(float(priority_raw))
                            except (ValueError, TypeError):
                                priority = 0

                        # Clean additional_data values too
                        cleaned_row = {k: clean_value(v) for k, v in row.items()}

                        # Create record
                        PamiData.objects.create(
                            country=country_name,
                            province=province or '',
                            district=district or '',
                            priority_index=priority,
                            risk_level=risk or '',
                            additional_data=cleaned_row,
                            tenant=tenant,
                        )
                        count += 1
                    self.stdout.write(self.style.SUCCESS(f"Successfully imported {count} records for {country_name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error importing {filename}: {str(e)}"))

