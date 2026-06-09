"""
Fetch population data from World Bank API for all CHW countries.
Uses ISO3 codes already stored in the DB to query the API.
Updates population_2024 and recalculates chws_per_10000.
"""
import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from chwfolder.models import Country


# Map special ISO codes to World Bank-recognized codes
ISO_OVERRIDES = {
    'TZA': 'TZA',  # Tanzania (covers both Mainland & Zanzibar)
}

# Tanzania split: share population proportionally (~97% mainland, ~3% zanzibar)
TANZANIA_MAINLAND_SHARE = 0.97
TANZANIA_ZANZIBAR_SHARE = 0.03


class Command(BaseCommand):
    help = 'Fetch population from World Bank API and update CHW countries'

    def handle(self, *args, **options):
        # Bypass RLS
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.current_tenant', '0', false)")

        countries = Country.objects.all()
        iso_codes = set()
        for c in countries:
            if c.iso_code:
                iso_codes.add(c.iso_code.upper())

        self.stdout.write(f'Fetching population for {len(iso_codes)} unique ISO codes: {sorted(iso_codes)}')

        # Fetch from World Bank API (latest available year)
        iso_str = ';'.join(sorted(iso_codes))
        url = f'https://api.worldbank.org/v2/country/{iso_str}/indicator/SP.POP.TOTL?date=2023&format=json&per_page=100'

        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'API request failed: {e}'))
            return

        if len(data) < 2:
            self.stdout.write(self.style.ERROR(f'No data returned from World Bank API'))
            return

        # Build ISO3 → population map
        pop_map = {}
        for entry in data[1]:
            if entry and entry.get('value'):
                iso3 = entry.get('countryiso3code', entry['country']['id'])
                pop_map[iso3] = int(entry['value'])
                self.stdout.write(f"  API: {iso3} = {int(entry['value']):,}")

        # Update DB
        updated = 0
        with transaction.atomic():
            for c in countries:
                iso = c.iso_code.upper() if c.iso_code else ''
                if not iso:
                    continue

                pop = pop_map.get(iso, 0)
                if pop <= 0:
                    self.stdout.write(self.style.WARNING(f'  ✗ No population for {c.country} ({iso})'))
                    continue

                # Handle Tanzania split
                if iso == 'TZA' and 'zanzibar' in c.country.lower():
                    pop = int(pop * TANZANIA_ZANZIBAR_SHARE)
                elif iso == 'TZA' and 'mainland' in c.country.lower():
                    pop = int(pop * TANZANIA_MAINLAND_SHARE)

                c.population_2024 = pop
                if pop > 0 and c.total_chws > 0:
                    c.chws_per_10000 = round((c.total_chws / pop) * 10000, 2)
                c.save()
                updated += 1
                self.stdout.write(f'  ✓ {c.country}: pop={pop:,} → CHW/10k={c.chws_per_10000}')

        self.stdout.write(self.style.SUCCESS(f'\nUpdated population for {updated}/{countries.count()} countries.'))
