"""
Enable Row-Level Security on all 4 HDIS tables.

Tables use db_table overrides: hdis_pro_alert, hdis_pro_trustscore,
hdis_pro_briefing, hdis_pro_generation_job (NOT hdis_alert etc.).

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON hdis_pro_alert;
  DROP POLICY IF EXISTS tenant_isolation ON hdis_pro_trustscore;
  DROP POLICY IF EXISTS tenant_isolation ON hdis_pro_briefing;
  DROP POLICY IF EXISTS tenant_isolation ON hdis_pro_generation_job;
  ALTER TABLE hdis_pro_alert NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_alert DISABLE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_trustscore NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_trustscore DISABLE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_briefing NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_briefing DISABLE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_generation_job NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE hdis_pro_generation_job DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations

TABLES = [
    'hdis_pro_alert',
    'hdis_pro_trustscore',
    'hdis_pro_briefing',
    'hdis_pro_generation_job',
]


def _enable_sql():
    parts = []
    for table in TABLES:
        parts.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    current_setting('app.current_tenant', true) = '0'
                    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                )
                WITH CHECK (
                    current_setting('app.current_tenant', true) = '0'
                    OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                );
        """)
    return '\n'.join(parts)


def _rollback_sql():
    parts = []
    for table in TABLES:
        parts.append(f"""
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
        """)
    return '\n'.join(parts)


class Migration(migrations.Migration):

    dependencies = [
        ('hdis', '0005_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql=_enable_sql(),
            reverse_sql=_rollback_sql(),
        ),
    ]
