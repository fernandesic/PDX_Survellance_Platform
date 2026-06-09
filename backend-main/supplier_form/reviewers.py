"""
Supplier-form reviewer lookups.

Replaces the previous os.getenv / settings.WORKFLOW_REVIEWER_* reads.
Consumers (supplier_form.services) call supplier_reviewers(section) instead
of touching env vars directly. Edits happen via Django admin on the
SupplierReviewer model; this helper caches the result for 60s so a busy
submission flow doesn't hammer the DB.

Tenant override pattern:
  - If tenant is given AND a row exists with tenant=that_tenant → use it.
  - Otherwise fall back to the global bench (tenant IS NULL).
This mirrors how the env-var version worked (single global bench) while
leaving room for per-country overrides later.
"""

from __future__ import annotations

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_CACHE_PREFIX = 'supplier_form:reviewers'
_CACHE_TTL_SECONDS = 60


def _cache_key(section: str, tenant_id: int | None) -> str:
    return f"{_CACHE_PREFIX}:{section}:t{tenant_id or 0}"


def supplier_reviewers(section: str, *, tenant=None) -> list[str]:
    """Active reviewer emails for a section, ordered by ordinal.

    Returns the tenant-specific bench if any active rows exist for that
    tenant, otherwise falls back to the global bench (tenant IS NULL).
    Returns an empty list if neither has anyone active — callers must
    handle that explicitly (don't raise here; an empty bench during
    rollout shouldn't break a submission).
    """
    if section not in {'A', 'B', 'C', 'D'}:
        raise ValueError(f"Unknown supplier section: {section!r}")

    tenant_id = getattr(tenant, 'id', None) if tenant is not None else None
    key = _cache_key(section, tenant_id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    # Local import: model lives in the same app — avoids an import cycle
    # when this module is imported during app loading.
    from .models import SupplierReviewer

    base_qs = SupplierReviewer.objects.filter(section=section, is_active=True)

    emails: list[str] = []
    if tenant_id is not None:
        emails = list(
            base_qs.filter(tenant_id=tenant_id).order_by('ordinal').values_list('email', flat=True)
        )

    if not emails:
        # Fall back to global (tenant IS NULL).
        emails = list(
            base_qs.filter(tenant__isnull=True).order_by('ordinal').values_list('email', flat=True)
        )

    cache.set(key, emails, _CACHE_TTL_SECONDS)
    return emails


def first_supplier_reviewer(section: str, *, tenant=None) -> str | None:
    """Convenience: first reviewer email for a section, or None if bench empty."""
    emails = supplier_reviewers(section, tenant=tenant)
    return emails[0] if emails else None


def invalidate_supplier_reviewers_cache(section: str | None = None) -> None:
    """Drop the cached reviewer list — call from SupplierReviewer.save/delete signals
    if/when we wire those up. Today the 60s TTL is the only invalidation."""
    if section is None:
        # Best-effort: only clears the global+per-tenant keys we know about
        # if the cache backend supports pattern delete. Most don't, so this
        # is intentionally a no-op fallback; the TTL covers correctness.
        return
    cache.delete(_cache_key(section, None))
