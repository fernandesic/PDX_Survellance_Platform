"""
Local development settings.

Usage: DJANGO_ENV=local (default)
This file extends base.py with development-friendly overrides.
"""

from .base import *  # noqa: F401,F403


# ─────────────────────────────────────────────────────────────────
# DEBUG
# ─────────────────────────────────────────────────────────────────

DEBUG = True


# ─────────────────────────────────────────────────────────────────
# ALLOWED HOSTS — wide open for local dev only
# ─────────────────────────────────────────────────────────────────

ALLOWED_HOSTS = ['*']


# ─────────────────────────────────────────────────────────────────
# CORS — add localhost origins for frontend dev server
# ─────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS += [  # noqa: F405
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]


# ─────────────────────────────────────────────────────────────────
# EMAIL — console backend for dev (no real emails sent)
# Uncomment the line below to print emails to console instead of sending:
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# ─────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────
# AUTH COOKIES — disable Secure flag for local HTTP dev
# ─────────────────────────────────────────────────────────────────

AUTH_COOKIE_SECURE = False
AUTH_COOKIE_REFRESH_PATH = '/api/v1/account/auth/token/refresh'


# ─────────────────────────────────────────────────────────────────
# DATABASE — release connections immediately in dev
# The shared remote DB has limited max_connections. Local dev with
# APScheduler threads + Django dev server can exhaust the pool.
# Setting CONN_MAX_AGE=0 closes connections after each request.
# Production keeps base.py's CONN_MAX_AGE=600 (should use PgBouncer).
# ─────────────────────────────────────────────────────────────────

DATABASES['default']['CONN_MAX_AGE'] = 0  # noqa: F405
