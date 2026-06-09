"""
Helpers for resolving the correct `Tenant` row at write time.

Until Phase 3 (RLS) is enabled, the database does NOT auto-populate
`tenant_id` on inserts. Every place that creates a row in a
tenant-scoped table must set `tenant` explicitly. These helpers
provide the canonical lookup logic so callers stay consistent.

Lookup precedence (in `resolve_tenant`):
    1. Explicit `Tenant` instance passed in
    2. ISO 3166-1 alpha-3 code (e.g. 'NGA') — exact match on Tenant.iso_code
    3. Country name (case-insensitive, normalized) — match on Tenant.name
    4. Fallback to AFR continental tenant (is_continental=True)

Always returns a `Tenant` instance — never None — so callers can write
`tenant=resolve_tenant(iso=...)` without further null-checks.
"""
from typing import Optional, Union
from django.core.cache import cache


_CACHE_TTL = 300  # 5 min — tenants change rarely


def _afr_tenant():
    """Return the AFR continental tenant (cached)."""
    cached = cache.get('tenant:afr')
    if cached:
        return cached
    from account.models import Tenant
    afr = Tenant.objects.filter(is_continental=True).first()
    if afr:
        cache.set('tenant:afr', afr, _CACHE_TTL)
    return afr


def _by_iso(iso: str):
    """Lookup Tenant by uppercase ISO-3 code (cached)."""
    iso = (iso or '').strip().upper()
    if not iso or len(iso) != 3:
        return None
    key = f'tenant:iso:{iso}'
    cached = cache.get(key)
    if cached:
        return cached
    from account.models import Tenant
    t = Tenant.objects.filter(iso_code=iso).first()
    if t:
        cache.set(key, t, _CACHE_TTL)
    return t


def _by_name(name: str):
    """Lookup Tenant by case-insensitive name match."""
    name = (name or '').strip()
    if not name:
        return None
    from account.models import Tenant
    return Tenant.objects.filter(name__iexact=name).first()


def resolve_tenant(
    *,
    tenant=None,
    iso: Optional[str] = None,
    name: Optional[str] = None,
    fallback_to_afr: bool = True,
):
    """
    Resolve the most appropriate Tenant row.

    Args:
        tenant: An already-known Tenant instance (returned as-is if truthy).
        iso: ISO-3 country code, e.g. 'NGA'.
        name: Human country name, e.g. 'Nigeria' or 'Côte d'Ivoire'.
        fallback_to_afr: If True (default), fall back to the AFR continental
            tenant when no specific match is found. Pass False to return None
            instead.

    Returns:
        Tenant instance, or None (only if fallback_to_afr=False and no match).
    """
    if tenant is not None:
        return tenant
    if iso:
        t = _by_iso(iso)
        if t:
            return t
    if name:
        t = _by_name(name)
        if t:
            return t
    if fallback_to_afr:
        return _afr_tenant()
    return None


def tenant_from_request(request):
    """
    Pull the request user's tenant if available, else AFR fallback.
    Use this in views that create rows on behalf of a logged-in user.
    """
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        t = getattr(user, 'tenant', None)
        if t is not None:
            return t
    return _afr_tenant()
