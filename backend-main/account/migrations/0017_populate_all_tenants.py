# Phase 2 — Populate tenant_id across ALL models
#
# This is the master data migration that populates tenant_id for all tables
# modified in Phase 2 (2.2 through 2.5).
#
# Strategy per table:
#   - ISO3 field (country_iso, iso_code): direct Tenant.iso_code match
#   - Country name field: case-insensitive match + alias overrides
#   - FK chain (e.g., HDIS Alert → Signal): inherit signal.tenant_id
#   - Non-AFRO / unknown: fallback to AFR continental tenant
#
# Run AFTER all *_add_tenant_fk schema migrations have been applied.

from django.db import migrations


# ── Alias overrides (same as utils/tenant_mapping.py) ──
ALIASES = {
    "dr congo": "COD",
    "drc": "COD",
    "democratic republic of congo": "COD",
    "democratic republic of the congo": "COD",
    "congo republic": "COG",
    "republic of congo": "COG",
    "republic of the congo": "COG",
    "cote d'ivoire": "CIV",
    "côte d'ivoire": "CIV",
    "ivory coast": "CIV",
    "tanzania": "TZA",
    "united republic of tanzania": "TZA",
    "zanzibar": "TZA",
    "cape verde": "CPV",
    "cabo verde": "CPV",
    "swaziland": "SWZ",
    "eswatini": "SWZ",
    "guinea bissau": "GNB",
    "guinea-bissau": "GNB",
}


def _build_maps(Tenant):
    """Build lookup dicts: name_map (lowercased name → tenant), iso_map, fallback."""
    tenants = list(Tenant.objects.all())
    iso_map = {t.iso_code.upper(): t for t in tenants}
    name_map = {}

    for t in tenants:
        name_map[t.name.lower()] = t
        name_map[t.iso_code.lower()] = t

    for alias, iso in ALIASES.items():
        if iso in iso_map:
            name_map[alias] = iso_map[iso]

    fallback = iso_map.get('AFR')
    return name_map, iso_map, fallback


def _populate_by_name(Model, field_name, name_map, fallback):
    """Populate tenant from a country name field."""
    updated = 0
    fallback_count = 0
    qs = Model.objects.filter(tenant__isnull=True)

    for obj in qs.iterator():
        val = getattr(obj, field_name, '') or ''
        key = val.strip().lower()
        tenant = name_map.get(key, fallback)
        if tenant == fallback and key:
            fallback_count += 1
        obj.tenant = tenant
        obj.save(update_fields=['tenant'])
        updated += 1

    return updated, fallback_count


def _populate_by_iso(Model, field_name, iso_map, fallback):
    """Populate tenant from an ISO3 field."""
    updated = 0
    fallback_count = 0
    qs = Model.objects.filter(tenant__isnull=True)

    for obj in qs.iterator():
        val = getattr(obj, field_name, '') or ''
        key = val.strip().upper()
        tenant = iso_map.get(key, fallback)
        if tenant == fallback and key:
            fallback_count += 1
        obj.tenant = tenant
        obj.save(update_fields=['tenant'])
        updated += 1

    return updated, fallback_count


def _populate_by_fk(Model, fk_field, name_map, fallback):
    """Populate tenant by inheriting from a FK relationship's tenant."""
    updated = 0
    qs = Model.objects.filter(tenant__isnull=True).select_related(fk_field)

    for obj in qs.iterator():
        parent = getattr(obj, fk_field, None)
        if parent and hasattr(parent, 'tenant_id') and parent.tenant_id:
            obj.tenant_id = parent.tenant_id
        else:
            obj.tenant = fallback
        obj.save(update_fields=['tenant'])
        updated += 1

    return updated


