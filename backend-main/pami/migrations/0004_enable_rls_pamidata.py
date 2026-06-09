"""
Enable Row-Level Security on pami_pamidata.

Standard tenant isolation policy (NOT NULL tenant_id).
See account/0018_enable_rls_auditlog.py for full rationale.

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON pami_pamidata;
  ALTER TABLE pami_pamidata NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE pami_pamidata DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('pami', '0003_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE pami_pamidata ENABLE ROW LEVEL SECURITY;
                ALTER TABLE pami_pamidata FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON pami_pamidata
                    FOR ALL
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );
            """,
            reverse_sql="""
                DROP POLICY IF EXISTS tenant_isolation ON pami_pamidata;
                ALTER TABLE pami_pamidata NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE pami_pamidata DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
