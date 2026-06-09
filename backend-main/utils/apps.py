"""
Utils app configuration.

Registers a connection_created signal handler that resets
app.current_tenant to '-1' (deny-all) whenever a new DB connection
is opened.  This is a defense-in-depth measure: even if a pooled
connection is recycled without going through TenantMiddleware's
process_response reset, the first query on that connection will
not inherit a stale tenant from a previous request.

See: .claude/country-specific-work/rls-implementation-guide.md §3.3
"""

import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class UtilsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'utils'

    def ready(self):
        from django.db.backends.signals import connection_created
        connection_created.connect(_reset_tenant_on_new_connection)


def _reset_tenant_on_new_connection(sender, connection, **kwargs):
    """
    Reset app.current_tenant to '-1' (deny-all) on every new DB connection.

    This fires when Django opens a brand-new connection or recycles one
    from CONN_MAX_AGE expiry.  It does NOT fire on every request — that's
    TenantMiddleware's job.  This catches the edge case where a connection
    is handed out before TenantMiddleware runs (e.g., during app startup,
    management commands, or Celery tasks that don't go through middleware).
    """
    from django.db import DatabaseError
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.current_tenant', '-1', false)")
    except DatabaseError as e:
        logger.warning(
            "Failed to reset app.current_tenant on new connection: %s. "
            "Connection will be closed to prevent tenant leakage.", e
        )
        connection.close()
