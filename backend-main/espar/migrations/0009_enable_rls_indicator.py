"""
Enable Row-Level Security on espar_indicator.

Standard tenant isolation policy (tenant_id denormalized from parent espar).

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON espar_indicator;
  ALTER TABLE espar_indicator NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE espar_indicator DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('espar', '0008_enable_rls_espar'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE espar_indicator ENABLE ROW LEVEL SECURITY;
                ALTER TABLE espar_indicator FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON espar_indicator
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
                DROP POLICY IF EXISTS tenant_isolation ON espar_indicator;
                ALTER TABLE espar_indicator NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE espar_indicator DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
