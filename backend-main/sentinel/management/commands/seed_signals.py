"""
Management command to seed the Signal table with realistic sample data.
Real disease outbreak examples from African regions.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random

from sentinel.models import Signal, SignalPriority, SignalStatus, DiseaseCategory
from utils.tenant_resolver import resolve_tenant


# Realistic sample signals based on actual African outbreak patterns
SAMPLE_SIGNALS = [
    {
        "disease_name": "Cholera",
        "disease_category": DiseaseCategory.ENTERIC,
        "location_country": "Nigeria",
        "location_country_iso": "NGA",
        "location_admin1": "Borno",
        "location_lat": 11.8333,
        "location_lng": 13.1500,
        "original_text": "Health authorities in Borno State confirm 127 cases of acute watery diarrhea in Maiduguri IDP camps. 4 deaths reported. Emergency response team deployed. Oral rehydration supplies being distributed.",
        "original_language": "en",
        "priority": SignalPriority.P1,
        "confidence_score": 92,
        "source_name": "Nigeria CDC",
        "source_tier": 1,
        "reported_cases": 127,
        "reported_deaths": 4,
    },
    {
        "disease_name": "Mpox",
        "disease_category": DiseaseCategory.ZOONOTIC,
        "location_country": "Democratic Republic of Congo",
        "location_country_iso": "COD",
        "location_admin1": "South Kivu",
        "location_lat": -2.5083,
        "location_lng": 28.8608,
        "original_text": "Nouveau cas de variole du singe confirmé à Bukavu. Total de 43 cas cette semaine dans la province du Sud-Kivu. Les autorités sanitaires renforcent la surveillance aux frontières.",
        "original_language": "fr",
        "translated_text": "New monkeypox case confirmed in Bukavu. Total of 43 cases this week in South Kivu province. Health authorities strengthening border surveillance.",
        "priority": SignalPriority.P1,
        "confidence_score": 88,
        "source_name": "DRC Ministry of Health",
        "source_tier": 1,
        "reported_cases": 43,
        "reported_deaths": 2,
    },
    {
        "disease_name": "Measles",
        "disease_category": DiseaseCategory.VACCINE_PREVENTABLE,
        "location_country": "Ethiopia",
        "location_country_iso": "ETH",
        "location_admin1": "Somali Region",
        "location_lat": 5.9631,
        "location_lng": 43.7903,
        "original_text": "Measles outbreak reported in Jijiga zone affecting unvaccinated children. 234 suspected cases, 12 confirmed. Vaccination campaign being organized in coordination with WHO AFRO.",
        "original_language": "en",
        "priority": SignalPriority.P2,
        "confidence_score": 85,
        "source_name": "Ethiopia EPHI",
        "source_tier": 1,
        "reported_cases": 234,
        "reported_deaths": 3,
    },
    {
        "disease_name": "Yellow Fever",
        "disease_category": DiseaseCategory.VHF,
        "location_country": "Uganda",
        "location_country_iso": "UGA",
        "location_admin1": "Buliisa",
        "location_lat": 2.1167,
        "location_lng": 31.4167,
        "original_text": "Yellow fever cases detected in Buliisa district near Lake Albert. 8 confirmed cases with 2 fatalities. Cross-border alert issued to DRC. Reactive vaccination planned.",
        "original_language": "en",
        "priority": SignalPriority.P1,
        "confidence_score": 95,
        "source_name": "Uganda MoH",
        "source_tier": 1,
        "reported_cases": 8,
        "reported_deaths": 2,
        "cross_border_risk": True,
    },
    {
        "disease_name": "Meningococcal Disease",
        "disease_category": DiseaseCategory.VACCINE_PREVENTABLE,
        "location_country": "Niger",
        "location_country_iso": "NER",
        "location_admin1": "Zinder",
        "location_lat": 13.8053,
        "location_lng": 8.9883,
        "original_text": "An ya samu rahoton cutar sankarau a yankin Zinder. Mutane 156 sun kamu da cutar, 23 sun mutu. Hukumomin kiwon lafiya sun fara yakin rigakafin.",
        "original_language": "ha",
        "translated_text": "Meningitis outbreak reported in Zinder region. 156 people infected, 23 deaths. Health authorities launching vaccination campaign.",
        "priority": SignalPriority.P1,
        "confidence_score": 90,
        "source_name": "Niger DSRE",
        "source_tier": 1,
        "reported_cases": 156,
        "reported_deaths": 23,
    },
    {
        "disease_name": "Lassa Fever",
        "disease_category": DiseaseCategory.VHF,
        "location_country": "Nigeria",
        "location_country_iso": "NGA",
        "location_admin1": "Ondo",
        "location_lat": 7.2500,
        "location_lng": 5.1931,
        "original_text": "Lassa fever cases rising in Ondo State. 67 confirmed cases this month with CFR of 18%. Akure teaching hospital activated isolation ward. Rodent control measures advised.",
        "original_language": "en",
        "priority": SignalPriority.P1,
        "confidence_score": 94,
        "source_name": "NCDC Nigeria",
        "source_url": "https://ncdc.gov.ng",
        "source_tier": 1,
        "reported_cases": 67,
        "reported_deaths": 12,
    },
    {
        "disease_name": "Cholera",
        "disease_category": DiseaseCategory.ENTERIC,
        "location_country": "Mozambique",
        "location_country_iso": "MOZ",
        "location_admin1": "Sofala",
        "location_lat": -19.8386,
        "location_lng": 34.8389,
        "original_text": "Surto de cólera em Beira após inundações. 312 casos notificados, 7 óbitos. Centros de tratamento de cólera estabelecidos. Distribuição de água potável em andamento.",
        "original_language": "pt",
        "translated_text": "Cholera outbreak in Beira after flooding. 312 cases reported, 7 deaths. Cholera treatment centers established. Clean water distribution underway.",
        "priority": SignalPriority.P1,
        "confidence_score": 91,
        "source_name": "Mozambique MISAU",
        "source_tier": 1,
        "reported_cases": 312,
        "reported_deaths": 7,
    },
    {
        "disease_name": "Dengue",
        "disease_category": DiseaseCategory.VECTOR_BORNE,
        "location_country": "Kenya",
        "location_country_iso": "KEN",
        "location_admin1": "Mombasa",
        "location_lat": -4.0435,
        "location_lng": 39.6682,
        "original_text": "Homa ya dengue inasambaa Mombasa. Wagonjwa 89 wamethibitishwa hospitali kuu. Serikali inashauri watu kuzuia mbu kuzaliana.",
        "original_language": "sw",
        "translated_text": "Dengue fever spreading in Mombasa. 89 patients confirmed at main hospital. Government advising people to prevent mosquito breeding.",
        "priority": SignalPriority.P2,
        "confidence_score": 82,
        "source_name": "Kenya MoH",
        "source_tier": 1,
        "reported_cases": 89,
        "reported_deaths": 1,
    },
    {
        "disease_name": "Malaria",
        "disease_category": DiseaseCategory.VECTOR_BORNE,
        "location_country": "Ghana",
        "location_country_iso": "GHA",
        "location_admin1": "Upper West",
        "location_lat": 10.3333,
        "location_lng": -2.0833,
        "original_text": "Seasonal malaria surge in Upper West Region. OPD cases up 45% from baseline. Bed net distribution campaign launched. ACT stocks being replenished at health facilities.",
        "original_language": "en",
        "priority": SignalPriority.P3,
        "confidence_score": 78,
        "source_name": "Ghana Health Service",
        "source_tier": 1,
        "reported_cases": 2340,
        "reported_deaths": 15,
    },
    {
        "disease_name": "Polio",
        "disease_category": DiseaseCategory.VACCINE_PREVENTABLE,
        "location_country": "Cameroon",
        "location_country_iso": "CMR",
        "location_admin1": "Far North",
        "location_lat": 10.5833,
        "location_lng": 14.3167,
        "original_text": "Cas de poliomyélite dérivé du vaccin détecté dans la région de l'Extrême-Nord. Campagne de vaccination d'urgence prévue. Surveillance de la paralysie flasque aiguë renforcée.",
        "original_language": "fr",
        "translated_text": "Vaccine-derived poliovirus case detected in Far North region. Emergency vaccination campaign planned. Acute flaccid paralysis surveillance enhanced.",
        "priority": SignalPriority.P1,
        "confidence_score": 96,
        "source_name": "Cameroon MoH",
        "source_tier": 1,
        "reported_cases": 1,
        "reported_deaths": 0,
        "cross_border_risk": True,
    },
    {
        "disease_name": "Rabies",
        "disease_category": DiseaseCategory.ZOONOTIC,
        "location_country": "Tanzania",
        "location_country_iso": "TZA",
        "location_admin1": "Serengeti",
        "location_lat": -2.3333,
        "location_lng": 34.8333,
        "original_text": "Watu watatu wamefariki kwa kichaa cha mbwa Serengeti. Uchunguzi unaendelea. Chanjo ya mbwa imetolewa bure kwa wakazi.",
        "original_language": "sw",
        "translated_text": "Three people died of rabies in Serengeti. Investigation ongoing. Free dog vaccination provided to residents.",
        "priority": SignalPriority.P2,
        "confidence_score": 85,
        "source_name": "Tanzania MoH",
        "source_tier": 1,
        "reported_cases": 3,
        "reported_deaths": 3,
    },
    {
        "disease_name": "Typhoid Fever",
        "disease_category": DiseaseCategory.ENTERIC,
        "location_country": "Zimbabwe",
        "location_country_iso": "ZWE",
        "location_admin1": "Harare",
        "location_lat": -17.8292,
        "location_lng": 31.0522,
        "original_text": "Typhoid cases increasing in Harare suburbs with water supply issues. 456 cases in Budiriro and Mbare. Water treatment being improved. Boil water advisory issued.",
        "original_language": "en",
        "priority": SignalPriority.P2,
        "confidence_score": 80,
        "source_name": "Zimbabwe MoHCC",
        "source_tier": 1,
        "reported_cases": 456,
        "reported_deaths": 5,
    },
]


class Command(BaseCommand):
    help = 'Seed the Signal table with realistic African disease outbreak samples'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing signals before seeding')

    def handle(self, *args, **options):
        if options['clear']:
            count = Signal.objects.count()
            Signal.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing signals'))

        created_count = 0
        for i, signal_data in enumerate(SAMPLE_SIGNALS):
            # Randomize dates (last 7 days)
            days_ago = random.randint(0, 7)
            hours_ago = random.randint(0, 23)
            created_at = timezone.now() - timedelta(days=days_ago, hours=hours_ago)
            
            signal = Signal.objects.create(
                signal_type='disease',
                status=random.choice([SignalStatus.NEW, SignalStatus.TRIAGED, SignalStatus.VALIDATED]),
                created_at=created_at,
                updated_at=created_at,
                ingestion_source='seed_command',
                tenant=resolve_tenant(iso=signal_data.get('location_country_iso')),
                **signal_data
            )
            created_count += 1
            self.stdout.write(
                f"Created: [{signal.priority}] {signal.disease_name} - {signal.location_country} ({signal.reported_cases} cases)"
            )

        self.stdout.write(self.style.SUCCESS(f'\n✅ Created {created_count} sample signals'))
        
        # Show stats
        from django.db.models import Sum
        total_cases = Signal.objects.aggregate(Sum('reported_cases'))['reported_cases__sum'] or 0
        total_deaths = Signal.objects.aggregate(Sum('reported_deaths'))['reported_deaths__sum'] or 0
        self.stdout.write(f"   Total cases: {total_cases}")
        self.stdout.write(f"   Total deaths: {total_deaths}")
