"""
Enable Row-Level Security on ihmref_ihmrefcountry and ihmref_countryincident.

Standard tenant isolation policy on both tables.

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON ihmref_ihmrefcountry;
  ALTER TABLE ihmref_ihmrefcountry NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE ihmref_ihmrefcountry DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON ihmref_countryincident;
  ALTER TABLE ihmref_countryincident NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE ihmref_countryincident DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ihmref', '0010_populate_incident_tenant'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- ihmref_ihmrefcountry (54 rows, read-only)
                ALTER TABLE ihmref_ihmrefcountry ENABLE ROW LEVEL SECURITY;
                ALTER TABLE ihmref_ihmrefcountry FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON ihmref_ihmrefcountry
                    FOR ALL
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                -- ihmref_countryincident (380 rows)
                ALTER TABLE ihmref_countryincident ENABLE ROW LEVEL SECURITY;
                ALTER TABLE ihmref_countryincident FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON ihmref_countryincident
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
                DROP POLICY IF EXISTS tenant_isolation ON ihmref_ihmrefcountry;
                ALTER TABLE ihmref_ihmrefcountry NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE ihmref_ihmrefcountry DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON ihmref_countryincident;
                ALTER TABLE ihmref_countryincident NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE ihmref_countryincident DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
