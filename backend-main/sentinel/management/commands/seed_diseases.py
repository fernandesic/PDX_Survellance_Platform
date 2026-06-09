"""
Management command to seed the DiseaseKeyword table with multilingual keywords.
Ported from AFRO-SENTINEL ingest-signals edge function.
"""

from django.core.management.base import BaseCommand
from sentinel.models import DiseaseKeyword, DiseaseCategory, SignalPriority


DISEASE_KEYWORDS_DATA = [
    {
        "disease_name": "Cholera",
        "category": DiseaseCategory.ENTERIC,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["cholera", "watery diarrhea", "acute diarrhea", "awd"],
        "keywords_fr": ["choléra", "diarrhée aqueuse"],
        "keywords_ha": ["zawo", "ciwon hanji", "gudawa", "zawo ruwa"],
        "keywords_yo": ["gbuuru", "igbe gbuuru", "àrùn gbuuru olomi"],
        "keywords_sw": ["kipindupindu", "kuhara maji", "kuharisha"],
        "keywords_ar": ["الكوليرا", "إسهال مائي"],
    },
    {
        "disease_name": "Ebola",
        "category": DiseaseCategory.VHF,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["ebola", "hemorrhagic fever", "bleeding", "evd"],
        "keywords_fr": ["ebola", "fièvre hémorragique"],
        "keywords_ha": ["ebola", "zazzabin zubar jini", "cutar zubar jini"],
        "keywords_yo": ["ebola", "ibà ẹjẹ", "àrùn ẹjẹ sísàn"],
        "keywords_sw": ["ebola", "homa ya kutoka damu"],
        "keywords_ar": ["إيبولا"],
    },
    {
        "disease_name": "Marburg",
        "category": DiseaseCategory.VHF,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["marburg", "marburg virus", "hemorrhagic", "mvd"],
        "keywords_fr": ["marburg", "virus de marburg"],
        "keywords_ha": ["marburg", "cutar marburg"],
        "keywords_sw": ["marburg", "virusi ya marburg"],
    },
    {
        "disease_name": "Lassa Fever",
        "category": DiseaseCategory.VHF,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["lassa", "lassa fever", "rodent fever"],
        "keywords_fr": ["fièvre de lassa"],
        "keywords_ha": ["zazzabin lassa", "cutar lassa", "zazzabin bera"],
        "keywords_yo": ["ibà lassa", "àrùn lassa"],
        "keywords_sw": ["homa ya lassa"],
    },
    {
        "disease_name": "Yellow Fever",
        "category": DiseaseCategory.VHF,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["yellow fever", "jaundice", "flavivirus"],
        "keywords_fr": ["fièvre jaune", "jaunisse"],
        "keywords_ha": ["zazzabin rawaya", "cutar rawaya"],
        "keywords_yo": ["ibà pupa", "àrùn awọ ofeefee"],
        "keywords_sw": ["homa ya manjano"],
    },
    {
        "disease_name": "Mpox",
        "category": DiseaseCategory.ZOONOTIC,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["mpox", "monkeypox", "pox", "clade"],
        "keywords_fr": ["variole du singe", "mpox"],
        "keywords_ha": ["mpox", "agana", "cutar agana"],
        "keywords_yo": ["mpox", "àrùn ọbọ"],
        "keywords_sw": ["mpox", "ndui ya nyani"],
    },
    {
        "disease_name": "Measles",
        "category": DiseaseCategory.VACCINE_PREVENTABLE,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["measles", "rubeola", "rash"],
        "keywords_fr": ["rougeole"],
        "keywords_ha": ["kyanda", "cutar kyanda"],
        "keywords_yo": ["igbonwo", "àrùn igbonwo"],
        "keywords_sw": ["surua", "chokaa", "upele"],
    },
    {
        "disease_name": "Polio",
        "category": DiseaseCategory.VACCINE_PREVENTABLE,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["polio", "poliomyelitis", "paralysis", "afp"],
        "keywords_fr": ["polio", "poliomyélite"],
        "keywords_ha": ["shan inna", "cutar gurguzu"],
        "keywords_yo": ["roparose", "àrùn ẹsẹ rírọ"],
        "keywords_sw": ["polio", "kupooza"],
    },
    {
        "disease_name": "Meningococcal Disease",
        "category": DiseaseCategory.VACCINE_PREVENTABLE,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["meningitis", "meningococcal", "stiff neck"],
        "keywords_fr": ["méningite"],
        "keywords_ha": ["sankarau", "cutar sankarau", "wuyan taurin"],
        "keywords_yo": ["àrùn ọpọlọ", "orí wíwọ"],
        "keywords_sw": ["homa ya uti wa mgongo", "shingo kavu"],
    },
    {
        "disease_name": "Malaria",
        "category": DiseaseCategory.VECTOR_BORNE,
        "default_priority": SignalPriority.P3,
        "keywords_en": ["malaria", "plasmodium"],
        "keywords_fr": ["paludisme", "malaria"],
        "keywords_ha": ["zazzabin cizon sauro", "malariya"],
        "keywords_yo": ["ibà", "arun efon"],
        "keywords_sw": ["malaria", "homa ya malaria"],
    },
    {
        "disease_name": "Dengue",
        "category": DiseaseCategory.VECTOR_BORNE,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["dengue", "breakbone fever"],
        "keywords_fr": ["dengue"],
        "keywords_ha": ["zazzabin dengue"],
        "keywords_sw": ["homa ya dengue"],
    },
    {
        "disease_name": "Plague",
        "category": DiseaseCategory.ZOONOTIC,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["plague", "bubonic", "pneumonic plague"],
        "keywords_fr": ["peste"],
        "keywords_ha": ["annoba", "cutar annoba"],
        "keywords_yo": ["àjàkálẹ̀ àrùn"],
        "keywords_sw": ["tauni", "pigo"],
    },
    {
        "disease_name": "Typhoid Fever",
        "category": DiseaseCategory.ENTERIC,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["typhoid", "enteric fever"],
        "keywords_fr": ["fièvre typhoïde"],
        "keywords_ha": ["zazzabin typhoid", "taifo"],
        "keywords_sw": ["homa ya matumbo", "taifodi"],
    },
    {
        "disease_name": "Rabies",
        "category": DiseaseCategory.ZOONOTIC,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["rabies", "hydrophobia", "dog bite"],
        "keywords_fr": ["rage"],
        "keywords_ha": ["haukan kare", "cutar kare"],
        "keywords_yo": ["aja wèrè", "igbẹ aja"],
        "keywords_sw": ["kichaa cha mbwa"],
    },
    {
        "disease_name": "Anthrax",
        "category": DiseaseCategory.ZOONOTIC,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["anthrax", "bacillus anthracis"],
        "keywords_fr": ["anthrax", "charbon"],
        "keywords_ha": ["cutar anthrax"],
        "keywords_sw": ["kimeta"],
    },
    {
        "disease_name": "Rift Valley Fever",
        "category": DiseaseCategory.VHF,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["rift valley fever", "rvf"],
        "keywords_fr": ["fièvre de la vallée du rift"],
        "keywords_ha": ["zazzabin rift valley"],
        "keywords_sw": ["homa ya bonde la ufa"],
    },
    {
        "disease_name": "COVID-19",
        "category": DiseaseCategory.RESPIRATORY,
        "default_priority": SignalPriority.P3,
        "keywords_en": ["covid", "coronavirus", "sars-cov-2"],
        "keywords_fr": ["covid", "coronavirus"],
        "keywords_ha": ["covid", "korona", "cutar korona"],
        "keywords_sw": ["covid", "korona"],
    },
    {
        "disease_name": "Diphtheria",
        "category": DiseaseCategory.VACCINE_PREVENTABLE,
        "default_priority": SignalPriority.P1,
        "keywords_en": ["diphtheria", "corynebacterium"],
        "keywords_fr": ["diphtérie"],
        "keywords_ha": ["cutar makogwaro"],
        "keywords_sw": ["dondakoo", "diphtheria"],
    },
    {
        "disease_name": "Chikungunya",
        "category": DiseaseCategory.VECTOR_BORNE,
        "default_priority": SignalPriority.P2,
        "keywords_en": ["chikungunya", "chik", "joint fever"],
        "keywords_fr": ["chikungunya"],
        "keywords_sw": ["homa ya chikungunya"],
    },
]


class Command(BaseCommand):
    help = 'Seed the DiseaseKeyword table with multilingual disease keywords'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        
        for disease_data in DISEASE_KEYWORDS_DATA:
            disease_name = disease_data.pop("disease_name")
            obj, created = DiseaseKeyword.objects.update_or_create(
                disease_name=disease_name,
                defaults=disease_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {disease_name}'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated: {disease_name}')
        
        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Created: {created_count}, Updated: {updated_count}'
        ))
