from datetime import date
from django.db import transaction
from ihmref.models import IhmrefCategory, IhmrefCountry, IhmrefData, CountryIncident
import json
from pathlib import Path

BASE_DIR = Path.cwd()
file_path = BASE_DIR / "ihmref.json"
data = json.loads(file_path.read_text())

def get_country(country_name, full_name=""):
    country, _ = IhmrefCountry.objects.get_or_create(
        country=country_name,
        defaults={"full_name": full_name or country_name}
    )
    return country

def parse_date(value):
    if not value:
        return None
    return date.fromisoformat(value)

created = 0

with transaction.atomic():
    for key, data_block in data.items():
        category = IhmrefCategory.objects.get(category=key)
        for year, incidents in data_block.items():
                ihmref_data = IhmrefData.objects.get(category=category, year=str(year))
                for item in incidents:
                    country_obj = get_country(
                        item["country"],
                        item.get("full_name", "")
                    )
                    CountryIncident.objects.create(
                        country=country_obj,
                        ihmref_data=ihmref_data,
                        # state=item.get("state", ""),
                        incident=item["incident"],
                        start_date=parse_date(item["start_date"]),
                        end_date=parse_date(item["end_date"]),
                    )
                    created += 1

print(f"Imported {created} incidents")