import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction
from chwfolder.models import Country, Region, District
from utils.tenant_resolver import resolve_tenant
from pathlib import Path
import os

class Command(BaseCommand):
    help = 'Migrate CHW data from Excel to Database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing CHW data before migration',
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Path to CHW Excel file (default: data/CHW/CHW info_Data.xlsx)',
        )

    def handle(self, *args, **options):
        clear_data = options.get('clear', False)
        file_path = options.get('file')

        if not file_path:
            backend_dir = Path(__file__).resolve().parent.parent.parent.parent
            file_path = backend_dir.parent / 'data' / 'CHW' / 'CHW info_Data.xlsx'

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'Excel file not found at {file_path}'))
            return

        self.stdout.write(self.style.SUCCESS(f'Starting CHW data migration from: {file_path}'))

        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing CHW data...'))
            District.objects.all().delete()
            Region.objects.all().delete()
            Country.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing data cleared.'))

        xls = pd.ExcelFile(file_path)

        def load_sheet(name):
            if name not in xls.sheet_names:
                return None
            df = pd.read_excel(xls, name)
            df = df.dropna(how="all")
            df = df.where(pd.notna(df), None)
            return df

        # Map CountryID → Tenant so Region/District can denormalize
        country_id_to_tenant = {}

        with transaction.atomic():
            df_country = load_sheet("CHW Country")
            if df_country is not None:
                for _, row in df_country.iterrows():
                    tenant = resolve_tenant(name=row["Country"])
                    country_id_to_tenant[row["CountryID"]] = tenant
                    Country.objects.update_or_create(
                        country_id=row["CountryID"],
                        defaults={
                            "country": row["Country"],
                            "population_2024": row["Population_2024"],
                            "total_chws": row["Total_CHWs"],
                            "chws_per_10000": row["CHWs_per_10000"],
                            "total_regions": row["Total_Regions"],
                            "total_districts": row["Total_Districts"],
                            "data_year": row["Data_Year"],
                            "last_updated": row["Last_Updated"],
                            "tenant": tenant,
                        }
                    )
                self.stdout.write(f'Migrated {len(df_country)} countries')

            df_region = load_sheet("CHW Region")
            if df_region is not None:
                for _, row in df_region.iterrows():
                    tenant = country_id_to_tenant.get(row["CountryID"])
                    if tenant is None:
                        # Fallback: look up the parent Country's tenant from DB
                        try:
                            parent = Country.objects.get(country_id=row["CountryID"])
                            tenant = parent.tenant or resolve_tenant(name=parent.country)
                        except Country.DoesNotExist:
                            tenant = resolve_tenant()  # AFR fallback
                    Region.objects.update_or_create(
                        region_id=row["RegionID"],
                        defaults={
                            "country_id": row["CountryID"],
                            "region_name": row["Region_Name"],
                            "district_count": row["District_Count"],
                            "region_number": row["Region_Number"],
                            "province": row["Province"],
                            "tenant": tenant,
                        }
                    )
                self.stdout.write(f'Migrated {len(df_region)} regions')

            df_district = load_sheet("CHW District")
            if df_district is not None:
                for _, row in df_district.iterrows():
                    tenant = country_id_to_tenant.get(row["CountryID"])
                    if tenant is None:
                        try:
                            parent = Country.objects.get(country_id=row["CountryID"])
                            tenant = parent.tenant or resolve_tenant(name=parent.country)
                        except Country.DoesNotExist:
                            tenant = resolve_tenant()  # AFR fallback
                    District.objects.update_or_create(
                        district_id=row["DistrictID"],
                        defaults={
                            "region_id": row["RegionID"],
                            "country_id": row["CountryID"],
                            "district_name": row["District_Name"],
                            "chw_count": row["CHW_Count"],
                            "population_est": row["Population_Est"],
                            "chws_per_10k": row["CHWs_per_10K"],
                            "tenant": tenant,
                        }
                    )
                self.stdout.write(f'Migrated {len(df_district)} districts')

        self.stdout.write(self.style.SUCCESS('CHW migration complete!'))
