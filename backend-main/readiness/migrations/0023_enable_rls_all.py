"""
Enable Row-Level Security on all 15 readiness disease tables.

All inherit from BaseReadiness (abstract) and share the same generic
upload/query views. Batched because enabling RLS on one without the
others would create inconsistent isolation within the readiness module.

ROLLBACK (paste into psql):
  DO $$ DECLARE t TEXT;
  BEGIN FOR t IN SELECT unnest(ARRAY[
    'readiness_arbovirus','readiness_cholera','readiness_cholerasubnational',
    'readiness_cyclone','readiness_fvd','readiness_fvdpoe',
    'readiness_lassafever','readiness_lassafeverdistrict','readiness_marburg',
    'readiness_meningitis','readiness_meningitiseelimination',
    'readiness_mpox','readiness_mpoxdistrict',
    'readiness_naturaldisaster','readiness_riftvalleyfever'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP; END $$;
"""

from django.db import migrations

TABLES = [
    'readiness_arbovirus',
    'readiness_cholera',
    'readiness_cholerasubnational',
    'readiness_cyclone',
    'readiness_fvd',
    'readiness_fvdpoe',
    'readiness_lassafever',
    'readiness_lassafeverdistrict',
    'readiness_marburg',
    'readiness_meningitis',
    'readiness_meningitiseelimination',
    'readiness_mpox',
    'readiness_mpoxdistrict',
    'readiness_naturaldisaster',
    'readiness_riftvalleyfever',
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
        ('readiness', '0022_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql=_enable_sql(),
            reverse_sql=_rollback_sql(),
        ),
    ]
