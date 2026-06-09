"""Espar smoke test — use existing Sheet, correct fields."""
import time, django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from espar.models import Espar, Sheet
from utils.tenant_resolver import resolve_tenant

ts = int(time.time())
MARKER = f'_smoke_p5_{ts}_'
NGA = resolve_tenant(iso='NGA')

print("P5 - Espar")
sheet = Sheet.objects.first()
print(f"  Using existing Sheet id={sheet.id}")

obj = Espar.objects.create(
    sheet=sheet, iso_code='ZZZ', key_on_table=MARKER,
    total_average='0', region='test', data_received='test', states='test',
    tenant=NGA,
)
print(f"  Created: id={obj.id}, tenant_id={obj.tenant_id}")
assert obj.tenant_id == NGA.id, f"Expected {NGA.id}, got {obj.tenant_id}"
print(f"  [OK] Tenant assertion passed")

obj.delete()
assert Espar.objects.filter(key_on_table=MARKER).count() == 0
print(f"  [OK] Cleanup verified")
print("  PASS")
