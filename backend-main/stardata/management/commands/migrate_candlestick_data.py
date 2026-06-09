import csv
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from django.conf import settings
from pathlib import Path
from stardata.models import StarCandlestick
from utils.tenant_resolver import resolve_tenant

class Command(BaseCommand):
    help = 'Migrate STAR Candlestick data from CSV to database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing candlestick data before migration',
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Path to Candlestick CSV file',
        )

    def handle(self, *args, **options):
        clear_data = options.get('clear', False)
        file_path = options.get('file')
        
        if not file_path:
            # Default path
            file_path = os.path.join(settings.MEDIA_ROOT, 'uploads/stardata/star_candlestick_ready.csv')
            if not os.path.exists(file_path):
                backend_dir = Path(__file__).resolve().parent.parent.parent.parent
                file_path = backend_dir.parent / 'data' / 'star_candlestick_ready.csv'
        
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'CSV file not found: {file_path}'))
            return
        
        if clear_data:
            self.stdout.write(self.style.WARNING('Clearing existing Candlestick data...'))
            StarCandlestick.objects.all().delete()

        self.stdout.write(self.style.SUCCESS(f'Starting Candlestick migration from: {file_path}'))
        
        total_records = 0
        with open(file_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            batch = []
            BATCH_SIZE = 1000
            
            for row in reader:
                hazard = row.get('Hazard', '').strip()
                country = row.get('Country', '').strip()
                year = row.get('Year', '').strip()
                month_num_str = row.get('Month_num', '').strip()
                
                if not hazard or not country or not year or not month_num_str:
                    continue
                    
                try:
                    month_num = int(month_num_str)
                    month_key = f"{year}-{str(month_num).zfill(2)}"
                    
                    candlestick = StarCandlestick(
                        hazard=hazard,
                        country=country,
                        year=year,
                        month_num=month_num,
                        month_key=month_key,
                        open_val=float(row.get('Open', 0)),
                        high_val=float(row.get('High', 0)),
                        low_val=float(row.get('Low', 0)),
                        close_val=float(row.get('Close', 0)),
                        tenant=resolve_tenant(name=country),
                    )
                    batch.append(candlestick)
                    
                    if len(batch) >= BATCH_SIZE:
                        with transaction.atomic():
                            StarCandlestick.objects.bulk_create(batch)
                        total_records += len(batch)
                        batch = []
                        self.stdout.write(f'  Processed {total_records} records...', ending='\r')
                        
                except ValueError:
                    continue
            
            if batch:
                with transaction.atomic():
                    StarCandlestick.objects.bulk_create(batch)
                total_records += len(batch)

        self.stdout.write(self.style.SUCCESS(f'\n=== Migration Complete ==='))
        self.stdout.write(f'Total records: {total_records}')
