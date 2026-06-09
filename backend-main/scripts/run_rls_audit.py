"""
Read-only RLS audit — runs the same 10 checks as rls_audit.sql
via Django's database cursor. Pure SELECTs, zero writes.
"""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

def run(sql, label=None):
    if label:
        print(f"\n{'='*60}\n{label}\n{'='*60}")
    with connection.cursor() as c:
        c.execute(sql)
        cols = [d[0] for d in c.description]
        rows = c.fetchall()
        # print header
        widths = [max(len(str(col)), max((len(str(r[i])) for r in rows), default=0)) for i, col in enumerate(cols)]
        hdr = ' | '.join(str(col).ljust(widths[i]) for i, col in enumerate(cols))
        print(hdr)
        print('-+-'.join('-'*w for w in widths))
        for row in rows:
            print(' | '.join(str(v).ljust(widths[i]) for i, v in enumerate(row)))
        if not rows:
            print('(0 rows)')
        print(f'({len(rows)} row{"s" if len(rows)!=1 else ""})')

# 1
run("""
    SELECT COUNT(*) AS tenant_count,
           SUM(CASE WHEN is_continental THEN 1 ELSE 0 END) AS continental_count,
           SUM(CASE WHEN is_continental THEN 0 ELSE 1 END) AS country_count
    FROM account_tenant
""", "1. Tenant table check (expect 48 rows)")

# 2
run("""
    SELECT id, name, iso_code, is_continental, is_active
    FROM account_tenant
    WHERE is_continental = TRUE
""", "2. AFR continental tenant (must exist)")

# 3
run("""
    SELECT COUNT(*) AS total_users,
           COUNT(tenant_id) AS users_with_tenant,
           COUNT(*) - COUNT(tenant_id) AS users_with_null_tenant
    FROM account_user
""", "3. User.tenant population (should be 100% non-null)")

# 4 — per-table NULL counts
tables_not_null = [
    'sentinel_signal', 'hdis_alert', 'hdis_trustscore', 'hdis_briefing',
    'hdis_pro_generation_job', 'predictions_outbreakprediction',
    'predictions_forecastdata', 'stardata_stardata', 'stardata_starcandlestick',
    'pami_pamidata', 'espar_espar', 'ihmref_ihmrefcountry',
    'chwfolder_country', 'chwfolder_region', 'chwfolder_district',
    'chwfolder_workertype', 'chwfolder_facility', 'chwfolder_dataupload',
]
print(f"\n{'='*60}")
print("4. Per-table tenant_id NULL counts (NOT NULL tables should be 0)")
print(f"{'='*60}")
for tbl in tables_not_null:
    try:
        run(f"SELECT '{tbl}' AS tbl, COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM {tbl}")
    except Exception as e:
        print(f"  {tbl}: ERROR — {e}")

# 4b — readiness tables
readiness_tables = [
    'readiness_arbovirus', 'readiness_cholera', 'readiness_cholerasubnational',
    'readiness_cyclone', 'readiness_fvd', 'readiness_fvdpoe',
    'readiness_lassafever', 'readiness_lassafeverdistrict',
    'readiness_marburg', 'readiness_meningitis', 'readiness_meningitiseelimination',
    'readiness_mpox', 'readiness_mpoxdistrict', 'readiness_naturaldisaster',
    'readiness_riftvalleyfever',
]
print(f"\n{'='*60}")
print("4b. Readiness tables tenant_id NULL counts")
print(f"{'='*60}")
for tbl in readiness_tables:
    try:
        run(f"SELECT '{tbl}' AS tbl, COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM {tbl}")
    except Exception as e:
        print(f"  {tbl}: ERROR — {e}")

# 5
run("""
    SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant
    FROM account_auditlog
""", "5. AuditLog (legitimately nullable per Mistake 4)")

# 6
run("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'espar_indicator' AND column_name = 'tenant_id'
""", "6a. espar_indicator: tenant_id column should be MISSING")

run("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ihmref_countryincident' AND column_name = 'tenant_id'
""", "6b. ihmref_countryincident: tenant_id column should be MISSING")

# 7
run("""
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND (c.relrowsecurity OR c.relforcerowsecurity)
    ORDER BY c.relname
""", "7. RLS state — expect zero rows (Phase 3 not started)")

# 8
run("""
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
""", "8. Existing RLS policies — expect zero rows")

# 9
run("""
    SELECT current_user AS connected_as,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls
""", "9. Application role identity")

# 10
run("""
    SELECT t.iso_code, t.name, COUNT(s.id) AS signal_count
    FROM account_tenant t
    LEFT JOIN sentinel_signal s ON s.tenant_id = t.id
    GROUP BY t.id, t.iso_code, t.name
    HAVING COUNT(s.id) > 0
    ORDER BY signal_count DESC
    LIMIT 10
""", "10a. Top-10 tenants by sentinel_signal count")

run("""
    SELECT t.iso_code, t.name, COUNT(f.id) AS forecast_count
    FROM account_tenant t
    LEFT JOIN predictions_forecastdata f ON f.tenant_id = t.id
    GROUP BY t.id, t.iso_code, t.name
    HAVING COUNT(f.id) > 0
    ORDER BY forecast_count DESC
    LIMIT 10
""", "10b. Top-10 tenants by predictions_forecastdata count")

print(f"\n{'='*60}")
print("AUDIT COMPLETE — all queries were SELECT-only")
print(f"{'='*60}")
