"""
Data migration: backfill SupplierReviewer rows for the supplier-form
workflow review bench.

The same commit that adds this migration also removes the
WORKFLOW_REVIEWER_* environment-variable reads from settings.py and the
keys themselves from .env, so this migration cannot rely on os.environ —
it would race the deletion and seed an empty bench in the worst case.

Instead, the bench is hardcoded below as the canonical seed (the emails
were public WHO/AFRO work addresses that already shipped in .env, so
committing them to a migration file is not a leak). Future reviewer
changes happen in Django admin, not by editing this file.

Reversal deletes ONLY the global-bench rows (tenant IS NULL, section in
{A,B,C,D}, ordinal in 1..7). Per-tenant overrides added later via admin
survive. Department reviewers are a separate model in a separate app
(task #2); they are not touched here.
"""

from django.db import migrations


# (section, ordinal, email) — mirrors the bench supplier_form.services
# previously assembled from settings.WORKFLOW_REVIEWER_A_1 … D_4.
BENCH = [
    ('A', 1, 'watituj@who.int'),
    ('A', 2, 'akombot@who.int'),
    ('A', 3, 'tindij@who.int'),
    ('A', 4, 'ahmeda@who.int'),
    ('A', 5, 'muthiorat@who.int'),
    ('A', 6, 'ahmedj@who.int'),
    ('A', 7, 'magatie@who.int'),
    ('B', 1, 'bagaragazae@who.int'),
    ('B', 2, 'tafidaf@who.int'),
    ('B', 3, 'mpairwea@who.int'),
    ('B', 4, 'abdulatipovah@who.int'),
    ('B', 5, 'watituj@who.int'),
    ('C', 1, 'bagaragazae@who.int'),
    ('C', 2, 'watituj@who.int'),
    ('D', 1, 'chamlad@who.int'),
    ('D', 2, 'mpairwea@who.int'),
    ('D', 3, 'gumedemoeletsih@who.int'),
    ('D', 4, 'woldetsadiks@who.int'),
]


def seed_bench(apps, schema_editor):
    SupplierReviewer = apps.get_model('supplier_form', 'SupplierReviewer')
    inserted = 0
    skipped_existing = 0
    for section, ordinal, email in BENCH:
        _, created = SupplierReviewer.objects.get_or_create(
            section=section,
            ordinal=ordinal,
            tenant=None,  # global bench
            defaults={'email': email, 'is_active': True},
        )
        if created:
            inserted += 1
        else:
            skipped_existing += 1
    print(
        f"  [supplier reviewers] seeded {inserted} new, "
        f"{skipped_existing} already present "
        f"(out of {len(BENCH)} bench positions)"
    )


def remove_seeded(apps, schema_editor):
    # Reversal: drop only the global-bench rows (tenant IS NULL).
    # Per-tenant overrides added later via admin survive.
    SupplierReviewer = apps.get_model('supplier_form', 'SupplierReviewer')
    deleted, _ = SupplierReviewer.objects.filter(tenant__isnull=True).delete()
    print(f"  [supplier reviewers] removed {deleted} global-bench rows on rollback")


class Migration(migrations.Migration):

    dependencies = [
        ('supplier_form', '0007_supplierreviewer'),
    ]

    operations = [
        migrations.RunPython(seed_bench, reverse_code=remove_seeded),
    ]
