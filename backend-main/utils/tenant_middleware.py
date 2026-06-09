"""
Tenant Middleware — Sets PostgreSQL session variable for RLS.

This middleware runs AFTER Django's AuthenticationMiddleware.
It reads the authenticated user's tenant and sets `app.current_tenant`
as a session-scoped PostgreSQL variable (persists until explicitly changed).

The variable is reset to '-1' (deny-all) in process_response on every
request. A connection_created signal in utils/apps.py provides an
additional safety net for fresh connections.

RLS policies read this variable to filter rows:
  - '0'    → super admin → sees ALL rows
  - '<id>' → country user → sees ONLY their tenant's rows
  - '-1'   → unauthenticated / no tenant → sees ZERO rows (fail-closed)

NOTE: We use session-scoped (is_local=false) because Django middleware
runs OUTSIDE the view's ATOMIC_REQUESTS transaction. Transaction-scoped
(is_local=true) would be discarded before the view executes.
See: .claude/country-specific-work/mistakes.md (Mistake 1)
"""

import logging
from django.db import DatabaseError, connection
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Sets the PostgreSQL session variable `app.current_tenant` based on
    the authenticated user's tenant assignment.

    Uses session-scoped set_config (is_local=false) so the variable
    persists across the entire request. Reset to '-1' in process_response
    as a mandatory cleanup step.

    NOTE: For DRF token-authenticated requests the user is resolved
    inside the view (after middleware). CustomTokenAuthentication calls
    apply_tenant_from_user() after resolving the token so the correct
    tenant is set before any view query runs.
    """

    @staticmethod
    def compute_tenant_id(user, request) -> str:
        """
        Compute the RLS tenant ID string from a user + optional X-Tenant-ID header.

        Returns:
          '0'    — super admin (see all rows)
          '<id>' — country user (or super-admin override via header)
          '-1'   — unauthenticated / no tenant (fail-closed, zero rows)
        """
        if not user or not getattr(user, 'is_authenticated', False):
            return '-1'

        tenant_id = getattr(user, 'tenant_id_for_rls', '-1')

        # Super admin tenant override via X-Tenant-ID header.
        # Only super admins (tenant_id_for_rls == '0') can use this.
        # The header value must be a positive integer (a real tenant ID).
        if tenant_id == '0':
            override = request.META.get('HTTP_X_TENANT_ID', '').strip()
            if override:
                try:
                    override_int = int(override)
                    if override_int > 0:
                        tenant_id = str(override_int)
                except (ValueError, TypeError):
                    pass  # Ignore invalid header, stay as '0' (see-all)

        return tenant_id

    @classmethod
    def apply_tenant_from_user(cls, user, request):
        """
        Compute the tenant ID from user + request and apply it to the DB
        session variable. Stores the result on request.tenant_id.

        Called from CustomTokenAuthentication after resolving the token user,
        ensuring the correct tenant is set before any view query runs.
        """
        tenant_id = cls.compute_tenant_id(user, request)
        request.tenant_id = tenant_id
        cls._set_pg_tenant(tenant_id)

    def process_request(self, request):
        # At Django middleware time, request.user comes from Django's session
        # auth (AuthenticationMiddleware). For DRF token-authenticated requests
        # the user is still AnonymousUser here — CustomTokenAuthentication will
        # call apply_tenant_from_user() after resolving the token.
        user = getattr(request, 'user', None)
        tenant_id = self.compute_tenant_id(user, request)

        # Store on request for downstream views/selectors
        request.tenant_id = tenant_id

        # Set PostgreSQL session variable (session-scoped, persists until reset)
        self._set_pg_tenant(tenant_id)

    def process_response(self, request, response):
        # Reset to deny-all so the pooled connection never leaks tenant context
        self._set_pg_tenant('-1')
        return response

    @staticmethod
    def _set_pg_tenant(tenant_id: str):
        """Set the PostgreSQL session variable (session-scoped, NOT transaction-scoped)."""
        try:
            with connection.cursor() as cursor:
                # is_local=false → session-scoped, survives across transactions.
                # Reset happens in process_response + connection_created signal.
                cursor.execute("SELECT set_config('app.current_tenant', %s, false)", [str(tenant_id)])
        except DatabaseError as e:
            logger.error(f"TenantMiddleware: Failed to set app.current_tenant: {e}")
            # Close the connection to prevent returning a tainted connection
            # (with a stale tenant context) to the pool.
            try:
                connection.close()
            except DatabaseError as close_err:
                logger.debug("TenantMiddleware: connection.close failed: %s", close_err)

