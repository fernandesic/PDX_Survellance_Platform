"""Diagnostic: HDIS migration state + table existence + sentinel NULL rows. Read-only."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

def q(sql, label):
    print(f"\n{'='*60}\n{label}\n{'='*60}")
    with connection.cursor() as c:
        c.execute(sql)
        cols = [d[0] for d in c.description]
        rows = c.fetchall()
        print(' | '.join(cols))
        print('-+-'.join('-'*len(col) for col in cols))
        for r in rows:
            print(' | '.join(str(v) for v in r))
        if not rows:
            print('(0 rows)')
        print(f'({len(rows)} row{"s" if len(rows)!=1 else ""})')

# 1. Which HDIS migrations have actually been applied?
q("SELECT app, name FROM django_migrations WHERE app = 'hdis' ORDER BY id",
  "HDIS migrations in django_migrations")

# 2. What HDIS tables exist in the DB?
q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'hdis%%' ORDER BY table_name",
  "HDIS tables that exist in the DB")

# 3. Columns on each existing HDIS table
for tbl in ['hdis_alert', 'hdis_briefing', 'hdis_pro_generation_job']:
    q(f"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '{tbl}' ORDER BY ordinal_position",
      f"Columns on {tbl}")

# 4. Check if hdis_trustscore was renamed (any table with 'trust' in name)
q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%%trust%%'",
  "Tables matching *trust* (check for rename)")

# 5. Sentinel NULL tenant rows — use source_id not source
q("SELECT id, source_id, location_country_iso, created_at FROM sentinel_signal WHERE tenant_id IS NULL ORDER BY created_at DESC",
  "sentinel_signal rows with NULL tenant_id")

# 6. All applied migrations for sentinel + account (for context)
q("SELECT app, name FROM django_migrations WHERE app IN ('sentinel', 'account', 'hdis') ORDER BY app, id",
  "All migrations applied for sentinel, account, hdis")

print("\n=== Diagnostic complete (read-only) ===")
