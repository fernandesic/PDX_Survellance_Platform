"""
Enable Row-Level Security on predictions_outbreakprediction and
predictions_forecastdata.

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON predictions_outbreakprediction;
  DROP POLICY IF EXISTS tenant_isolation ON predictions_forecastdata;
  ALTER TABLE predictions_outbreakprediction NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE predictions_outbreakprediction DISABLE ROW LEVEL SECURITY;
  ALTER TABLE predictions_forecastdata NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE predictions_forecastdata DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('predictions', '0003_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE predictions_outbreakprediction ENABLE ROW LEVEL SECURITY;
                ALTER TABLE predictions_outbreakprediction FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON predictions_outbreakprediction
                    FOR ALL
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                ALTER TABLE predictions_forecastdata ENABLE ROW LEVEL SECURITY;
                ALTER TABLE predictions_forecastdata FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON predictions_forecastdata
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
                DROP POLICY IF EXISTS tenant_isolation ON predictions_outbreakprediction;
                ALTER TABLE predictions_outbreakprediction NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE predictions_outbreakprediction DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON predictions_forecastdata;
                ALTER TABLE predictions_forecastdata NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE predictions_forecastdata DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
