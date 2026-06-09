"""
Steps 3-8: Synthetic write tests for Priorities 2-7 (FIXED field names).
"""
import time
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from utils.tenant_resolver import resolve_tenant
from django.utils import timezone

ts = int(time.time())
results = []

def test(label, create_fn, verify_fn, cleanup_fn):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    try:
        obj = create_fn()
        print(f"  Created: id={obj.id}, tenant_id={obj.tenant_id}")
        verify_fn(obj)
        print(f"  [OK] Tenant assertion passed")
        cleanup_fn(obj)
        print(f"  [OK] Cleanup done")
        results.append((label, 'PASS'))
    except Exception as e:
        print(f"  [FAIL] {e}")
        results.append((label, f'FAIL: {e}'))


# ─── Priority 2: stardata ─────────────────────────────────────────────
def p2():
    from stardata.models import StarData, StarCandlestick
    MARKER = f'_smoke_p2_{ts}_'
    NGA = resolve_tenant(iso='NGA')

    # StarData
    test('P2 - StarData',
         lambda: StarData.objects.update_or_create(
             country='Nigeria', hazard=MARKER,
             defaults={'severity': 'low', 'risk_level': 'low',
                       'risk_level_number': '1', 'health_consequences': 'test',
                       'tenant': NGA})[0],
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(), None if StarData.objects.filter(hazard=MARKER).count() == 0 else (_ for _ in ()).throw(AssertionError("not deleted"))))

    # StarCandlestick — needs month_num and year
    MARKER2 = f'_smoke_p2c_{ts}_'
    test('P2 - StarCandlestick',
         lambda: StarCandlestick.objects.create(
             country='Nigeria', hazard=MARKER2,
             year='9999', month_num=1, month_key='jan',
             open_val=0, high_val=0, low_val=0, close_val=0,
             tenant=NGA),
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(), None if StarCandlestick.objects.filter(hazard=MARKER2).count() == 0 else (_ for _ in ()).throw(AssertionError("not deleted"))))


# ─── Priority 3: chwfolder ────────────────────────────────────────────
def p3():
    from chwfolder.models import Country
    MARKER = f'_sm_{ts}'[:3].upper()  # iso_code is short
    NGA = resolve_tenant(iso='NGA')

    test('P3 - chwfolder.Country',
         lambda: Country.objects.update_or_create(
             iso_code=f'Z{ts % 100:02d}',
             defaults={'country': f'_smoke_p3_{ts}_', 'tenant': NGA})[0],
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(),))


# ─── Priority 4: pami ─────────────────────────────────────────────────
def p4():
    from pami.models import PamiData
    MARKER = f'_smoke_p4_{ts}_'
    NGA = resolve_tenant(iso='NGA')

    test('P4 - PamiData',
         lambda: PamiData.objects.create(
             country='Nigeria', province=MARKER, district='test',
             priority_index=0, risk_level='low',
             tenant=NGA),
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(), None if PamiData.objects.filter(province=MARKER).count() == 0 else (_ for _ in ()).throw(AssertionError("not deleted"))))


# ─── Priority 5: espar ────────────────────────────────────────────────
def p5():
    from espar.models import Espar
    MARKER = f'_smoke_p5_{ts}_'
    NGA = resolve_tenant(iso='NGA')

    test('P5 - Espar',
         lambda: Espar.objects.update_or_create(
             iso_code='ZZZ', key_on_table=MARKER,
             defaults={'state_name': 'Nigeria', 'total_average': '0',
                       'region': 'test', 'data_received': 'test',
                       'states': 'test', 'tenant': NGA})[0],
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(), None if Espar.objects.filter(key_on_table=MARKER).count() == 0 else (_ for _ in ()).throw(AssertionError("not deleted"))))


# ─── Priority 6: ihmref — read-only audit ─────────────────────────────
def p6():
    from django.db import connection
    print(f"\n{'='*60}")
    print(f"  P6 - IhmrefCountry (read-only audit)")
    print(f"{'='*60}")
    with connection.cursor() as c:
        c.execute("SELECT COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM ihmref_ihmrefcountry")
        total, with_t, null_t = c.fetchone()
        print(f"  IhmrefCountry: {total} total, {with_t} with tenant, {null_t} null")
        if null_t == 0:
            print(f"  [OK] All rows have tenant_id. No write sites exist.")
            results.append(('P6 - IhmrefCountry', 'PASS (read-only, 0 write sites)'))
        else:
            results.append(('P6 - IhmrefCountry', f'FAIL: {null_t} null'))


# ─── Priority 7: readiness ────────────────────────────────────────────
def p7():
    from readiness.models import Cholera
    MARKER = f'_smoke_p7_{ts}_'
    NGA = resolve_tenant(iso='NGA')

    test('P7 - readiness.Cholera',
         lambda: Cholera.objects.create(country='Nigeria', key_on_table=MARKER, tenant=NGA),
         lambda obj: None if obj.tenant_id == NGA.id else (_ for _ in ()).throw(AssertionError(f"got {obj.tenant_id}")),
         lambda obj: (obj.delete(), None if Cholera.objects.filter(key_on_table=MARKER).count() == 0 else (_ for _ in ()).throw(AssertionError("not deleted"))))


# ─── Run all ──────────────────────────────────────────────────────────
p2()
p3()
p4()
p5()
p6()
p7()

# ─── Summary ──────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("  SUMMARY")
print(f"{'='*60}")
for label, result in results:
    s = '[OK]' if 'PASS' in result else '[FAIL]'
    print(f"  {s} {label}: {result}")

passed = sum(1 for _, r in results if 'PASS' in r)
total = len(results)
print(f"\n  {passed}/{total} passed")
if passed == total:
    print("  ALL PRIORITIES PASSED")
else:
    print("  SOME FAILURES - investigate before proceeding")
