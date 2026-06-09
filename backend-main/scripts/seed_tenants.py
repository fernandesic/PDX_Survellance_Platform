"""
Seed Tenants — WHO AFRO 47 Member States + 1 Continental HQ

Usage:
    python manage.py shell < scripts/seed_tenants.py

Or from Django shell:
    exec(open('scripts/seed_tenants.py').read())

Safe to run multiple times — uses get_or_create.
"""

import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')

try:
    django.setup()
except RuntimeError:
    pass  # Already configured

from account.models import Tenant

# WHO AFRO 47 Member States
# Source: https://www.afro.who.int/countries
AFRO_COUNTRIES = [
    # (name, iso3, who_sub_region)
    ("Algeria", "DZA", "North Africa"),
    ("Angola", "AGO", "Southern Africa"),
    ("Benin", "BEN", "West Africa"),
    ("Botswana", "BWA", "Southern Africa"),
    ("Burkina Faso", "BFA", "West Africa"),
    ("Burundi", "BDI", "East Africa"),
    ("Cabo Verde", "CPV", "West Africa"),
    ("Cameroon", "CMR", "Central Africa"),
    ("Central African Republic", "CAF", "Central Africa"),
    ("Chad", "TCD", "Central Africa"),
    ("Comoros", "COM", "East Africa"),
    ("Congo", "COG", "Central Africa"),
    ("Côte d'Ivoire", "CIV", "West Africa"),
    ("Democratic Republic of the Congo", "COD", "Central Africa"),
    ("Equatorial Guinea", "GNQ", "Central Africa"),
    ("Eritrea", "ERI", "East Africa"),
    ("Eswatini", "SWZ", "Southern Africa"),
    ("Ethiopia", "ETH", "East Africa"),
    ("Gabon", "GAB", "Central Africa"),
    ("Gambia", "GMB", "West Africa"),
    ("Ghana", "GHA", "West Africa"),
    ("Guinea", "GIN", "West Africa"),
    ("Guinea-Bissau", "GNB", "West Africa"),
    ("Kenya", "KEN", "East Africa"),
    ("Lesotho", "LSO", "Southern Africa"),
    ("Liberia", "LBR", "West Africa"),
    ("Madagascar", "MDG", "East Africa"),
    ("Malawi", "MWI", "Southern Africa"),
    ("Mali", "MLI", "West Africa"),
    ("Mauritania", "MRT", "West Africa"),
    ("Mauritius", "MUS", "East Africa"),
    ("Mozambique", "MOZ", "Southern Africa"),
    ("Namibia", "NAM", "Southern Africa"),
    ("Niger", "NER", "West Africa"),
    ("Nigeria", "NGA", "West Africa"),
    ("Rwanda", "RWA", "East Africa"),
    ("Sao Tome and Principe", "STP", "Central Africa"),
    ("Senegal", "SEN", "West Africa"),
    ("Seychelles", "SYC", "East Africa"),
    ("Sierra Leone", "SLE", "West Africa"),
    ("South Africa", "ZAF", "Southern Africa"),
    ("South Sudan", "SSD", "East Africa"),
    ("Togo", "TGO", "West Africa"),
    ("Uganda", "UGA", "East Africa"),
    ("United Republic of Tanzania", "TZA", "East Africa"),
    ("Zambia", "ZMB", "Southern Africa"),
    ("Zimbabwe", "ZWE", "Southern Africa"),
]

def seed():
    created_count = 0
    existing_count = 0

    # 1. Create the continental AFRO HQ tenant
    _, was_created = Tenant.objects.get_or_create(
        iso_code='AFR',
        defaults={
            'name': 'WHO AFRO Continental',
            'is_continental': True,
            'who_region': 'Continental',
        }
    )
    if was_created:
        created_count += 1
        print("  ✓ Created: WHO AFRO Continental (AFR)")
    else:
        existing_count += 1

    # 2. Create all 47 member state tenants
    for name, iso3, region in AFRO_COUNTRIES:
        _, was_created = Tenant.objects.get_or_create(
            iso_code=iso3,
            defaults={
                'name': name,
                'is_continental': False,
                'who_region': region,
            }
        )
        if was_created:
            created_count += 1
            print(f"  ✓ Created: {name} ({iso3})")
        else:
            existing_count += 1

    total = Tenant.objects.count()
    print(f"\n  Done. Created: {created_count}, Already existed: {existing_count}, Total: {total}")

if __name__ == '__main__':
    seed()
else:
    seed()
