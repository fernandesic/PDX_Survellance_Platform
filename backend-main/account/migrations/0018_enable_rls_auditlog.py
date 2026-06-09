"""
Enable Row-Level Security on account_auditlog.

This is the FIRST RLS migration in the platform. It enforces tenant
isolation at the PostgreSQL level so that:
  - Super-admin (app.current_tenant = '0') sees ALL rows
  - Country user (app.current_tenant = '<id>') sees only their tenant's rows
  - Unauthenticated (app.current_tenant = '-1') sees ZERO rows
  - NULL-tenant rows (anonymous events) are visible ONLY to super-admin

AuditLog is chosen as the first table because:
  1. It has a single, controlled write path (utils/audit.py log_audit())
  2. It's low-traffic and non-critical for dashboards
  3. It tests the nullable-tenant policy variant (Mistake 4)

ROLLBACK (copy-paste into psql if something goes wrong):
  DROP POLICY IF EXISTS tenant_isolation_read ON account_auditlog;
  DROP POLICY IF EXISTS tenant_isolation_write ON account_auditlog;
  ALTER TABLE account_auditlog NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE account_auditlog DISABLE ROW LEVEL SECURITY;

Baseline at time of writing (2026-04-28):
  total=1101, with_tenant=944, null_tenant=157
  Distribution: tenant_25=518, tenant_1(AFR)=426, NULL=157
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0017_populate_all_tenants'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- Step 1: Enable RLS on the table
                ALTER TABLE account_auditlog ENABLE ROW LEVEL SECURITY;

                -- Step 2: Force RLS for table owner (backend_user is NOT superuser,
                -- so FORCE makes policies apply even though it owns the table)
                ALTER TABLE account_auditlog FORCE ROW LEVEL SECURITY;

                -- Step 3a: READ policy — controls which rows are visible
                --   Super-admin ('0'): sees all rows (including NULL-tenant)
                --   Country user ('<id>'): sees only their tenant's rows
                --   Unauthenticated ('-1'): sees zero rows
                --   NULL-tenant rows: only visible to super-admin
                CREATE POLICY tenant_isolation_read ON account_auditlog
                    FOR SELECT
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                -- Step 3b: WRITE policy — controls which rows can be inserted/updated
                --   Must allow NULL-tenant inserts for anonymous audit events
                --   (e.g. failed logins where tenant context is '-1')
                CREATE POLICY tenant_isolation_write ON account_auditlog
                    FOR INSERT
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                        OR tenant_id IS NULL
                    );

                -- Step 3c: UPDATE policy — same read restriction + write check
                CREATE POLICY tenant_isolation_update ON account_auditlog
                    FOR UPDATE
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                -- Step 3d: DELETE — super-admin only (audit logs should not be deleted)
                CREATE POLICY tenant_isolation_delete ON account_auditlog
                    FOR DELETE
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                    );
            """,
            reverse_sql="""
                -- ROLLBACK: Remove all RLS policies and disable RLS
                DROP POLICY IF EXISTS tenant_isolation_read ON account_auditlog;
                DROP POLICY IF EXISTS tenant_isolation_write ON account_auditlog;
                DROP POLICY IF EXISTS tenant_isolation_update ON account_auditlog;
                DROP POLICY IF EXISTS tenant_isolation_delete ON account_auditlog;
                ALTER TABLE account_auditlog NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE account_auditlog DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