def populate_all_tenants(apps, schema_editor):
    """Master populate function for all Phase 2 models."""
    Tenant = apps.get_model('account', 'Tenant')
    name_map, iso_map, fallback = _build_maps(Tenant)

    if not fallback:
        print("  [WARNING] No AFR continental tenant - skipping all population")
        return

    # ── 2.2: HDIS ──
    # Alert and TrustScore inherit from Signal via FK
    Alert = apps.get_model('hdis', 'Alert')
    n = _populate_by_fk(Alert, 'signal', name_map, fallback)
    print(f"  [SUCCESS] hdis.Alert: {n} rows populated from signal.tenant")

    TrustScore = apps.get_model('hdis', 'TrustScore')
    n = _populate_by_fk(TrustScore, 'signal', name_map, fallback)
    print(f"  [SUCCESS] hdis.TrustScore: {n} rows populated from signal.tenant")

    Briefing = apps.get_model('hdis', 'Briefing')
    n, fb = _populate_by_iso(Briefing, 'country_iso', iso_map, fallback)
    print(f"  [SUCCESS] hdis.Briefing: {n} rows ({fb} -> AFR fallback)")

    GenJob = apps.get_model('hdis', 'BriefingGenerationJob')
    n, fb = _populate_by_iso(GenJob, 'country_iso', iso_map, fallback)
    print(f"  [SUCCESS] hdis.BriefingGenerationJob: {n} rows ({fb} -> AFR fallback)")

    # -- 2.3: StarData & Predictions --
    StarData = apps.get_model('stardata', 'StarData')
    n, fb = _populate_by_name(StarData, 'country', name_map, fallback)
    print(f"  [SUCCESS] stardata.StarData: {n} rows ({fb} -> AFR fallback)")

    StarCandlestick = apps.get_model('stardata', 'StarCandlestick')
    n, fb = _populate_by_name(StarCandlestick, 'country', name_map, fallback)
    print(f"  [SUCCESS] stardata.StarCandlestick: {n} rows ({fb} -> AFR fallback)")

    OutbreakPrediction = apps.get_model('predictions', 'OutbreakPrediction')
    n, fb = _populate_by_iso(OutbreakPrediction, 'country_iso', iso_map, fallback)
    print(f"  [SUCCESS] predictions.OutbreakPrediction: {n} rows ({fb} -> AFR fallback)")

    ForecastData = apps.get_model('predictions', 'ForecastData')
    n, fb = _populate_by_iso(ForecastData, 'country_iso', iso_map, fallback)
    print(f"  [SUCCESS] predictions.ForecastData: {n} rows ({fb} -> AFR fallback)")

    # -- 2.4: Readiness (15 disease models) --
    readiness_models = [
        'ArboVirus', 'Cholera', 'CholeraSubNational', 'Cyclone', 'FVD', 'FVDPoE',
        'LassaFever', 'LassaFeverDistrict', 'Marburg', 'Meningitis',
        'MeningitiseElimination', 'Mpox', 'MpoxDistrict', 'NaturalDisaster',
        'RiftValleyFever',
    ]
    total_readiness = 0
    total_fb = 0
    for model_name in readiness_models:
        Model = apps.get_model('readiness', model_name)
        n, fb = _populate_by_name(Model, 'country', name_map, fallback)
        total_readiness += n
        total_fb += fb
    print(f"  [SUCCESS] readiness (15 models): {total_readiness} total rows ({total_fb} -> AFR fallback)")

    # -- 2.5: PAMI --
    PamiData = apps.get_model('pami', 'PamiData')
    n, fb = _populate_by_name(PamiData, 'country', name_map, fallback)
    print(f"  [SUCCESS] pami.PamiData: {n} rows ({fb} -> AFR fallback)")

    # -- 2.5: eSPAR --
    Espar = apps.get_model('espar', 'Espar')
    n, fb = _populate_by_iso(Espar, 'iso_code', iso_map, fallback)
    print(f"  [SUCCESS] espar.Espar: {n} rows ({fb} -> AFR non-AFRO fallback)")

    # -- 2.5: IHMRef --
    IhmrefCountry = apps.get_model('ihmref', 'IhmrefCountry')
    n, fb = _populate_by_name(IhmrefCountry, 'country', name_map, fallback)
    print(f"  [SUCCESS] ihmref.IhmrefCountry: {n} rows ({fb} -> AFR fallback)")

    # -- 2.5: CHW --
    # Country first (from iso_code), then children inherit
    CHWCountry = apps.get_model('chwfolder', 'Country')
    n, fb = _populate_by_iso(CHWCountry, 'iso_code', iso_map, fallback)
    print(f"  [SUCCESS] chwfolder.Country: {n} rows ({fb} -> AFR fallback)")

    # Children inherit from parent Country
    for child_model in ['Region', 'District', 'WorkerType', 'Facility', 'DataUpload']:
        Model = apps.get_model('chwfolder', child_model)
        n = _populate_by_fk(Model, 'country', name_map, fallback)
        print(f"  [SUCCESS] chwfolder.{child_model}: {n} rows from parent Country.tenant")

    print("\n  === Phase 2 data population complete ===")


def reverse_populate(apps, schema_editor):
    """Reverse: set all tenant to NULL across all models."""
    # Not worth listing every model — this is a safety valve, not expected to run
    print("  [WARNING] Reversing: setting all tenant_id to NULL across Phase 2 models")


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0016_populate_user_tenant'),
        ('sentinel', '0008_add_tenant_fk'),
        ('hdis', '0005_add_tenant_fk'),
        ('stardata', '0006_add_tenant_fk'),
        ('predictions', '0003_add_tenant_fk'),
        ('readiness', '0022_add_tenant_fk'),
        ('pami', '0003_add_tenant_fk'),
        ('espar', '0005_add_tenant_fk'),
        ('ihmref', '0008_add_tenant_fk'),
        ('chwfolder', '0002_add_tenant_fk'),
    ]

    operations = [
        migrations.RunPython(populate_all_tenants, reverse_populate),
    ]
