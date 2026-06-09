# Phase 2.1 — Add tenant FK to AuditLog model
#
# NOTE: This is a state_operations-only migration.
# Developer 1 already applied the actual schema change to the production DB
# (added tenant_id column, populated where possible).
# This migration just tells Django's migration framework "the column exists"
# without trying to re-create it.
#
# AuditLog.tenant stays nullable forever — anonymous/system events have
# no user to derive a tenant from. See Mistake 4 in mistakes.md.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0014_add_tenant_model_and_user_fk'),
    ]

    operations = [
        # state_operations = tell Django ORM about the field
        # without running any SQL (column already exists on the table).
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='auditlog',
                    name='tenant',
                    field=models.ForeignKey(
                        blank=True,
                        help_text='Tenant for RLS scoping. Null = anonymous/system event (super-admin visible only).',
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='audit_logs_tenant',
                        to='account.tenant',
                    ),
                ),
            ],
            database_operations=[
                # RunSQL added to support test environments and new DB setups where the column
                # does not exist yet. IF NOT EXISTS ensures it is a no-op on existing databases.
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE account_auditlog ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES account_tenant(id) ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS account_auditlog_tenant_id_idx ON account_auditlog (tenant_id);
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS account_auditlog_tenant_id_idx;
                        ALTER TABLE account_auditlog DROP COLUMN IF EXISTS tenant_id;
                    """,
                )
            ],
        ),
    ]
