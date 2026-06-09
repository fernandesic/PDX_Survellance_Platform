"""
Data migration: populate confirmed_cases / confirmed_deaths / confirmed_as_of
/ confirmed_source on the active BDBV/COD outbreak so the workspace banner
renders authoritative numbers immediately after deploy — no second
management-command run needed.

Idempotent in two directions:
  - Forward: only writes when confirmed_cases is NULL, so re-running
    `migrate --run-syncdb` will not stomp newer admin-entered values.
  - Reverse: clears the four fields back to NULL on rollback.

When a new WHO DON sitrep ships, prefer the dedicated command:
    python manage.py update_confirmed_counts --use-registry
That command lives in outbreak/management/commands/update_confirmed_counts.py
and keeps the curated REGISTRY as the audit-log surface. This migration
exists only to seed initial values once.
"""

from django.db import migrations


# Source: WHO DON 2026-05-17 — Ebola Virus Disease (Bundibugyo) — DRC.
# Update the REGISTRY in update_confirmed_counts.py + re-run that command
# when the next sitrep lands; do NOT keep editing this migration.
SEED = [
    {
        'pathogen': 'Ebola Virus Disease',
        'iso3': 'COD',
        'cases': 248,
        'deaths': 65,
        'as_of_iso': '2026-05-17T00:00:00+00:00',
        'source': (
            'WHO DON 2026-05-17 — Ebola Virus Disease (Bundibugyo) — '
            'Democratic Republic of the Congo. '
            'https://www.who.int/emergencies/disease-outbreak-news/'
        ),
    },
]


def seed_confirmed(apps, schema_editor):
    Outbreak = apps.get_model('outbreak', 'Outbreak')
    Pathogen = apps.get_model('outbreak', 'Pathogen')
    from datetime import datetime

    for entry in SEED:
        try:
            pathogen = Pathogen.objects.get(name=entry['pathogen'])
        except Pathogen.DoesNotExist:
            # Pathogen not seeded yet — silent skip, this migration is a
            # best-effort seeder, not a blocker.
            continue

        qs = Outbreak.objects.filter(
            pathogen=pathogen,
            iso3=entry['iso3'].upper(),
            status__in=['suspected', 'confirmed'],
            confirmed_cases__isnull=True,  # do not overwrite manual entries
        )
        as_of = datetime.fromisoformat(entry['as_of_iso'])
        qs.update(
            confirmed_cases=entry['cases'],
            confirmed_deaths=entry['deaths'],
            confirmed_as_of=as_of,
            confirmed_source=entry['source'][:300],
        )


def clear_confirmed(apps, schema_editor):
    Outbreak = apps.get_model('outbreak', 'Outbreak')
    Pathogen = apps.get_model('outbreak', 'Pathogen')

    for entry in SEED:
        try:
            pathogen = Pathogen.objects.get(name=entry['pathogen'])
        except Pathogen.DoesNotExist:
            continue
        Outbreak.objects.filter(
            pathogen=pathogen,
            iso3=entry['iso3'].upper(),
            confirmed_cases=entry['cases'],
            confirmed_deaths=entry['deaths'],
        ).update(
            confirmed_cases=None,
            confirmed_deaths=None,
            confirmed_as_of=None,
            confirmed_source='',
        )


class Migration(migrations.Migration):

    dependencies = [
        ('outbreak', '0003_outbreak_confirmed_counts'),
    ]

    operations = [
        migrations.RunPython(seed_confirmed, clear_confirmed),
    ]
