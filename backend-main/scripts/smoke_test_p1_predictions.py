"""
Step 2: Synthetic write test for Priority 1 (predictions).
Creates ONE OutbreakPrediction + ONE ForecastData with test markers,
asserts tenant_id is correct, then DELETES both. Verifies deletion.
"""
import time
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from predictions.models import OutbreakPrediction, ForecastData
from utils.tenant_resolver import resolve_tenant
from django.utils import timezone
from datetime import timedelta

ts = int(time.time())
MARKER = f'_smoke_test_p1_{ts}_'
ISO = 'NGA'
expected_tenant = resolve_tenant(iso=ISO)

print(f"Test marker: {MARKER}")
print(f"Expected tenant: id={expected_tenant.id}, name={expected_tenant.name}, iso={expected_tenant.iso_code}")
print()

# --- Create OutbreakPrediction ---
print("1. Creating OutbreakPrediction...")
op, op_created = OutbreakPrediction.objects.update_or_create(
    country_iso=ISO,
    disease_name=MARKER,
    defaults={
        'country_name': 'Nigeria',
        'composite_risk_score': 0.0,
        'risk_level': 'low',
        'star_score': 0.0,
        'climate_score': 0.0,
        'sentinel_score': 0.0,
        'espar_score': 0.0,
        'readiness_score': 0.0,
        'predicted_cases_30d': 0,
        'predicted_cases_60d': 0,
        'predicted_cases_90d': 0,
        'confidence': 0,
        'confidence_lower': 0.0,
        'confidence_upper': 0.0,
        'forecast_data': [],
        'climate_drivers': [],
        'data_sources_used': ['smoke_test'],
        'valid_until': timezone.now() + timedelta(hours=1),
        'tenant': resolve_tenant(iso=ISO, name='Nigeria'),
    }
)
assert op_created, f"Expected create, got update (id={op.id})"
assert op.tenant_id == expected_tenant.id, f"tenant_id mismatch: got {op.tenant_id}, expected {expected_tenant.id}"
print(f"   [OK] Created: id={op.id}, tenant_id={op.tenant_id} (expected {expected_tenant.id})")

# --- Create ForecastData ---
print("2. Creating ForecastData...")
fd = ForecastData(
    country_iso=ISO,
    country_name='Nigeria',
    disease=MARKER,
    data_type='national',
    date=timezone.now().date(),
    cases=0,
    tenant=resolve_tenant(iso=ISO),
)
fd.save()
assert fd.tenant_id == expected_tenant.id, f"tenant_id mismatch: got {fd.tenant_id}, expected {expected_tenant.id}"
print(f"   [OK] Created: id={fd.id}, tenant_id={fd.tenant_id} (expected {expected_tenant.id})")

# --- Delete both ---
print("3. Deleting test rows...")
op_id, fd_id = op.id, fd.id
op.delete()
fd.delete()
print(f"   Deleted OutbreakPrediction id={op_id} and ForecastData id={fd_id}")

# --- Verify deletion ---
print("4. Verifying deletion...")
op_remaining = OutbreakPrediction.objects.filter(disease_name=MARKER).count()
fd_remaining = ForecastData.objects.filter(disease=MARKER).count()
assert op_remaining == 0, f"OutbreakPrediction not deleted! Found {op_remaining}"
assert fd_remaining == 0, f"ForecastData not deleted! Found {fd_remaining}"
print(f"   [OK] Verified: 0 OutbreakPrediction, 0 ForecastData with marker '{MARKER}'")

print()
print("=" * 60)
print("PASS — Priority 1 (predictions) synthetic write test passed")
print("=" * 60)
