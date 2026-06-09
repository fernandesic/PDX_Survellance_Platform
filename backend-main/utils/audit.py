"""
Audit logging utilities — helper function + automatic middleware.

Two mechanisms:
1. log_audit() — call explicitly for business-logic events (login, form submit, etc.)
2. AuditMiddleware — automatically logs mutating requests to sensitive URL prefixes.

Both write to:
- AuditLog table (queryable, admin-visible, retained forever)
- 'audit' Python logger → audit.log file (for SIEM/compliance export)
"""
import logging
from django.conf import settings
from utils.index import get_client_ip

audit_logger = logging.getLogger('audit')


def log_audit(
    *,
    request=None,
    user=None,
    action: str,
    outcome: str = 'success',
    detail: str = '',
    resource_type: str = '',
    resource_id: str = '',
):
    """
    Create an AuditLog entry and write a structured log line.

    Usage:
        log_audit(
            request=request,
            user=request.user,
            action=AuditLog.Action.DATA_UPLOAD,
            detail="Uploaded 350 StarData records",
            resource_type="StarData",
        )
    """
    # Lazy import to avoid circular imports at module load time
    from account.models import AuditLog

    # Extract request metadata
    ip = None
    user_agent = ''
    endpoint = ''
    http_method = ''

    if request is not None:
        ip = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        endpoint = request.get_full_path()[:500]
        http_method = request.method

    # Resolve user
    resolved_user = user
    if resolved_user is None and request is not None:
        if hasattr(request, 'user') and request.user.is_authenticated:
            resolved_user = request.user

    user_email = ''
    if resolved_user is not None and hasattr(resolved_user, 'email'):
        user_email = resolved_user.email

    # 1. Write to database
    try:
        from django.db import transaction

        # Resolve tenant from user (stays None for anonymous/system events — by design)
        tenant = None
        if resolved_user is not None and hasattr(resolved_user, 'tenant'):
            tenant = resolved_user.tenant  # may still be None

        # Wrap in a savepoint so RLS failures (e.g. null-tenant SSO users)
        # don't poison the outer transaction. See: mistakes.md Pitfall 2
        with transaction.atomic():
            AuditLog.objects.create(
                user=resolved_user if resolved_user and resolved_user.is_authenticated else None,
                user_email=user_email,
                action=action,
                outcome=outcome,
                detail=detail[:2000],  # Truncate long details
                resource_type=resource_type,
                resource_id=str(resource_id)[:100],
                ip_address=ip,
                user_agent=user_agent,
                endpoint=endpoint,
                http_method=http_method,
                tenant=tenant,
            )
    except Exception as e:  # noqa: BLE001 — audit logging must NEVER break the request, regardless of root cause
        # Never let audit logging break the request
        audit_logger.error("Failed to write AuditLog to DB: %s", e)

    # 2. Write to structured log file (for SIEM/compliance)
    audit_logger.info(
        "action=%s outcome=%s user=%s ip=%s method=%s endpoint=%s "
        "resource_type=%s resource_id=%s detail=%s",
        action, outcome, user_email or 'anonymous', ip or '-',
        http_method, endpoint, resource_type, resource_id,
        detail[:200],
    )


# ─── Sensitive URL patterns for automatic middleware logging ────────────

# These prefixes trigger automatic audit logging for POST/PUT/PATCH/DELETE.
# Read-only GET requests are NOT logged automatically (too noisy).
AUDIT_URL_PREFIXES = [
    # Data uploads
    '/api/v1/stardata/load',
    '/api/v1/espar/upload',
    '/api/v1/readiness/load/',
    # Reports
    '/api/v1/readiness/generate-link',
    '/api/v1/readiness/reactivate-link/',
    '/api/v1/readiness/weekly-report-delete/',
    '/api/v1/readiness/update-field',
    '/api/v1/readiness/upload-report-image',
    '/api/v1/readiness/submit-report',
    # Supplier/Department forms
    '/api/v1/supplier-form/generate-link/',
    '/api/v1/supplier-form/submit-section/',
    '/api/v1/supplier-form/delete-form/',
    '/api/v1/department-form/generate-link/',
    '/api/v1/department-form/submit-section/',
    '/api/v1/department-form/delete-form/',
    # Alerts
    '/api/v1/account/alert/',
]

# Map URL substrings to action types for automatic classification
ACTION_MAP = {
    'load': 'data_upload',
    'upload': 'data_upload',
    'delete': 'data_delete',
    'generate-link': 'link_generate',
    'reactivate-link': 'link_reactivate',
    'submit': 'form_submit',
    'update-field': 'report_update',
    'upload-report-image': 'report_update',
    'acknowledge': 'alert_acknowledge',
    'resolve': 'alert_resolve',
}


def _classify_action(path: str) -> str:
    """Determine audit action from URL path."""
    path_lower = path.lower()
    for keyword, action in ACTION_MAP.items():
        if keyword in path_lower:
            return action
    return 'admin_action'


class AuditMiddleware:
    """
    Automatically logs mutating requests (POST/PUT/PATCH/DELETE)
    to sensitive endpoints defined in AUDIT_URL_PREFIXES.

    This is defense-in-depth — individual views can still call log_audit()
    for richer detail, but the middleware ensures nothing slips through.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only log mutating methods
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return response

        # Only log sensitive endpoints
        path = request.path
        if not any(path.startswith(prefix) for prefix in AUDIT_URL_PREFIXES):
            return response

        # Determine outcome from HTTP status
        if response.status_code < 400:
            outcome = 'success'
        elif response.status_code in (401, 403):
            outcome = 'denied'
        else:
            outcome = 'failure'

        action = _classify_action(path)

        # Extract resource ID from URL (last path segment if numeric)
        segments = [s for s in path.rstrip('/').split('/') if s]
        resource_id = ''
        if segments and segments[-1].isdigit():
            resource_id = segments[-1]

        log_audit(
            request=request,
            action=action,
            outcome=outcome,
            detail=f"[AUTO] {request.method} {path} → {response.status_code}",
            resource_id=resource_id,
        )

        return response
