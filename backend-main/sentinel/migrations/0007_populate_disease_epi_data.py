"""
Data migration: Populate DiseaseKeyword epidemiological metadata.

All 19 disease records were created with only name + keywords.
This migration fills in case_fatality_rate, incubation periods,
symptoms, transmission routes, and endemic regions.

Source: WHO fact sheets, CDC disease pages, Merck Manual.
"""

from django.db import migrations


DISEASE_EPI_DATA = {
    'Cholera': {
        'case_fatality_rate': 1.5,
        'incubation_days_min': 1,
        'incubation_days_max': 5,
        'symptoms_cluster': ['Severe watery diarrhea', 'Dehydration', 'Vomiting', 'Muscle cramps', 'Rapid heart rate'],
        'transmission_routes': ['Waterborne', 'Fecal-oral', 'Contaminated food', 'Poor sanitation'],
        'endemic_regions': ['West Africa', 'East Africa', 'South Asia', 'Haiti'],
    },
    'Ebola': {
        'case_fatality_rate': 50,
        'incubation_days_min': 2,
        'incubation_days_max': 21,
        'symptoms_cluster': ['Hemorrhagic fever', 'Vomiting', 'Diarrhea', 'Internal/external bleeding', 'Fatigue', 'Multi-organ failure'],
        'transmission_routes': ['Direct contact (body fluids)', 'Contaminated surfaces', 'Burial practices', 'Healthcare settings'],
        'endemic_regions': ['Central Africa (DRC)', 'West Africa (Guinea, Liberia, Sierra Leone)'],
    },
    'Marburg': {
        'case_fatality_rate': 50,
        'incubation_days_min': 2,
        'incubation_days_max': 21,
        'symptoms_cluster': ['High fever', 'Severe headache', 'Hemorrhage', 'Malaise', 'Muscle pain', 'Watery diarrhea'],
        'transmission_routes': ['Direct contact (body fluids)', 'Fruit bats (Rousettus)', 'Contaminated equipment', 'Nosocomial'],
        'endemic_regions': ['East Africa (Uganda, Kenya)', 'Central Africa (DRC, Angola)', 'West Africa (Ghana, Guinea)'],
    },
    'Lassa Fever': {
        'case_fatality_rate': 15,
        'incubation_days_min': 6,
        'incubation_days_max': 21,
        'symptoms_cluster': ['Fever', 'Sore throat', 'Hemorrhage', 'Facial swelling', 'Tremor', 'Hearing loss'],
        'transmission_routes': ['Rodent contact (Mastomys natalensis)', 'Person-to-person (body fluids)', 'Contaminated food/surfaces'],
        'endemic_regions': ['West Africa (Nigeria, Sierra Leone, Guinea, Liberia, Mali, Benin)'],
    },
    'Yellow Fever': {
        'case_fatality_rate': 20,
        'incubation_days_min': 3,
        'incubation_days_max': 6,
        'symptoms_cluster': ['Fever', 'Jaundice', 'Hemorrhage', 'Organ failure', 'Back pain', 'Nausea'],
        'transmission_routes': ['Mosquito bite (Aedes aegypti)', 'Sylvatic cycle (Haemagogus)', 'Urban cycle'],
        'endemic_regions': ['West Africa', 'Central Africa', 'South America (Amazon basin)'],
    },
    'Mpox': {
        'case_fatality_rate': 3.6,
        'incubation_days_min': 5,
        'incubation_days_max': 21,
        'symptoms_cluster': ['Skin rash/lesions', 'Fever', 'Lymphadenopathy', 'Muscle aches', 'Headache', 'Exhaustion'],
        'transmission_routes': ['Direct contact (skin lesions)', 'Respiratory droplets', 'Contaminated materials', 'Animal contact'],
        'endemic_regions': ['Central Africa (DRC, Cameroon)', 'West Africa (Nigeria)', 'Global (Clade IIb 2022+)'],
    },
    'Measles': {
        'case_fatality_rate': 2,
        'incubation_days_min': 10,
        'incubation_days_max': 14,
        'symptoms_cluster': ['Fever', 'Maculopapular rash', 'Cough', 'Conjunctivitis', 'Koplik spots', 'Coryza'],
        'transmission_routes': ['Airborne (highly contagious)', 'Droplet', 'Direct contact'],
        'endemic_regions': ['Sub-Saharan Africa', 'South Asia', 'South-East Asia'],
    },
    'Polio': {
        'case_fatality_rate': 5,
        'incubation_days_min': 3,
        'incubation_days_max': 35,
        'symptoms_cluster': ['Acute flaccid paralysis', 'Fever', 'Limb weakness', 'Meningitis', 'Fatigue'],
        'transmission_routes': ['Fecal-oral', 'Contaminated water', 'Person-to-person'],
        'endemic_regions': ['Afghanistan', 'Pakistan', 'Parts of Africa (cVDPV2 outbreaks)'],
    },
    'Meningococcal Disease': {
        'case_fatality_rate': 10,
        'incubation_days_min': 2,
        'incubation_days_max': 10,
        'symptoms_cluster': ['Stiff neck', 'High fever', 'Severe headache', 'Confusion', 'Photophobia', 'Petechial rash'],
        'transmission_routes': ['Respiratory droplets', 'Close/prolonged contact', 'Crowded living conditions'],
        'endemic_regions': ['Meningitis Belt (Sahel — Senegal to Ethiopia)', 'Sub-Saharan Africa'],
    },
    'Malaria': {
        'case_fatality_rate': 0.3,
        'incubation_days_min': 7,
        'incubation_days_max': 30,
        'symptoms_cluster': ['Cyclical fever', 'Chills/rigors', 'Headache', 'Anemia', 'Splenomegaly', 'Fatigue'],
        'transmission_routes': ['Mosquito bite (Anopheles)', 'Blood transfusion', 'Congenital', 'Needle sharing'],
        'endemic_regions': ['Sub-Saharan Africa (90%+ of cases)', 'South-East Asia', 'Central/South America'],
    },
    'Dengue': {
        'case_fatality_rate': 2.5,
        'incubation_days_min': 4,
        'incubation_days_max': 10,
        'symptoms_cluster': ['High fever', 'Severe headache', 'Retro-orbital pain', 'Joint/muscle pain', 'Rash', 'Hemorrhage (severe dengue)'],
        'transmission_routes': ['Mosquito bite (Aedes aegypti)', 'Aedes albopictus'],
        'endemic_regions': ['Tropical Africa', 'South-East Asia', 'Americas', 'Western Pacific'],
    },
    'Plague': {
        'case_fatality_rate': 30,
        'incubation_days_min': 1,
        'incubation_days_max': 7,
        'symptoms_cluster': ['Swollen lymph nodes (buboes)', 'Pneumonia (pneumonic)', 'High fever', 'Sepsis', 'Necrosis'],
        'transmission_routes': ['Flea bites (Xenopsylla cheopis)', 'Respiratory droplets (pneumonic)', 'Direct contact with infected tissue'],
        'endemic_regions': ['Madagascar', 'DRC', 'Central Asia', 'Western USA'],
    },
    'Typhoid Fever': {
        'case_fatality_rate': 1,
        'incubation_days_min': 6,
        'incubation_days_max': 30,
        'symptoms_cluster': ['Sustained fever (stepladder pattern)', 'Headache', 'Abdominal pain', 'Rose spots', 'Constipation or diarrhea'],
        'transmission_routes': ['Fecal-oral', 'Contaminated water', 'Contaminated food', 'Chronic carriers'],
        'endemic_regions': ['Sub-Saharan Africa', 'South Asia', 'South-East Asia'],
    },
    'Rabies': {
        'case_fatality_rate': 99.9,
        'incubation_days_min': 20,
        'incubation_days_max': 90,
        'symptoms_cluster': ['Hydrophobia', 'Aerophobia', 'Agitation', 'Hallucinations', 'Paralysis', 'Encephalitis'],
        'transmission_routes': ['Animal bite (dog, bat)', 'Scratch from infected animal', 'Mucosal exposure to saliva'],
        'endemic_regions': ['Sub-Saharan Africa', 'South Asia', 'South-East Asia'],
    },
    'Anthrax': {
        'case_fatality_rate': 20,
        'incubation_days_min': 1,
        'incubation_days_max': 60,
        'symptoms_cluster': ['Skin lesions (cutaneous)', 'Respiratory distress (inhalation)', 'GI symptoms', 'Fever', 'Sepsis'],
        'transmission_routes': ['Contact with infected animals/products', 'Inhalation of spores', 'Ingestion of contaminated meat'],
        'endemic_regions': ['West Africa', 'Central Asia', 'Southern Africa'],
    },
    'Rift Valley Fever': {
        'case_fatality_rate': 1,
        'incubation_days_min': 2,
        'incubation_days_max': 6,
        'symptoms_cluster': ['Fever', 'Liver damage', 'Hemorrhagic fever', 'Encephalitis', 'Retinitis', 'Jaundice'],
        'transmission_routes': ['Mosquito bite (Aedes/Culex)', 'Contact with infected animal tissue/blood', 'Aerosolized blood'],
        'endemic_regions': ['East Africa (Kenya, Tanzania)', 'Southern Africa', 'West Africa', 'Arabian Peninsula'],
    },
    'COVID-19': {
        'case_fatality_rate': 1.0,
        'incubation_days_min': 2,
        'incubation_days_max': 14,
        'symptoms_cluster': ['Fever', 'Cough', 'Dyspnea', 'Fatigue', 'Anosmia/ageusia', 'Myalgia'],
        'transmission_routes': ['Respiratory droplets', 'Airborne (aerosol)', 'Contact with contaminated surfaces'],
        'endemic_regions': ['Global (pandemic)'],
    },
    'Diphtheria': {
        'case_fatality_rate': 10,
        'incubation_days_min': 2,
        'incubation_days_max': 5,
        'symptoms_cluster': ['Sore throat', 'Grey pseudomembrane', 'Fever', 'Neck swelling (bull neck)', 'Difficulty breathing', 'Myocarditis'],
        'transmission_routes': ['Respiratory droplets', 'Direct contact with skin lesions', 'Fomites'],
        'endemic_regions': ['Sub-Saharan Africa', 'South Asia', 'South-East Asia'],
    },
    'Chikungunya': {
        'case_fatality_rate': 0.1,
        'incubation_days_min': 3,
        'incubation_days_max': 7,
        'symptoms_cluster': ['High fever', 'Severe polyarthralgia', 'Rash', 'Headache', 'Muscle pain', 'Joint swelling'],
        'transmission_routes': ['Mosquito bite (Aedes aegypti)', 'Aedes albopictus', 'Rare: mother-to-child'],
        'endemic_regions': ['East Africa', 'Indian Ocean islands', 'South-East Asia', 'Americas'],
    },
}


