"""
SSO Adapter — MSAL-based Azure AD integration for PDX.

Uses Microsoft Authentication Library (MSAL) directly instead of django-allauth
because allauth.account conflicts with our existing 'account' app label.
See: .claude/sso-work/mistakes.md (Mistake 1)

Handles:
1. MSAL confidential client initialization
2. Authorization URL generation (with PKCE)
3. Token exchange (authorization code → ID token)
4. User profile extraction from ID token + Graph API
5. JIT user provisioning (auto-create PDX user from Azure AD profile)
6. SSO field sync on every login
"""

import logging
import msal
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Microsoft Graph endpoint for user profile
GRAPH_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me'


def _get_msal_app():
    """Build an MSAL ConfidentialClientApplication (cached per process)."""
    return msal.ConfidentialClientApplication(
        client_id=settings.AZURE_AD_CLIENT_ID,
        client_credential=settings.AZURE_AD_CLIENT_SECRET,
        authority=settings.AZURE_AD_AUTHORITY,
    )


def build_auth_url(request):
    """
    Generate the Azure AD authorization URL for the frontend to redirect to.

    Uses MSAL's initiate_auth_code_flow which handles:
    - PKCE (Proof Key for Code Exchange) automatically
    - State parameter for CSRF protection
    - Nonce for token replay prevention

    Returns a dict with 'auth_uri' and the flow state (to be stored in session).
    """
    app = _get_msal_app()

    redirect_uri = request.build_absolute_uri(settings.AZURE_AD_REDIRECT_PATH)

    flow = app.initiate_auth_code_flow(
        scopes=settings.AZURE_AD_SCOPES,
        redirect_uri=redirect_uri,
    )

    if 'error' in flow:
        logger.error("MSAL auth flow init failed: %s", flow.get('error_description', flow))
        raise ValueError(f"SSO initialization failed: {flow.get('error_description', 'Unknown error')}")

    return flow


def complete_auth_flow(request, auth_flow):
    """
    Exchange the authorization code for tokens using MSAL.

    Args:
        request: Django request (contains the callback query params)
        auth_flow: The flow dict from build_auth_url (stored in session)

    Returns:
        dict with 'id_token_claims' and optionally 'access_token'

    Raises:
        ValueError on any authentication failure
    """
    app = _get_msal_app()

    # Django's QueryDict wraps values in lists — MSAL expects plain strings.
    # request.GET.dict() flattens single-value lists to strings.
    result = app.acquire_token_by_auth_code_flow(
        auth_code_flow=auth_flow,
        auth_response=request.GET.dict(),
    )

    if 'error' in result:
        error_desc = result.get('error_description', result.get('error', 'Unknown SSO error'))
        logger.error("MSAL token exchange failed: %s", error_desc)
        raise ValueError(f"SSO authentication failed: {error_desc}")

    return result


def get_user_profile(access_token):
    """
    Fetch user profile from Microsoft Graph API.

    Returns dict with displayName, mail, jobTitle, officeLocation, etc.
    Falls back to empty dict on failure (ID token claims are the primary source).
    """
    try:
        response = requests.get(
            GRAPH_ME_ENDPOINT,
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10,
        )
        if response.status_code == 200:
            return response.json()
        logger.warning("Graph API returned %s: %s", response.status_code, response.text[:200])
    except (requests.RequestException, ValueError, KeyError) as e:
        logger.warning("Graph API call failed: %s", e)
    return {}


def provision_or_sync_user(token_result):
    """
    JIT provision a new user or sync an existing user from Azure AD claims.

    Args:
        token_result: MSAL acquire_token result containing id_token_claims and access_token

    Returns:
        (user, created) tuple — the Django User instance and whether it was just created
    """
    from account.models import User, Role

    claims = token_result.get('id_token_claims', {})
    email = (claims.get('preferred_username') or claims.get('email', '')).lower().strip()

    if not email:
        raise ValueError("SSO token missing email claim — cannot identify user")

    sso_uid = claims.get('oid', '') or claims.get('sub', '')  # Azure AD object ID
    display_name = claims.get('name', '')

    # Try to get extra info from Graph API
    graph_profile = {}
    access_token = token_result.get('access_token')
    if access_token:
        graph_profile = get_user_profile(access_token)
        if not display_name:
            display_name = graph_profile.get('displayName', '')

    # Extract country from Graph API (multiple fallback sources)
    country_name = (
        graph_profile.get('country')           # Best: explicit country field
        or graph_profile.get('usageLocation')   # Fallback: ISO country code (e.g. "KE")
        or graph_profile.get('officeLocation')  # Fallback: office location string
        or 'Not assigned'
    )

    # Try to auto-map country → PDX Tenant
    # This enables automatic RLS scoping for SSO users from configured countries
    from account.models import Tenant
    auto_tenant = None
    if country_name and country_name != 'Not assigned':
        auto_tenant = Tenant.objects.filter(
            name__iexact=country_name
        ).first() or Tenant.objects.filter(
            name__icontains=country_name
        ).first()

    # ── Try to find existing user by email ──
    try:
        user = User.objects.get(email=email, is_deleted=False)
        created = False

        # Sync SSO fields on every login
        user.sso_provider = 'microsoft'
        user.sso_uid = sso_uid
        user.sso_last_synced = timezone.now()
        if display_name:
            user.full_name = display_name
        # Auto-assign tenant if user doesn't have one yet
        if auto_tenant and not user.tenant:
            user.tenant = auto_tenant
            logger.info("SSO auto-assigned tenant '%s' to %s", auto_tenant.name, email)
        user.save(update_fields=['sso_provider', 'sso_uid', 'sso_last_synced', 'full_name', 'tenant'])

        logger.info("SSO login synced existing user: %s (tenant=%s)", email, user.tenant)

    except User.DoesNotExist:
        # ── JIT Provision new user ──
        default_role = Role.objects.filter(name='user').first()

        user = User(
            email=email,
            full_name=display_name or email.split('@')[0],
            email_verified=True,
            sso_provider='microsoft',
            sso_uid=sso_uid,
            sso_last_synced=timezone.now(),
            date_of_birth='Not provided (SSO user)',
            country=country_name,
            role=default_role,
            tenant=auto_tenant,  # Auto-assign if country matches a PDX tenant
        )
        user.set_unusable_password()  # SSO users cannot use local password login
        user.save()
        created = True

        logger.info(
            "SSO JIT provisioned new user: %s (uid=%s, country=%s, tenant=%s)",
            email, sso_uid, country_name, auto_tenant,
        )

    return user, created
