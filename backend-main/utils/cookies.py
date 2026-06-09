"""
Auth cookie utilities — set and clear httpOnly JWT cookies.

All cookie parameters are read from Django settings (AUTH_COOKIE_*),
so they can be tuned per environment without code changes.
"""
from django.conf import settings


def set_auth_cookies(response, access_token: str, refresh_token: str):
    """Attach httpOnly access + refresh cookies to a DRF Response."""
    # Defensively clear any stale access_token cookies left over from previous
    # versions that may have used different paths. Without this, an old cookie
    # with a more-specific path can shadow the new one and cause 401 loops.
    for stale_path in ('/api/', '/api/v1/', '/api/v1/account/'):
        response.delete_cookie(
            key='access_token',
            path=stale_path,
            domain=settings.AUTH_COOKIE_DOMAIN,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=settings.AUTH_COOKIE_ACCESS_MAX_AGE,
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path=settings.AUTH_COOKIE_PATH,
    )
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=settings.AUTH_COOKIE_REFRESH_MAX_AGE,
        httponly=settings.AUTH_COOKIE_HTTPONLY,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
    )
    return response


def clear_auth_cookies(response):
    """Delete auth cookies by setting max_age=0."""
    response.delete_cookie(
        key='access_token',
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key='refresh_token',
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response
