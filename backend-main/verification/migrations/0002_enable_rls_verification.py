"""
Enable Row-Level Security on all verification tables.

Mirrors the policy used in predictions/migrations/0004_enable_rls_all and
0006_enable_rls_scenarios: a session-scoped `app.current_tenant` setting
governs row visibility. '0' is the super-admin wildcard (continental tenant);
any other value restricts to rows whose tenant_id matches; '' / '-1' (the
deny-all default set by TenantMiddleware) sees nothing.

The setting is applied per-request by utils.tenant_middleware.TenantMiddleware
(session auth) and utils.authentication.CustomTokenAuthentication (token auth),
so verification querysets are filtered at the DB layer with no app-level
.filter(tenant=...) needed.

ROLLBACK (per table):
  DROP POLICY IF EXISTS tenant_isolation ON <table>;
  ALTER TABLE <table> NO FORCE ROW LEVEL SECURITY;
  ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
"""

from django.db import migrations


TABLES = [
    'verification_predictionsnapshot',
    'verification_outcomeevent',
    'verification_matchverdict',
    'verification_scorecard',
    'verification_veracityindex',
    'verification_reviewticket',
    'verification_calibrationrecord',
    'verification_ebolaevent',
    'verification_sourceaudit',
]


def _enable_sql():
    stmts = []
    for t in TABLES:
        stmts.append(f"""
            ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
            ALTER TABLE {t} FORCE ROW LEVEL SECURITY;

            CREATE POLICY tenant_isolation ON {t}
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
    return "\n".join(stmts)


def _disable_sql():
    stmts = []
    for t in TABLES:
        stmts.append(f"""
            DROP POLICY IF EXISTS tenant_isolation ON {t};
            ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY;
            ALTER TABLE {t} DISABLE ROW LEVEL SECURITY;
        """)
    return "\n".join(stmts)


class Migration(migrations.Migration):

    dependencies = [
        ('verification', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(sql=_enable_sql(), reverse_sql=_disable_sql()),
    ]
