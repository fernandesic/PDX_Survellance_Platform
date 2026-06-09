import logging

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils.timezone import now
from account.models import CustomAuthToken

logger = logging.getLogger(__name__)

# Paths that allow query-parameter token authentication.
# EventSource (SSE) cannot send Authorization headers or cookies,
# so these endpoints accept ?token=<token> as a fallback.
# Restrict to SSE paths only to avoid token leakage in access logs.
_SSE_QUERY_AUTH_PATHS = (
    '/api/v1/hdis/stream/',
    '/api/v1/onehealth/stream/',
    '/api/v1/chat/stream/',
)


def _is_sse_path(path: str) -> bool:
    """True if `path` is an SSE/streaming endpoint allowed to take ?token=.
    Static list + a regex-style match for outbreak per-instance streams:
    /api/v1/outbreak/outbreaks/<id>/stream/
    """
    normalized = path if path.endswith('/') else path + '/'
    if normalized in _SSE_QUERY_AUTH_PATHS:
        return True
    if normalized.startswith('/api/v1/outbreak/outbreaks/') and normalized.endswith('/stream/'):
        return True
    return False


class CustomTokenAuthentication(BaseAuthentication):
    """
    Authenticate via:
      1. Authorization: Bearer <token>   (standard — all endpoints)
      2. access_token httpOnly cookie     (XSS-safe — all endpoints)
      3. ?token= query parameter          (SSE-only — restricted paths)
    """

    def authenticate(self, request):
        token_string = self._extract_token(request)
        if not token_string:
            logger.debug(
                "No token on %s — cookies=%s",
                request.path, list(request.COOKIES.keys()),
            )
            return None

        try:
            token = CustomAuthToken.objects.get(access_token=token_string)

            if token.has_access_expired():
                raise AuthenticationFailed('Access token has expired')

            user = token.user

            # Set app.current_tenant now that we know who the user is.
            # This must happen here (inside the DRF auth call, which runs within
            # the ATOMIC_REQUESTS transaction) rather than in TenantMiddleware
            # (which runs before DRF auth and only sees AnonymousUser for token
            # requests). This overwrites the '-1' set by TenantMiddleware.
            from utils.tenant_middleware import TenantMiddleware
            TenantMiddleware.apply_tenant_from_user(user, request)

            return (user, token)

        except CustomAuthToken.DoesNotExist:
            raise AuthenticationFailed('Invalid access token')

        except AuthenticationFailed:
            raise

        except Exception as e:  # noqa: BLE001 — auth catch-all: any unexpected failure must be rewrapped as AuthenticationFailed
            logger.exception("CustomTokenAuthentication: unexpected error during authenticate(): %s", e)
            raise AuthenticationFailed('Authentication failed. Please login.')

    def _extract_token(self, request) -> str | None:
        """Try Authorization header first, fall back to httpOnly cookie,
        then query parameter (SSE paths only)."""
        # 1. Authorization: Bearer <token>
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            return auth_header.split(' ', 1)[1]

        # 2. httpOnly cookie
        cookie_token = request.COOKIES.get('access_token')
        if cookie_token:
            return cookie_token

        # 3. Query parameter — restricted to SSE/streaming paths only.
        # EventSource cannot send custom headers; this is the only way
        # to authenticate SSE connections. Other endpoints must use
        # header or cookie auth to avoid token leakage in server logs.
        if _is_sse_path(request.path):
            query_token = request.GET.get('token') or request.GET.get('access_token')
            if query_token:
                return query_token

        return None

    def authenticate_header(self, request):
        return 'Bearer'