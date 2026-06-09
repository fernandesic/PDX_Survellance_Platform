"""
Tenant-aware Celery task utilities.

Celery workers do NOT go through Django's TenantMiddleware, so
`app.current_tenant` is never set.  The `connection_created` signal
(utils/apps.py) initialises every new DB connection to '-1' (deny-all).

Once RLS is enabled (Phase 3), Celery tasks that read or write
tenant-scoped tables will see 0 rows unless `app.current_tenant` is
explicitly set at the start of the task.

This module provides:
  - `tenant_context(tenant_id)` — a context manager that sets and resets
    `app.current_tenant` on the PostgreSQL session.
  - `@with_tenant` — a decorator for Celery tasks that wraps the task
    body in a `tenant_context`.

Usage
-----
Cross-tenant background task (super-admin mode, sees ALL rows)::

    @shared_task
    @with_tenant('0')
    def data_retention_task():
        ...

Per-tenant task that receives tenant_id as an argument::

    @shared_task
    @with_tenant(from_kwarg='tenant_id')
    def process_for_tenant(tenant_id):
        ...

Manual context manager usage::

    with tenant_context('0'):
        Signal.objects.filter(created_at__lt=cutoff).update(status='archived')

Design choices:
  - Uses session-scoped `set_config(..., false)` — same as TenantMiddleware.
  - Always resets to '-1' (deny-all) in the `finally` block — fail-closed.
  - If `set_config` fails, the connection is closed (same as middleware).

See also:
  - utils/tenant_middleware.py  — HTTP request tenant context
  - utils/apps.py              — connection_created deny-all default
"""

import functools
import logging
from contextlib import contextmanager

from django.db import DatabaseError, connection

logger = logging.getLogger(__name__)


@contextmanager
def tenant_context(tenant_id: str = '0'):
    """
    Context manager that sets `app.current_tenant` for the duration
    of the block and **restores the previous value** on exit.

    Args:
        tenant_id: The tenant context to set.
            '0'    — super-admin, sees all rows (for cross-tenant tasks).
            '<id>' — specific tenant ID (for per-tenant tasks).
            '-1'   — deny-all (default on connection, used for reset).

    Usage::

        with tenant_context('0'):  # cross-tenant
            Signal.objects.filter(...).update(...)

        with tenant_context('36'):  # as tenant 36 (Nigeria)
            Signal.objects.filter(...)

    NOTE: Previous versions always reset to '-1', which broke views
    where the middleware had already set a valid tenant. Now we
    save/restore the original value (fail-closed to '-1' on error).
    """
    # Save the current tenant so we can restore it on exit.
    previous = '-1'
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_setting('app.current_tenant', true)")
            row = cursor.fetchone()
            if row and row[0]:
                previous = row[0]
    except DatabaseError:
        # No active connection or current_setting unsupported — fall back to deny-all.
        previous = '-1'

    _set_pg_tenant(str(tenant_id))
    try:
        yield
    finally:
        # Restore the previous tenant — not a blind '-1' reset.
        _set_pg_tenant(previous)


def with_tenant(tenant_id: str = '0', *, from_kwarg: str = None):
    """
    Decorator that wraps a function (typically a Celery task) in a
    `tenant_context`.

    Args:
        tenant_id: Default tenant context.  '0' = super-admin (cross-tenant).
        from_kwarg: If set, read the tenant_id from this keyword argument
            instead of using the default.  Falls back to `tenant_id` if the
            kwarg is missing.

    Examples::

        # Always runs as super-admin
        @shared_task
        @with_tenant('0')
        def trust_scores_task():
            ...

        # Reads tenant from task argument
        @shared_task
        @with_tenant(from_kwarg='tid')
        def process_country(tid):
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Determine effective tenant_id
            effective = tenant_id
            if from_kwarg and from_kwarg in kwargs:
                effective = str(kwargs[from_kwarg])
            elif from_kwarg and args:
                # Try positional: inspect the original function's signature
                import inspect
                sig = inspect.signature(func)
                params = list(sig.parameters.keys())
                if from_kwarg in params:
                    idx = params.index(from_kwarg)
                    if idx < len(args):
                        effective = str(args[idx])

            with tenant_context(effective):
                return func(*args, **kwargs)
        return wrapper
    return decorator


def _set_pg_tenant(tenant_id: str):
    """
    Set the PostgreSQL session variable `app.current_tenant`.

    Uses session-scoped `set_config(..., false)` — same semantics
    as TenantMiddleware._set_pg_tenant().
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_tenant', %s, false)",
                [tenant_id],
            )
    except DatabaseError as e:
        logger.error(
            "tenant_tasks: Failed to set app.current_tenant=%s: %s",
            tenant_id, e,
        )
        # Close the connection to prevent returning a tainted connection
        # to the pool (same strategy as TenantMiddleware).
        try:
            connection.close()
        except DatabaseError as e:
            logger.debug("tenant_tasks: connection.close failed: %s", e)
