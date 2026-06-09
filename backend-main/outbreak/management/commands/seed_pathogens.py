"""
Seed Pathogen reference cards from onehealth/spillover_engine.py profiles.

Idempotent: running twice creates zero new rows.

Usage:
    python manage.py seed_pathogens
"""

from django.core.management.base import BaseCommand

from outbreak.models import Pathogen


# Profiles extracted from onehealth/spillover_engine.py PATHOGEN_PROFILES
PATHOGEN_SEEDS = [
    {
        'name': 'Ebola Virus Disease',
        'family': 'Filoviridae',
        'r0_min': 1.5,
        'r0_max': 2.5,
        'cfr_min': 25.0,
        'cfr_max': 90.0,
        'incubation_days_min': 2,
        'incubation_days_max': 21,
        'transmission_modes': ['contact', 'droplet', 'fomite', 'bodily_fluids'],
        'vaccine_available': False,  # Bundibugyo strain — NO approved vaccine
        'antiviral_available': False,  # No approved therapeutics for BDBV
        'monitor_widgets': [
            'capacity', 'spillover', 'burial', 'hcw', 'silence',
            'mobility', 'deforestation', 'animal',
        ],
        'profile_json': {
            'spillover_score': 82,
            'domain': 'zoonotic',
            'priority': 'P1',
            'ihr_notifiable': True,
            'woah_listed': False,
            'natural_hosts': ['bats', 'primates'],
            'reservoir': 'Fruit bats (suspected)',
            'trigger_env_conditions': [
                'deforestation_alert',
                'bushmeat_market_presence',
                'high_bat_species',
            ],
            'trigger_season_months': [3, 4, 5, 9, 10, 11],
            # Default strain to display for outbreaks of this pathogen when
            # the outbreak does not carry its own strain hint. The current
            # PHEIC is BDBV — change here when the dominant strain changes.
            'primary_strain': 'bundibugyo',
            # Per-pathogen SEIRDV defaults used by the Ahead-pane scenario
            # runner. Frontend reads pathogen.profile_json.scenario_defaults
            # and falls back to its own constants only if this is absent.
            # Calibrated for BDBV: R0≈1.7, CFR~30%, 8d incubation, 12d infectious.
            'scenario_defaults': {
                'beta': 0.18,
                'sigma': 0.125,        # 1/8 — 8-day incubation
                'gamma': 0.0833,       # 1/12 — 12-day infectious period
                'mu': 0.30,            # CFR ~30%
                'interv_delay': 14,
                'interv_efficacy': 0.4,
                'n_populations': 3,
                'ini_S': [500000, 200000, 100000],
                'ini_I': [10, 2, 0],
                'time': 180,
                'n_sims': 5,
                'population_labels': ['DRC', 'UGA', 'COG'],
            },
            'strains': {
                'zaire': {
                    'cfr_range': [40, 90],
                    'vaccine_available': True,
                    'vaccine_name': 'rVSV-ZEBOV (Ervebo)',
                    'therapeutics': ['mAb114 (Ebanga)', 'REGN-EB3 (Inmazeb)'],
                },
                'bundibugyo': {
                    'cfr_range': [25, 34],
                    'vaccine_available': False,
                    'vaccine_name': None,
                    'therapeutics': [],
                    'note': 'No approved vaccines or therapeutics. rVSV-ZEBOV does NOT protect against BDBV.',
                },
                'sudan': {
                    'cfr_range': [41, 65],
                    'vaccine_available': False,
                    'vaccine_name': None,
                    'therapeutics': [],
                },
            },
            'key_warning': (
                'Current PHEIC (May 2026) is caused by Bundibugyo ebolavirus (BDBV). '
                'Existing Zaire-targeted vaccines (rVSV-ZEBOV) do NOT protect against BDBV. '
                'Response must rely on non-pharmaceutical interventions: IPC, contact tracing, '
                'safe and dignified burial, RCCE.'
            ),
            'response_protocols': [
                {
                    'label': 'NO VACCINE AVAILABLE',
                    'priority': 'critical',
                    'text': (
                        'rVSV-ZEBOV (Ervebo) does NOT protect against BDBV. '
                        'Response MUST rely entirely on non-pharmaceutical interventions.'
                    ),
                },
                {
                    'label': 'IPC',
                    'priority': 'standard',
                    'text': (
                        'Standard + contact + droplet precautions in all healthcare settings. '
                        'PPE: gown, gloves, face shield, N95 respirator minimum.'
                    ),
                },
                {
                    'label': 'Contact tracing',
                    'priority': 'standard',
                    'text': (
                        '21-day follow-up for all contacts of confirmed/probable cases. '
                        'Daily active monitoring with temperature checks.'
                    ),
                },
                {
                    'label': 'Safe & Dignified Burial',
                    'priority': 'standard',
                    'text': (
                        'Trained SDB teams for all deceased suspected/confirmed cases. '
                        'Community engagement essential for compliance.'
                    ),
                },
                {
                    'label': 'RCCE',
                    'priority': 'standard',
                    'text': (
                        'Risk Communication and Community Engagement in FR/Lingala/Swahili/Nande. '
                        'Address rumour management through community health workers.'
                    ),
                },
                {
                    'label': 'Isolation',
                    'priority': 'standard',
                    'text': (
                        'Immediate isolation of suspected cases pending RT-PCR lab confirmation. '
                        'ETCs (Ebola Treatment Centres) required in affected districts.'
                    ),
                },
                {
                    'label': 'PoE Screening',
                    'priority': 'standard',
                    'text': (
                        'Points of Entry screening at borders with UGA, RWA, BDI, SSD. '
                        'Temperature + symptom questionnaire + travel history.'
                    ),
                },
                {
                    'label': 'Lab',
                    'priority': 'standard',
                    'text': (
                        'RT-PCR confirmation within 48h of sample collection. '
                        'Biosafety Level 4 protocols for viral culture.'
                    ),
                },
            ],
        },
    },
    {
        'name': 'Marburg Virus Disease',
        'family': 'Filoviridae',
        'r0_min': 1.0,
        'r0_max': 1.5,
        'cfr_min': 24.0,
        'cfr_max': 88.0,
        'incubation_days_min': 2,
        'incubation_days_max': 21,
        'transmission_modes': ['contact', 'bodily_fluids'],
        'vaccine_available': False,
        'antiviral_available': False,
        'monitor_widgets': [
            'capacity', 'spillover', 'burial', 'hcw', 'silence', 'animal',
        ],
        'profile_json': {
            'spillover_score': 78,
            'domain': 'zoonotic',
            'priority': 'P1',
            'ihr_notifiable': True,
            'natural_hosts': ['bats'],
            'reservoir': 'Rousettus aegyptiacus (Egyptian fruit bat)',
        },
    },
    {
        'name': 'Cholera',
        'family': 'Vibrionaceae',
        'r0_min': 1.0,
        'r0_max': 4.0,
        'cfr_min': 0.1,
        'cfr_max': 3.0,
        'incubation_days_min': 1,
        'incubation_days_max': 5,
        'transmission_modes': ['waterborne', 'fecal_oral'],
        'vaccine_available': True,
        'antiviral_available': False,
        'monitor_widgets': [
            'capacity', 'climate', 'mobility', 'silence',
        ],
        'profile_json': {
            'domain': 'waterborne',
            'priority': 'P2',
            'ihr_notifiable': True,
            'vaccine_name': 'OCV (Shanchol, Euvichol)',
        },
    },
    {
        'name': 'Mpox (Clade I)',
        'family': 'Poxviridae',
        'r0_min': 1.0,
        'r0_max': 2.4,
        'cfr_min': 1.0,
        'cfr_max': 10.0,
        'incubation_days_min': 5,
        'incubation_days_max': 21,
        'transmission_modes': ['contact', 'droplet', 'fomite'],
        'vaccine_available': True,
        'antiviral_available': True,
        'monitor_widgets': [
            'capacity', 'spillover', 'hcw', 'mobility', 'silence',
        ],
        'profile_json': {
            'spillover_score': 71,
            'domain': 'zoonotic',
            'priority': 'P1',
            'ihr_notifiable': True,
            'vaccine_name': 'MVA-BN (Jynneos)',
            'antiviral_name': 'Tecovirimat (TPOXX)',
        },
    },
]


class Command(BaseCommand):
    help = 'Seed Pathogen reference cards from spillover_engine profiles. Idempotent.'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for seed in PATHOGEN_SEEDS:
            name = seed['name']
            defaults = {k: v for k, v in seed.items() if k != 'name'}

            obj, created = Pathogen.objects.update_or_create(
                name=name,
                defaults=defaults,
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {name}"))
            else:
                updated_count += 1
                self.stdout.write(f"  Updated: {name}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Created: {created_count}, Updated: {updated_count}"
        ))
