"""
Enable Row-Level Security on predictions_scenario and predictions_scenariorun.

Mirrors the policy used in 0004_enable_rls_all for OutbreakPrediction and
ForecastData: a session-scoped `app.current_tenant` setting governs row
visibility. '0' is the super-admin wildcard (continental tenant).

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON predictions_scenario;
  DROP POLICY IF EXISTS tenant_isolation ON predictions_scenariorun;
  ALTER TABLE predictions_scenario NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE predictions_scenario DISABLE ROW LEVEL SECURITY;
  ALTER TABLE predictions_scenariorun NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE predictions_scenariorun DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('predictions', '0005_scenario_scenariorun'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE predictions_scenario ENABLE ROW LEVEL SECURITY;
                ALTER TABLE predictions_scenario FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON predictions_scenario
                    FOR ALL
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                ALTER TABLE predictions_scenariorun ENABLE ROW LEVEL SECURITY;
                ALTER TABLE predictions_scenariorun FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON predictions_scenariorun
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
                DROP POLICY IF EXISTS tenant_isolation ON predictions_scenario;
                ALTER TABLE predictions_scenario NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE predictions_scenario DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON predictions_scenariorun;
                ALTER TABLE predictions_scenariorun NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE predictions_scenariorun DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
