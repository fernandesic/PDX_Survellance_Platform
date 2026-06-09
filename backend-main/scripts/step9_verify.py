"""Step 9 verification: confirm tenant_id columns exist and are fully populated."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

def q(sql, label):
    with connection.cursor() as c:
        c.execute(sql)
        row = c.fetchone()
        print(f"  {label}: total={row[0]}, with_tenant={row[1]}, null={row[2]}")
        return row[2]  # null count

print("Step 9 verification:")
n1 = q("SELECT COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM espar_indicator",
       "espar_indicator")
n2 = q("SELECT COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM ihmref_countryincident",
       "ihmref_countryincident")

if n1 == 0 and n2 == 0:
    print("\n  [OK] Both tables fully populated. Step 9 Phase 1+2 COMPLETE.")
else:
    print(f"\n  [WARN] {n1 + n2} null rows remaining.")
