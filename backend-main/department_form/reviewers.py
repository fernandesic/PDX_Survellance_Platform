"""
Department-form reviewer lookups.

Replaces the previous os.getenv / settings.DEPARTMENT_WORKFLOW_REVIEWER_*
reads. Consumers (department_form.services, department_form.emails) call
department_reviewer(section) instead of touching env vars directly. Edits
happen via Django admin on the DepartmentReviewer model; this helper
caches the result for 60s so a busy submission flow doesn't hammer the DB.

Tenant override pattern:
  - If tenant is given AND an active row exists with tenant=that_tenant → use it.
  - Otherwise fall back to the global reviewer (tenant IS NULL).
This mirrors how the env-var version worked (single global reviewer per
section) while leaving room for per-country overrides later.

Separate from supplier_form.reviewers on purpose — the two forms have
different review semantics (supplier = bench of N, department = one per
section) and the user wants the apps fully independent.
"""

from __future__ import annotations

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_CACHE_PREFIX = 'department_form:reviewer'
_CACHE_TTL_SECONDS = 60

_VALID_SECTIONS = {'A', 'B', 'C', 'D'}


def _cache_key(section: str, tenant_id: int | None) -> str:
    return f"{_CACHE_PREFIX}:{section}:t{tenant_id or 0}"


def department_reviewer(section: str, *, tenant=None) -> str | None:
    """Active reviewer email for a section, or None if no one is assigned.

    Returns the tenant-specific reviewer if any active row exists for that
    tenant, otherwise falls back to the global reviewer (tenant IS NULL).
    Returns None if neither exists — callers must handle that explicitly
    (don't raise here; an empty assignment during rollout shouldn't break
    a submission).
    """
    if section not in _VALID_SECTIONS:
        raise ValueError(f"Unknown department section: {section!r}")

    tenant_id = getattr(tenant, 'id', None) if tenant is not None else None
    key = _cache_key(section, tenant_id)
    cached = cache.get(key, _SENTINEL)
    if cached is not _SENTINEL:
        return cached

    # Local import: model lives in the same app — avoids an import cycle
    # when this module is imported during app loading.
    from .models import DepartmentReviewer

    base_qs = DepartmentReviewer.objects.filter(section=section, is_active=True)

    email: str | None = None
    if tenant_id is not None:
        email = base_qs.filter(tenant_id=tenant_id).values_list('email', flat=True).first()

    if email is None:
        email = base_qs.filter(tenant__isnull=True).values_list('email', flat=True).first()

    cache.set(key, email, _CACHE_TTL_SECONDS)
    return email


# Sentinel so we can distinguish "cache has stored None" from "cache miss".
_SENTINEL = object()


def invalidate_department_reviewer_cache(section: str | None = None) -> None:
    """Drop the cached reviewer — call from DepartmentReviewer.save/delete signals
    if/when we wire those up. Today the 60s TTL is the only invalidation."""
    if section is None:
        return
    cache.delete(_cache_key(section, None))
