"""
Tenant resolution helpers.

Mirrors the pattern used across PDX: rows are tenant-scoped by ISO3, and the
`tenant` FK is populated from `country_iso`. RLS then enforces visibility at
the database layer (see migration 000X_enable_rls_verification).

`_resolve_user_tenant` mirrors predictions/views.py: a saved record gets the
acting user's tenant, except super-admins (continental) who may create
cross-tenant — in which case we fall back to the country tenant.
"""

from functools import lru_cache


def tenant_for_iso(iso: str):
    """Return the account.Tenant for an ISO3 code, or None if unmapped."""
    if not iso:
        return None
    from account.models import Tenant
    return Tenant.objects.filter(iso_code__iexact=iso.strip()).first()


def _resolve_user_tenant(user):
    """
    Tenant to attach to a record created by `user`.

    Returns the user's own tenant unless they are super-admin (continental
    scope), in which case None lets the caller fall back to the country tenant.
    None is also returned for unauthenticated requests.
    """
    if not getattr(user, 'is_authenticated', False):
        return None
    if getattr(user, 'is_super_admin', False):
        return None
    return getattr(user, 'tenant', None)


def resolve_record_tenant(country_iso: str, user=None):
    """
    Decide the tenant for a captured/derived record.

    Verification records are anchored to the *subject country* (country_iso),
    not the acting user — a continental analyst capturing a DRC prediction
    still files it under the DRC tenant so country users can see their own
    verification results. Falls back to the user's tenant only when the ISO
    is unmapped.
    """
    return tenant_for_iso(country_iso) or _resolve_user_tenant(user)
