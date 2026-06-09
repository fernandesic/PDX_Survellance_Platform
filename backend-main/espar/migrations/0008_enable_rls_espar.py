"""
Enable Row-Level Security on espar_espar.

Standard tenant isolation policy (NOT NULL tenant_id).

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON espar_espar;
  ALTER TABLE espar_espar NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE espar_espar DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('espar', '0007_populate_indicator_tenant'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE espar_espar ENABLE ROW LEVEL SECURITY;
                ALTER TABLE espar_espar FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON espar_espar
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
                DROP POLICY IF EXISTS tenant_isolation ON espar_espar;
                ALTER TABLE espar_espar NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE espar_espar DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
