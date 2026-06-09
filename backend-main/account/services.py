"""
Account — Service Layer (Auth Mutations)

All authentication business logic lives here.
Views call these functions and handle HTTP concerns only.

Used by: account.views (LoginView, LogoutView, TokenRefreshView)
"""

import logging
from datetime import timedelta

from django.contrib.auth import get_user_model, user_logged_in, user_logged_out, user_login_failed
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from account.models import CustomAuthToken, get_setting, AuditLog
from utils.audit import log_audit
from utils.index import update_lock_count

logger = logging.getLogger(__name__)
User = get_user_model()


# ─── Custom Exceptions ──────────────────────────────────────────────────────


class AuthenticationError(Exception):
    """Raised when login fails (wrong credentials, locked account, etc.)."""
    pass


class TokenError(Exception):
    """Raised when token refresh fails (expired, invalid, etc.)."""
    pass


# ─── User serialization ─────────────────────────────────────────────────────


def build_user_data(user) -> dict:
    """Serialise a user object into the JSON payload used by login responses
    and the current-session GET endpoint.

    Reads existing fields only — no DB writes. Pulls supervisor-team
    membership from `readiness.ReportTeam`. Tenant is included as a nested
    dict when set.
    """
    from readiness.models import ReportTeam

    supervisor_teams = ReportTeam.objects.filter(
        supervisor=user, is_active=True,
    ).values('id', 'name', 'code')

    return {
        'email': user.email,
        'id': user.id,
        'is_supervisor': supervisor_teams.exists(),
        'supervisor_teams': list(supervisor_teams),
        'full_name': user.full_name,
        'role': user.role.name if user.role else None,
        'is_super_admin': user.is_super_admin,
        'tenant': {
            'id': user.tenant.id,
            'name': user.tenant.name,
            'iso_code': user.tenant.iso_code,
            'is_continental': user.tenant.is_continental,
        } if user.tenant else None,
    }


# ─── Auth Services ───────────────────────────────────────────────────────────


def authenticate_user(*, email: str, password: str, browser_session_id: str = None, request) -> dict:
    """
    Validate credentials, create auth token, log audit event.

    Returns dict with 'user_data', 'access_token', 'refresh_token'.
    Raises AuthenticationError on any failure.
    """
    try:
        user = User.objects.get(email=email.lower(), email_verified=True, is_deleted=False)
    except User.DoesNotExist:
        log_audit(
            request=request,
            action=AuditLog.Action.LOGIN_FAILED,
            outcome='failure',
            detail=f"No account for email: {email}",
        )
        raise AuthenticationError("Incorrect credentials")

    if user.is_locked():
        raise AuthenticationError("Too many attempts, try again in 5 minutes.")

    trial_count, trial_valid = update_lock_count(user, 'increase')

    if not user.check_password(password):
        user_login_failed.send(sender=user.__class__, credentials={'email': user.email}, request=request)
        log_audit(
            request=request,
            user=user,
            action=AuditLog.Action.LOGIN_FAILED,
            outcome='failure',
            detail=f"Wrong password for {user.email}, {5 - trial_count} attempt(s) left",
        )
        raise AuthenticationError(f"Incorrect credentials, you have {5 - trial_count} attempt(s) left.")

    if not user.email_verified:
        raise AuthenticationError(f"Please Verify your email!, you have {5 - trial_count} attempt(s) left.")

    # ── Success path ──
    device_info = request.META.get('HTTP_USER_AGENT', 'Unknown device')[:255]

    token = CustomAuthToken.objects.create(
        user_type=ContentType.objects.get_for_model(user),
        user_id=user.id,
        device_info=device_info,
        browser_session_id=browser_session_id,
        access_expires_at=timezone.now() + timedelta(
            minutes=get_setting('ACCESS_TOKEN_LIFESPAN_MINUTES', 60)
        ),
        refresh_expires_at=timezone.now() + timedelta(
            days=get_setting('REFRESH_TOKEN_LIFESPAN_DAYS', 30)
        ),
    )

    CustomAuthToken.cleanup_expired_tokens()
    update_lock_count(user, 'fallback')
    user_logged_in.send(sender=user.__class__, request=request, user=user)

    # Check supervisor teams
    from readiness.models import ReportTeam
    supervisor_teams = ReportTeam.objects.filter(
        supervisor=user, is_active=True,
    ).values('id', 'name', 'code')

    user_data = {
        'email': user.email,
        'id': user.id,
        'is_supervisor': supervisor_teams.exists(),
        'supervisor_teams': list(supervisor_teams),
        'full_name': user.full_name,
        'role': user.role.name if user.role else None,
        'is_super_admin': user.is_super_admin,
        'tenant': {
            'id': user.tenant.id,
            'name': user.tenant.name,
            'iso_code': user.tenant.iso_code,
            'is_continental': user.tenant.is_continental,
        } if user.tenant else None,
    }

    from utils.tenant_middleware import TenantMiddleware
    TenantMiddleware._set_pg_tenant(getattr(user, 'tenant_id_for_rls', '-1'))

    log_audit(
        request=request,
        user=user,
        action=AuditLog.Action.LOGIN_SUCCESS,
        detail=f"Login from {device_info[:80]}",
    )

    return {
        'user_data': user_data,
        'access_token': token.access_token,
        'refresh_token': token.refresh_token,
    }


