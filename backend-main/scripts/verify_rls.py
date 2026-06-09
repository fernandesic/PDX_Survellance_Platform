"""
RLS Verification Script
Run: python manage.py shell < scripts/verify_rls.py
Or:  python scripts/verify_rls.py (with DJANGO_SETTINGS_MODULE set)
"""
import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "datarepr.settings.development")
django.setup()

from django.db import connection

TABLES = [
    "sentinel_signal",
    "hdis_pro_alert",
    "hdis_pro_trustscore",
    "pami_pamidata",
    "readiness_cholera",
    "predictions_forecastdata",
    "account_auditlog",
    "espar_espar",
    "chwfolder_country",
    "stardata_stardata",
]

CONTEXTS = [
    ("0",  "super-admin (all)"),
    ("36", "Nigeria (id=36)"),
    ("25", "Kenya   (id=25)"),
    ("-1", "deny-all (anon)"),
]

print("\n=== RLS ENABLED TABLES ===")
with connection.cursor() as cur:
    cur.execute("""
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
        ORDER BY c.relname;
    """)
    rows = cur.fetchall()
    print(f"  {len(rows)} tables have RLS enabled:")
    for r in rows:
        print(f"    {r[0]:50} RLS={r[1]}  FORCE={r[2]}")

print("\n=== ROW COUNTS PER TENANT CONTEXT ===")
print(f"  {'Table':<35} {'super':>8} {'Nigeria':>9} {'Kenya':>8} {'anon':>7}")
print("  " + "-" * 72)

with connection.cursor() as cur:
    for table in TABLES:
        counts = {}
        for tenant_id, label in CONTEXTS:
            cur.execute("SELECT set_config('app.current_tenant', %s, false)", [tenant_id])
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                counts[label] = cur.fetchone()[0]
            except Exception as e:
                counts[label] = f"ERR:{e}"
        # Always reset
        cur.execute("SELECT set_config('app.current_tenant', '-1', false)")
        print(
            f"  {table:<35}"
            f" {str(counts.get('super-admin (all)', '?')):>8}"
            f" {str(counts.get('Nigeria (id=36)', '?')):>9}"
            f" {str(counts.get('Kenya   (id=25)', '?')):>8}"
            f" {str(counts.get('deny-all (anon)', '?')):>7}"
        )

print("\n=== POLICY CHECK ===")
with connection.cursor() as cur:
    cur.execute("""
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
    """)
    policies = cur.fetchall()
    print(f"  {len(policies)} total policies:")
    for p in policies:
        print(f"    {p[0]:50} {p[1]:35} {p[2]}")

print("\n✅ Verification complete. Reset tenant to deny-all.")
with connection.cursor() as cur:
    cur.execute("SELECT set_config('app.current_tenant', '-1', false)")
