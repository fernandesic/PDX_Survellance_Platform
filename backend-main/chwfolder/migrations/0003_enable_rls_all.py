"""
Enable Row-Level Security on all 6 chwfolder tables.

Batched because these tables are always queried together via
parent-child relationships (Country → Region → District, etc).

Tables: chwfolder_country, chwfolder_region, chwfolder_district,
        chwfolder_workertype, chwfolder_facility, chwfolder_dataupload

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_country;
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_region;
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_district;
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_workertype;
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_facility;
  DROP POLICY IF EXISTS tenant_isolation ON chwfolder_dataupload;
  ALTER TABLE chwfolder_country NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_country DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_region NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_region DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_district NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_district DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_workertype NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_workertype DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_facility NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_facility DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_dataupload NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE chwfolder_dataupload DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations

TABLES = [
    'chwfolder_country',
    'chwfolder_region',
    'chwfolder_district',
    'chwfolder_workertype',
    'chwfolder_facility',
    'chwfolder_dataupload',
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
        ('chwfolder', '0002_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql=_enable_sql(),
            reverse_sql=_rollback_sql(),
        ),
    ]
