"""
Data migration: correct the declared_at for the active BDBV/COD outbreak.

The Outbreak row inherited `timezone.now()` from the initial migration on
2026-05-17, but the WHO/INSP-declared start of the 17ème épidémie was
2026-05-15. The banner reads `declared_at` directly, so the workspace
shows "Declared 5/17/2026" — off by two days.

Idempotent in both directions:
  - Forward: only updates when the current value is exactly 2026-05-17
    (the known wrong value). Manual corrections via admin survive.
  - Reverse: restores 2026-05-17 only on rows currently at 2026-05-15.
"""

from datetime import datetime, timezone as dt_timezone

from django.db import migrations


WRONG = datetime(2026, 5, 17, tzinfo=dt_timezone.utc)
RIGHT = datetime(2026, 5, 15, tzinfo=dt_timezone.utc)


def fix_declared_at(apps, schema_editor):
    Outbreak = apps.get_model('outbreak', 'Outbreak')
    Pathogen = apps.get_model('outbreak', 'Pathogen')
    try:
        pathogen = Pathogen.objects.get(name='Ebola Virus Disease')
    except Pathogen.DoesNotExist:
        return
    Outbreak.objects.filter(
        pathogen=pathogen,
        iso3='COD',
        declared_at__date=WRONG.date(),
    ).update(declared_at=RIGHT)


def revert_declared_at(apps, schema_editor):
    Outbreak = apps.get_model('outbreak', 'Outbreak')
    Pathogen = apps.get_model('outbreak', 'Pathogen')
    try:
        pathogen = Pathogen.objects.get(name='Ebola Virus Disease')
    except Pathogen.DoesNotExist:
        return
    Outbreak.objects.filter(
        pathogen=pathogen,
        iso3='COD',
        declared_at__date=RIGHT.date(),
    ).update(declared_at=WRONG)


class Migration(migrations.Migration):

    dependencies = [
        ('outbreak', '0004_seed_confirmed_counts'),
    ]

    operations = [
        migrations.RunPython(fix_declared_at, revert_declared_at),
    ]
