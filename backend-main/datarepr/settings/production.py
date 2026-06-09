"""
Production settings — hardened for deployment.

Usage: DJANGO_ENV=production

This file enforces:
- HTTPS everywhere
- Strict CORS origins (no wildcards)
- HSTS with preload
- Secure cookies
- No debug information exposed
- No browsable API
"""

import os

from .base import *  # noqa: F401,F403


# ─────────────────────────────────────────────────────────────────
# DEBUG — NEVER True in production
# ─────────────────────────────────────────────────────────────────

DEBUG = False


# ─────────────────────────────────────────────────────────────────
# ALLOWED HOSTS — explicit list, NEVER wildcard
# Set in .env: ALLOWED_HOSTS=datarepr.duckdns.org,whodata.duckdns.org
# ─────────────────────────────────────────────────────────────────

_allowed = os.getenv('ALLOWED_HOSTS', '')
if not _allowed:
    raise ValueError(
        "FATAL: ALLOWED_HOSTS environment variable is not set for production. "
        "Set it to a comma-separated list of your domains. "
        "Example: ALLOWED_HOSTS=datarepr.duckdns.org,whodata.duckdns.org"
    )
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()]


# ─────────────────────────────────────────────────────────────────
# HTTPS / HSTS / COOKIE SECURITY
# ─────────────────────────────────────────────────────────────────

SECURE_SSL_REDIRECT = False  # nginx handles SSL redirect
SECURE_HSTS_SECONDS = 31536000               # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'None'  # Required: SSO init is cross-origin XHR (whodata → datarepr)
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
# Cross-origin auth cookies: frontend (whodata.duckdns.org) and backend
# (datarepr.duckdns.org) are different origins. duckdns.org is a public suffix
# so AUTH_COOKIE_DOMAIN='.duckdns.org' won't work. SameSite=None + Secure=True
# is required for the browser to send cookies cross-origin with withCredentials.
AUTH_COOKIE_SAMESITE = 'None'
AUTH_COOKIE_SECURE = True


# ─────────────────────────────────────────────────────────────────
# DRF — disable browsable API in production
# It leaks schema information and should not be exposed.
# ─────────────────────────────────────────────────────────────────

REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [  # noqa: F405
    'rest_framework.renderers.JSONRenderer',
]


# ─────────────────────────────────────────────────────────────────
# LOGGING — production level
# Suppress debug-level SQL logging, keep warnings and above.
# ─────────────────────────────────────────────────────────────────

LOGGING['loggers']['django']['level'] = 'WARNING'  # noqa: F405
