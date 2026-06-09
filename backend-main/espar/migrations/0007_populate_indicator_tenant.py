# Espar Phase 2: backfill Indicator.tenant from parent Espar.tenant
from django.db import migrations


def populate_indicator_tenant(apps, schema_editor):
    """Copy tenant_id from Espar parent to each Indicator row."""
    Indicator = apps.get_model('espar', 'Indicator')
    db_alias = schema_editor.connection.alias

    # Bulk update via raw SQL for performance (28,945 rows)
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            UPDATE espar_indicator i
            SET tenant_id = e.tenant_id
            FROM espar_espar e
            WHERE i.espar_id = e.id
              AND i.tenant_id IS NULL
        """)
        updated = cursor.rowcount
        print(f"\n  Backfilled {updated} espar_indicator rows with tenant_id from parent espar_espar")


def reverse_populate(apps, schema_editor):
    """Reverse: set all Indicator.tenant_id to NULL."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("UPDATE espar_indicator SET tenant_id = NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('espar', '0006_indicator_tenant'),
    ]

    operations = [
        migrations.RunPython(populate_indicator_tenant, reverse_populate),
    ]
