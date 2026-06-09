# IhmRef Phase 2: backfill CountryIncident.tenant from parent IhmrefCountry.tenant
from django.db import migrations


def populate_incident_tenant(apps, schema_editor):
    """Copy tenant_id from IhmrefCountry parent to each CountryIncident row."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            UPDATE ihmref_countryincident ci
            SET tenant_id = ic.tenant_id
            FROM ihmref_ihmrefcountry ic
            WHERE ci.country_id = ic.id
              AND ci.tenant_id IS NULL
        """)
        updated = cursor.rowcount
        print(f"\n  Backfilled {updated} ihmref_countryincident rows with tenant_id from parent ihmref_ihmrefcountry")


def reverse_populate(apps, schema_editor):
    """Reverse: set all CountryIncident.tenant_id to NULL."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("UPDATE ihmref_countryincident SET tenant_id = NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('ihmref', '0009_countryincident_tenant_alter_ihmrefcountry_tenant'),
    ]

    operations = [
        migrations.RunPython(populate_incident_tenant, reverse_populate),
    ]
