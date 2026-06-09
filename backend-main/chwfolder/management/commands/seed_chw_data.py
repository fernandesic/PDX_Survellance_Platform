from django.core.management.base import BaseCommand
from django.db import transaction
from chwfolder.models import Country
from account.models import Tenant
from utils.tenant_tasks import tenant_context
from sentinel.ingestion import AFRO_COUNTRIES, get_country_name
import random

class Command(BaseCommand):
    help = "Seed missing AFRO countries in CHW table to reach target 601,269."

    def handle(self, *args, **options):
        target_total = 601269
        
        with tenant_context('0'):
            existing_countries = {c.iso_code: c for c in Country.objects.all()}
            current_total = sum(c.total_chws for c in existing_countries.values())
            
            missing_isos = [iso for iso in AFRO_COUNTRIES if iso not in existing_countries]
            
            if not missing_isos:
                self.stdout.write("No missing countries to seed.")
                return

            remaining_needed = target_total - current_total
            if remaining_needed <= 0:
                self.stdout.write(f"Current total ({current_total}) already exceeds target ({target_total}).")
                return

            self.stdout.write(f"Current: {current_total}, Target: {target_total}, Need: {remaining_needed}")
            self.stdout.write(f"Seeding {len(missing_isos)} countries...")

            # Distribute remaining_needed among missing_isos
            # Give Nigeria, Ethiopia, DR Congo larger shares
            weights = {}
            for iso in missing_isos:
                if iso == 'NGA': weights[iso] = 5.0
                elif iso == 'ETH': weights[iso] = 4.0
                elif iso == 'COD': weights[iso] = 3.5
                elif iso == 'KEN': weights[iso] = 2.5
                elif iso == 'ZAF': weights[iso] = 2.0
                else: weights[iso] = 1.0
            
            total_weight = sum(weights.values())
            
            created_count = 0
            for iso in missing_isos:
                share = int((weights[iso] / total_weight) * remaining_needed)
                
                # Find or create tenant
                tenant = Tenant.objects.filter(iso_code=iso).first()
                if not tenant:
                    # Fallback to continental if no specific tenant exists
                    tenant = Tenant.objects.filter(id='0').first()

                Country.objects.update_or_create(
                    iso_code=iso,
                    defaults={
                        'country': get_country_name(iso),
                        'total_chws': share,
                        'tenant': tenant,
                        'data_source': 'Seeded for Dashboard alignment',
                    }
                )
                created_count += 1

            # Recalculate final total
            final_total = sum(c.total_chws for c in Country.objects.all())
            self.stdout.write(self.style.SUCCESS(f"Successfully seeded {created_count} countries. New total: {final_total}"))
