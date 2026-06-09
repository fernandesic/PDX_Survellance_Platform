"""
Tenant Mapping Utilities — Country name / ISO → Tenant ID resolution.

Used by data migrations across all apps to populate tenant_id from
existing country fields. Handles the 3 formats found in the codebase:
  1. ISO3 code  → direct Tenant.iso_code match
  2. Country name → case-insensitive Tenant.name match + alias overrides
  3. FK chain → join through existing FK relationships

Non-AFRO countries (Djibouti, Egypt, Libya, etc.) map to the AFR
continental tenant — visible to super admin only under RLS.

See: .claude/country-specific-work/mistakes.md (country mapping strategy)
"""

# ── Alias overrides for country names that don't match Tenant.name ──
# Keys are LOWERCASED; values are ISO3 codes in Tenant.iso_code.
COUNTRY_NAME_TO_ISO = {
    # DRC variants
    "dr congo": "COD",
    "drc": "COD",
    "democratic republic of congo": "COD",
    "democratic republic of the congo": "COD",

    # Congo Republic variants
    "congo republic": "COG",
    "republic of congo": "COG",
    "republic of the congo": "COG",

    # Côte d'Ivoire variants
    "cote d'ivoire": "CIV",
    "côte d'ivoire": "CIV",
    "ivory coast": "CIV",

    # Tanzania
    "tanzania": "TZA",
    "united republic of tanzania": "TZA",
    "zanzibar": "TZA",  # Zanzibar is part of Tanzania

    # Cabo Verde / Cape Verde
    "cape verde": "CPV",
    "cabo verde": "CPV",

    # Eswatini / Swaziland
    "swaziland": "SWZ",
    "eswatini": "SWZ",

    # Guinea-Bissau variants
    "guinea bissau": "GNB",
    "guinea-bissau": "GNB",
}

# ── Non-AFRO countries → map to AFR continental ──
# These countries appear in some datasets (eSPAR is global, readiness has
# a few non-AFRO entries) but are NOT among the 47 AFRO member states.
NON_AFRO_FALLBACK_ISO = "AFR"


def build_name_to_tenant_map(Tenant):
    """
    Build a lowercased country-name → Tenant instance lookup dict.

    Args:
        Tenant: The Tenant model class (passed to avoid circular imports
                in data migrations where models are accessed via apps.get_model).

    Returns:
        dict: {lowercased_name: Tenant instance}
    """
    tenants = {t.iso_code: t for t in Tenant.objects.all()}
    name_map = {}

    # 1. Direct name match (lowercased)
    for t in tenants.values():
        name_map[t.name.lower()] = t

    # 2. ISO code match (lowercased)
    for t in tenants.values():
        name_map[t.iso_code.lower()] = t

    # 3. Alias overrides
    for alias, iso in COUNTRY_NAME_TO_ISO.items():
        if iso in tenants:
            name_map[alias.lower()] = tenants[iso]

    return name_map, tenants.get(NON_AFRO_FALLBACK_ISO)


def resolve_tenant_by_name(name, name_map, fallback_tenant):
    """
    Resolve a country name/ISO to a Tenant instance.

    Args:
        name: Country name or ISO code (any casing)
        name_map: Dict from build_name_to_tenant_map()
        fallback_tenant: AFR continental tenant for non-AFRO countries

    Returns:
        Tenant instance or None if name is empty/null
    """
    if not name or not name.strip():
        return fallback_tenant

    key = name.strip().lower()
    return name_map.get(key, fallback_tenant)


def resolve_tenant_by_iso(iso_code, iso_map, fallback_tenant):
    """
    Resolve an ISO3 code to a Tenant instance.

    Args:
        iso_code: ISO 3166-1 alpha-3 code (any casing)
        iso_map: Dict of {iso_code: Tenant instance}
        fallback_tenant: AFR continental tenant

    Returns:
        Tenant instance or fallback
    """
    if not iso_code or not iso_code.strip():
        return fallback_tenant

    return iso_map.get(iso_code.strip().upper(), fallback_tenant)
"""
The functions above are designed to be called from data migrations like:

    from utils.tenant_mapping import build_name_to_tenant_map, resolve_tenant_by_name

    def populate_tenant(apps, schema_editor):
        Tenant = apps.get_model('account', 'Tenant')
        MyModel = apps.get_model('myapp', 'MyModel')
        name_map, fallback = build_name_to_tenant_map(Tenant)

        for obj in MyModel.objects.filter(tenant__isnull=True):
            obj.tenant = resolve_tenant_by_name(obj.country, name_map, fallback)
            obj.save(update_fields=['tenant'])
"""