def populate_epi_data(apps, schema_editor):
    DiseaseKeyword = apps.get_model('sentinel', 'DiseaseKeyword')
    updated = 0
    for name, epi in DISEASE_EPI_DATA.items():
        try:
            disease = DiseaseKeyword.objects.get(disease_name=name)
            disease.case_fatality_rate = epi['case_fatality_rate']
            disease.incubation_days_min = epi['incubation_days_min']
            disease.incubation_days_max = epi['incubation_days_max']
            disease.symptoms_cluster = epi['symptoms_cluster']
            disease.transmission_routes = epi['transmission_routes']
            disease.endemic_regions = epi['endemic_regions']
            disease.save()
            updated += 1
        except DiseaseKeyword.DoesNotExist:
            pass
    print(f'\n  -> Populated epidemiological data for {updated}/{len(DISEASE_EPI_DATA)} diseases')


def reverse_epi_data(apps, schema_editor):
    DiseaseKeyword = apps.get_model('sentinel', 'DiseaseKeyword')
    DiseaseKeyword.objects.filter(
        disease_name__in=list(DISEASE_EPI_DATA.keys())
    ).update(
        case_fatality_rate=None,
        incubation_days_min=None,
        incubation_days_max=None,
        symptoms_cluster=[],
        transmission_routes=[],
        endemic_regions=[],
    )


class Migration(migrations.Migration):

    dependencies = [
        ('sentinel', '0006_signal_ai_classification_signal_ai_classified_at_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_epi_data, reverse_epi_data),
    ]
