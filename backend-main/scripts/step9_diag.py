"""Step 9 diagnostic: check migration state and table schemas for espar + ihmref."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

def q(sql, label):
    print(f"\n{'='*60}\n{label}\n{'='*60}")
    with connection.cursor() as c:
        c.execute(sql)
        if c.description:
            cols = [d[0] for d in c.description]
            rows = c.fetchall()
            print(' | '.join(cols))
            for r in rows:
                print(' | '.join(str(v) for v in r))
            print(f'({len(rows)} rows)')
        else:
            print('(no result set)')

# 1. Applied migrations
q("SELECT app, name FROM django_migrations WHERE app IN ('espar','ihmref') ORDER BY app, id",
  "Applied migrations for espar + ihmref")

# 2. espar_indicator columns
q("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'espar_indicator' ORDER BY ordinal_position",
  "espar_indicator columns (tenant_id should be MISSING)")

# 3. ihmref_countryincident columns
q("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ihmref_countryincident' ORDER BY ordinal_position",
  "ihmref_countryincident columns (tenant_id should be MISSING)")

# 4. Row counts
q("SELECT 'espar_indicator' AS tbl, COUNT(*) AS total FROM espar_indicator", "espar_indicator row count")
q("SELECT 'ihmref_countryincident' AS tbl, COUNT(*) AS total FROM ihmref_countryincident", "ihmref_countryincident row count")

# 5. Check if Indicator has parent FK we can use for backfill
q("SELECT i.id, i.espar_id, e.tenant_id FROM espar_indicator i JOIN espar_espar e ON i.espar_id = e.id LIMIT 5",
  "Indicator -> Espar -> tenant_id (backfill path)")

# 6. Check if CountryIncident has parent FK for backfill
q("SELECT ci.id, ci.country_id, ic.tenant_id FROM ihmref_countryincident ci JOIN ihmref_ihmrefcountry ic ON ci.country_id = ic.id LIMIT 5",
  "CountryIncident -> IhmrefCountry -> tenant_id (backfill path)")

print("\n=== Diagnostic complete ===")
