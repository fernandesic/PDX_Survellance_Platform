"""
Seed major Ebola historical episodes from WHO DON archives.

Manually curated — no LLM-generated text. Every row cites source URLs.
Idempotent: running twice creates zero duplicate rows.

Usage:
    python manage.py seed_ebola_history
"""

from django.core.management.base import BaseCommand

from outbreak.models import Pathogen, OutbreakHistoricalEpisode


EBOLA_EPISODES = [
    {
        'country': 'Guinea, Liberia, Sierra Leone',
        'country_iso3': 'GIN',
        'year_start': 2014,
        'year_end': 2016,
        'cases': 28616,
        'deaths': 11310,
        'response_summary': (
            'Largest Ebola outbreak in history. Started in Guinea Dec 2013, '
            'spread to Liberia, Sierra Leone, and caused imported cases in '
            'Nigeria, Mali, Senegal, USA, UK, Spain, Italy. WHO declared PHEIC '
            'on 8 Aug 2014. Response involved unprecedented international '
            'mobilization including UNMEER, the first-ever UN emergency health mission.'
        ),
        'lessons': (
            'Weak health systems were the primary accelerant. Community engagement '
            'and safe burial practices were as critical as medical interventions. '
            'Contact tracing at scale required thousands of trained workers. '
            'rVSV-ZEBOV vaccine (Zaire strain) was developed under emergency protocols.'
        ),
        'source_urls': [
            'https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease',
            'https://apps.who.int/iris/handle/10665/208883',
        ],
    },
    {
        'country': 'Democratic Republic of the Congo',
        'country_iso3': 'COD',
        'year_start': 2018,
        'year_end': 2020,
        'cases': 3481,
        'deaths': 2299,
        'response_summary': (
            'Second largest Ebola outbreak. Concentrated in North Kivu and Ituri '
            'provinces in an active conflict zone. WHO declared PHEIC on 17 Jul 2019. '
            'First large-scale deployment of rVSV-ZEBOV vaccine (>300,000 vaccinated). '
            'Response complicated by armed group attacks on treatment centres.'
        ),
        'lessons': (
            'Conflict zones require integrated security-health response. '
            'Community distrust of response teams led to attacks on ETCs. '
            'Ring vaccination proved effective but coverage gaps remained in '
            'insecure areas. Surveillance system in conflict required innovation '
            '(community-based reporting when formal systems collapsed).'
        ),
        'source_urls': [
            'https://www.who.int/emergencies/situations/Ebola-2019-drc-',
            'https://www.who.int/news/item/25-06-2020-10th-ebola-outbreak-in-the-democratic-republic-of-the-congo-declared-over',
        ],
    },
    {
        'country': 'Democratic Republic of the Congo',
        'country_iso3': 'COD',
        'year_start': 2018,
        'year_end': 2018,
        'cases': 54,
        'deaths': 33,
        'response_summary': (
            'Equateur Province outbreak. Rapid containment using ring vaccination '
            'with rVSV-ZEBOV. Declared over on 24 Jul 2018 after 42 days since '
            'last confirmed case. Demonstrated that rapid vaccine deployment can '
            'contain outbreaks in remote areas.'
        ),
        'lessons': (
            'Speed of response is decisive — vaccine deployment within days of '
            'declaration. Cold chain (Arktek passive vaccine storage) enabled '
            'deployment in areas without electricity. Community health workers '
            'were essential for contact tracing in remote villages.'
        ),
        'source_urls': [
            'https://www.who.int/news/item/25-07-2018-ebola-outbreak-in-drc-ends',
        ],
    },
    {
        'country': 'Uganda',
        'country_iso3': 'UGA',
        'year_start': 2022,
        'year_end': 2023,
        'cases': 164,
        'deaths': 77,
        'response_summary': (
            'Sudan ebolavirus outbreak in Mubende and Kassanda districts. '
            'No approved vaccine for Sudan strain — response relied entirely on '
            'non-pharmaceutical interventions: IPC, contact tracing, safe burial. '
            'Declared over on 11 Jan 2023.'
        ),
        'lessons': (
            'Critical reminder that Ebola is not one disease — strain matters. '
            'The Zaire vaccine (rVSV-ZEBOV) does NOT work against Sudan strain. '
            'Strong existing public health infrastructure in Uganda enabled '
            'containment without vaccine. This precedent is directly relevant '
            'to Bundibugyo strain outbreaks.'
        ),
        'source_urls': [
            'https://www.who.int/emergencies/situations/ebola-uganda-2022',
            'https://www.who.int/news/item/11-01-2023-who-and-government-of-uganda-declare-the-end-of-the-ebola-disease-outbreak',
        ],
    },
    {
        'country': 'Uganda',
        'country_iso3': 'UGA',
        'year_start': 2007,
        'year_end': 2008,
        'cases': 149,
        'deaths': 37,
        'response_summary': (
            'First recognized Bundibugyo ebolavirus (BDBV) outbreak. '
            'Bundibugyo District, western Uganda. CFR ~25%, lower than Zaire '
            'strain but still significant. Identified as a novel Ebola species.'
        ),
        'lessons': (
            'Established Bundibugyo as a distinct Ebola species with different '
            'clinical characteristics. Lower CFR than Zaire but still '
            'highly dangerous. No cross-protection from Zaire-targeted '
            'vaccines — this finding is critical for current 2026 PHEIC.'
        ),
        'source_urls': [
            'https://www.who.int/csr/don/2007_12_01/en/',
            'https://pubmed.ncbi.nlm.nih.gov/18840688/',
        ],
    },
    {
        'country': 'Democratic Republic of the Congo',
        'country_iso3': 'COD',
        'year_start': 2012,
        'year_end': 2012,
        'cases': 36,
        'deaths': 13,
        'response_summary': (
            'Second Bundibugyo ebolavirus outbreak. Orientale Province, DRC. '
            'Confirmed as BDBV through sequencing. Contained through standard '
            'Ebola response protocols without vaccine.'
        ),
        'lessons': (
            'Confirmed that BDBV can re-emerge. Geographic range of BDBV '
            'extends beyond Uganda into eastern DRC. Response without vaccine '
            'is feasible with strong IPC and contact tracing.'
        ),
        'source_urls': [
            'https://www.who.int/csr/don/2012_09_22/en/',
        ],
    },
]


class Command(BaseCommand):
    help = (
        'Seed major Ebola historical episodes from WHO DON archives. '
        'Manually curated, no LLM-generated content. Idempotent.'
    )

    def handle(self, *args, **options):
        try:
            ebola = Pathogen.objects.get(name='Ebola Virus Disease')
        except Pathogen.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                'Pathogen "Ebola Virus Disease" not found. '
                'Run seed_pathogens first.'
            ))
            return

        created_count = 0
        skipped_count = 0

        for ep in EBOLA_EPISODES:
            # Dedupe on pathogen + country + year_start
            exists = OutbreakHistoricalEpisode.objects.filter(
                pathogen=ebola,
                country=ep['country'],
                year_start=ep['year_start'],
            ).exists()

            if exists:
                skipped_count += 1
                self.stdout.write(
                    f"  Skipped (exists): {ep['country']} {ep['year_start']}"
                )
                continue

            OutbreakHistoricalEpisode.objects.create(
                pathogen=ebola,
                **ep,
            )
            created_count += 1
            self.stdout.write(self.style.SUCCESS(
                f"  Created: {ep['country']} {ep['year_start']}"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Created: {created_count}, Skipped: {skipped_count}"
        ))
