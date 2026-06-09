"""
Enable Row-Level Security on sentinel_signal.

This is the LAST table to get RLS — it has the highest write frequency
(4 ingestion pipelines on 15-minute Celery Beat crons). By the time
this migration is applied, all other tables should be stable under RLS.

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON sentinel_signal;
  ALTER TABLE sentinel_signal NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE sentinel_signal DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sentinel', '0010_merge_0008_add_tenant_fk_0009_add_debate_step_kind'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE sentinel_signal ENABLE ROW LEVEL SECURITY;
                ALTER TABLE sentinel_signal FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON sentinel_signal
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
                DROP POLICY IF EXISTS tenant_isolation ON sentinel_signal;
                ALTER TABLE sentinel_signal NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE sentinel_signal DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
