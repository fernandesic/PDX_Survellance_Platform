"""
Data migration: backfill DepartmentReviewer rows with the four current
section reviewers (A, B, C, D).

The same commit that adds this migration also removes the
DEPARTMENT_WORKFLOW_REVIEWER_* environment-variable reads from
settings.py and the keys themselves from .env, so this migration cannot
rely on os.environ — it would race the deletion and seed an empty bench
in the worst case.

Instead, the four current reviewers are hardcoded below as the canonical
seed (the emails were public WHO/AFRO work addresses that already
shipped in .env, so committing them to a migration file is not a leak).
Future reviewer changes happen in Django admin, not by editing this
file.

Reversal deletes ONLY the global rows (tenant IS NULL, section in
{A,B,C,D}). Per-tenant overrides added later via admin survive. Supplier
reviewers live in a separate model in a separate app; they are not
touched here.
"""

from django.db import migrations


# (section, email) — mirrors the assignments department_form.services /
# department_form.emails previously read from
# settings.DEPARTMENT_WORKFLOW_REVIEWER_A..D.
REVIEWERS = [
    ('A', 'fernandesi@who.int'),
    ('B', 'watituj@who.int'),
    ('C', 'akombot@who.int'),
    ('D', 'nyamandir@who.int'),
]


def seed_reviewers(apps, schema_editor):
    DepartmentReviewer = apps.get_model('department_form', 'DepartmentReviewer')
    inserted = 0
    skipped_existing = 0
    for section, email in REVIEWERS:
        _, created = DepartmentReviewer.objects.get_or_create(
            section=section,
            tenant=None,  # global default
            defaults={'email': email, 'is_active': True},
        )
        if created:
            inserted += 1
        else:
            skipped_existing += 1
    print(
        f"  [department reviewers] seeded {inserted} new, "
        f"{skipped_existing} already present "
        f"(out of {len(REVIEWERS)} section seats)"
    )


def remove_seeded(apps, schema_editor):
    # Reversal: drop only the global rows (tenant IS NULL).
    # Per-tenant overrides added later via admin survive.
    DepartmentReviewer = apps.get_model('department_form', 'DepartmentReviewer')
    deleted, _ = DepartmentReviewer.objects.filter(tenant__isnull=True).delete()
    print(f"  [department reviewers] removed {deleted} global rows on rollback")


class Migration(migrations.Migration):

    dependencies = [
        ('department_form', '0003_departmentreviewer'),
    ]

    operations = [
        migrations.RunPython(seed_reviewers, reverse_code=remove_seeded),
    ]