def authenticate_sso_user(*, user, request, provider: str = 'microsoft') -> dict:
    """
    Create auth tokens for an SSO-authenticated user.

    Called after MSAL validates the Azure AD token and the user is
    provisioned/synced by adapters.provision_or_sync_user().

    Follows the same token-creation pattern as authenticate_user() so
    the rest of the platform is completely unaware of SSO.

    Returns dict with 'user_data', 'access_token', 'refresh_token'.
    """
    # Set tenant context BEFORE any DB writes.
    # SSO users may have no tenant yet (NULL) — RLS would block all writes.
    # Use '0' (allow-all) for the callback so tokens + audit logs are created.
    # Once admin assigns a tenant, subsequent logins use the correct tenant.
    from utils.tenant_middleware import TenantMiddleware
    if user.tenant_id:
        TenantMiddleware.apply_tenant_from_user(user, request)
    else:
        TenantMiddleware._set_pg_tenant('0')
        request.tenant_id = '0'

    device_info = request.META.get('HTTP_USER_AGENT', 'Unknown device')[:255]

    token = CustomAuthToken.objects.create(
        user_type=ContentType.objects.get_for_model(user),
        user_id=user.id,
        device_info=device_info,
        access_expires_at=timezone.now() + timedelta(
            minutes=get_setting('ACCESS_TOKEN_LIFESPAN_MINUTES', 30)
        ),
        refresh_expires_at=timezone.now() + timedelta(
            days=get_setting('REFRESH_TOKEN_LIFESPAN_DAYS', 1)
        ),
    )

    CustomAuthToken.cleanup_expired_tokens()
    user_data = build_user_data(user)

    log_audit(
        request=request,
        user=user,
        action=AuditLog.Action.LOGIN_SUCCESS,
        detail=f"SSO login via {provider} from {device_info[:80]}",
    )

    return {
        'user_data': user_data,
        'access_token': token.access_token,
        'refresh_token': token.refresh_token,
    }


def logout_user(*, request) -> None:
    """
    Delete the auth token and log the event.

    Raises no exceptions — best-effort cleanup.
    """
    token = request.auth
    if isinstance(token, CustomAuthToken):
        token.delete()

    user_logged_out.send(sender=request.user.__class__, request=request, user=request.user)
    log_audit(
        request=request,
        user=request.user,
        action=AuditLog.Action.LOGOUT,
        detail=f"User {request.user.email} logged out",
    )


def refresh_tokens(*, request) -> dict:
    """
    Validate the refresh token and rotate both tokens.

    Returns dict with 'access_token', 'refresh_token'.
    Raises TokenError on failure.
    """
    refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
    if not refresh_token:
        raise TokenError("Refresh token is required")

    try:
        token = CustomAuthToken.objects.get(refresh_token=refresh_token.strip())
    except CustomAuthToken.DoesNotExist:
        logger.warning("Invalid refresh token attempted")
        log_audit(
            request=request,
            action=AuditLog.Action.TOKEN_REFRESH,
            outcome='failure',
            detail='Invalid refresh token',
        )
        raise TokenError("Invalid refresh token")

    if token.has_refresh_expired():
        log_audit(
            request=request,
            action=AuditLog.Action.TOKEN_REFRESH,
            outcome='failure',
            detail='Refresh token expired',
        )
        raise TokenError("Refresh token expired")

    token.refresh()

    log_audit(
        request=request,
        user=token.user,
        action=AuditLog.Action.TOKEN_REFRESH,
        detail='Token refreshed successfully',
    )

    return {
        'access_token': token.access_token,
        'refresh_token': token.refresh_token,
    }
