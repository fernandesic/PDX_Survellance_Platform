"""
Enable Row-Level Security on stardata_stardata and stardata_starcandlestick.

ROLLBACK:
  DROP POLICY IF EXISTS tenant_isolation ON stardata_stardata;
  DROP POLICY IF EXISTS tenant_isolation ON stardata_starcandlestick;
  ALTER TABLE stardata_stardata NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE stardata_stardata DISABLE ROW LEVEL SECURITY;
  ALTER TABLE stardata_starcandlestick NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE stardata_starcandlestick DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stardata', '0006_add_tenant_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE stardata_stardata ENABLE ROW LEVEL SECURITY;
                ALTER TABLE stardata_stardata FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON stardata_stardata
                    FOR ALL
                    USING (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    )
                    WITH CHECK (
                        current_setting('app.current_tenant', true) = '0'
                        OR tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::integer
                    );

                ALTER TABLE stardata_starcandlestick ENABLE ROW LEVEL SECURITY;
                ALTER TABLE stardata_starcandlestick FORCE ROW LEVEL SECURITY;

                CREATE POLICY tenant_isolation ON stardata_starcandlestick
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
                DROP POLICY IF EXISTS tenant_isolation ON stardata_stardata;
                ALTER TABLE stardata_stardata NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE stardata_stardata DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON stardata_starcandlestick;
                ALTER TABLE stardata_starcandlestick NO FORCE ROW LEVEL SECURITY;
                ALTER TABLE stardata_starcandlestick DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
