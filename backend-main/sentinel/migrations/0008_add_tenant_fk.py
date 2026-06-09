# Phase 2.1 — Add tenant FK to Signal model
#
# NOTE: This is a state_operations-only migration.
# Developer 1 already applied the actual schema change to the production DB
# (added tenant_id column, populated it, made it NOT NULL).
# This migration just tells Django's migration framework "the column exists"
# without trying to re-create it.
#
# See: .claude/country-specific-work/progress.md (Entry 8)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0014_add_tenant_model_and_user_fk'),
        ('sentinel', '0007_populate_disease_epi_data'),
    ]

    operations = [
        # state_operations = tell Django ORM about the field
        # without running any SQL (column already exists on the table).
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='signal',
                    name='tenant',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='signals',
                        to='account.tenant',
                        help_text='Country tenant for RLS isolation (populated from location_country_iso)',
                    ),
                    # The actual DB column is NOT NULL, but we declare it here
                    # matching the model definition.
                ),
            ],
            database_operations=[
                # RunSQL added to support test environments and new DB setups where the column
                # does not exist yet. IF NOT EXISTS ensures it is a no-op on existing databases.
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE sentinel_signal ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES account_tenant(id) ON DELETE RESTRICT;
                        ALTER TABLE sentinel_signal ALTER COLUMN tenant_id SET NOT NULL;
                        CREATE INDEX IF NOT EXISTS sentinel_signal_tenant_id_idx ON sentinel_signal (tenant_id);
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS sentinel_signal_tenant_id_idx;
                        ALTER TABLE sentinel_signal DROP COLUMN IF EXISTS tenant_id;
                    """,
                )
            ],
        ),
    ]
