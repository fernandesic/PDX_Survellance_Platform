"""
Django base settings for datarepr project.

Shared across ALL environments (local, production, testing).
NO secrets, NO debug flags, NO environment-specific values here.
Those belong in local.py or production.py.

For the full list of settings and their values, see
https://docs.djangoproject.com/en/4.2/ref/settings/
"""

from pathlib import Path
import os

import dj_database_url
import dotenv

# Load the right .env file:
#   .env.production  — when DJANGO_ENV=production (set on server via systemd or shell)
#   .env             — local development (default)
_env = os.getenv('DJANGO_ENV', 'local')
_env_file = Path(__file__).resolve().parent.parent.parent / (
    '.env.production' if _env == 'production' else '.env'
)
dotenv.load_dotenv(_env_file)


# ─────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────

# BASE_DIR points to backend-main/ (two levels up from settings/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Data directory for Excel files and other data sources
DATA_DIR = Path(os.getenv('DATA_DIR', BASE_DIR.parent / 'data'))


# ─────────────────────────────────────────────────────────────────
# CORE DJANGO
# ─────────────────────────────────────────────────────────────────

# SECRET_KEY — MUST be set in environment. No fallback, no default.
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError(
        "FATAL: SECRET_KEY environment variable is not set. "
        "This is required for cryptographic signing. "
        "Generate one with: python -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\""
    )

AUTH_USER_MODEL = 'account.User'
ROOT_URLCONF = 'datarepr.urls'
WSGI_APPLICATION = 'datarepr.wsgi.application'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ─────────────────────────────────────────────────────────────────
# INSTALLED APPS
# ─────────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    # Django core
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'corsheaders',
    'drf_yasg',
    'django_crontab',
    'django_filters',
    'rest_framework',
    'rest_framework_simplejwt',

    # Project apps
    'account',
    'chwfolder',
    'espar',
    'readiness',
    'stardata',
    'utils.apps.UtilsConfig',
    'ihmref',
    'sentinel',
    'hdis',
    'supplier_form',
    'department_form',
    'sitrep_form',
    'arcgis_proxy',
    'predictions',
    'verification',
    'pami',
    'pip_dashboard',
    'outbreak',
    'kobo',
]


# ─────────────────────────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────────────────────────

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'utils.security_headers.SecurityHeadersMiddleware',  # CSP + Permissions-Policy for SSO/compliance
    'utils.audit.AuditMiddleware',  # P5: Auto-log mutating requests to sensitive endpoints
    'utils.tenant_middleware.TenantMiddleware',  # P6: Set app.current_tenant for RLS
]


# ─────────────────────────────────────────────────────────────────
# TEMPLATES
# ─────────────────────────────────────────────────────────────────

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# ─────────────────────────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError(
        "FATAL: DATABASE_URL environment variable is not set. "
        "Example: DATABASE_URL=postgresql://user:password@host:5432/dbname"
    )

DATABASES = {
    'default': {
        **dj_database_url.parse(DATABASE_URL),
        'CONN_MAX_AGE': 600,   # Reuse DB connections for 10 minutes
        'ATOMIC_REQUESTS': True,  # Wrap each view in a transaction — required for RLS.
        # TenantMiddleware uses SET LOCAL (transaction-scoped) to set
        # app.current_tenant. Without ATOMIC_REQUESTS, Django autocommit
        # causes each SQL statement to be its own transaction, so the
        # variable is discarded before any query reads it.
        # See: .claude/country-specific-work/mistakes.md (Mistake 1)
        #      .claude/country-specific-work/rls-implementation-guide.md §3.2
    }
}


# ─────────────────────────────────────────────────────────────────
# PASSWORD VALIDATION
# ─────────────────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ─────────────────────────────────────────────────────────────────
# INTERNATIONALIZATION
# ─────────────────────────────────────────────────────────────────

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# ─────────────────────────────────────────────────────────────────
# STATIC & MEDIA FILES
# ─────────────────────────────────────────────────────────────────

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles/')

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# ─────────────────────────────────────────────────────────────────
# DJANGO REST FRAMEWORK
# ─────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'rest_framework.schemas.coreapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'utils.authentication.CustomTokenAuthentication',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'EXCEPTION_HANDLER': 'utils.index.custom_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/min',            # Max 5 login attempts per minute per IP
        'token_refresh': '10/min',   # Max 10 token refreshes per minute per IP
        'kobo_webhook': '30/min',    # Max 30 Kobo webhook pushes per minute per IP
    },
}

# ─────────────────────────────────────────────────────────────────
# CRON — scheduled tasks via django_crontab
# Activate with:  python manage.py crontab add
# Inspect with:   python manage.py crontab show
# ─────────────────────────────────────────────────────────────────

CRONJOBS = [
    # Refresh One Health AI Agent Status every minute from real system state
    # (sentinel signals, spillover cache, active alerts).
    ('* * * * *', 'django.core.management.call_command', ['refresh_oh_agents']),

    # Import real-world outbreak signals (ProMED, WHO DON, ReliefWeb, GDELT)
    # from sentinel_signal into oh_alerts every 5 minutes so the One Health
    # dashboard reflects live external surveillance, not synthetic data.
    ('*/5 * * * *', 'django.core.management.call_command',
     ['import_sentinel_to_oh_alerts']),

    # Refresh Human-in-the-Loop pending queue every 2 minutes from real
    # outbreak alerts (Tier-4 IHR, joint zoonotic etc.).
    ('*/2 * * * *', 'django.core.management.call_command', ['refresh_oh_hitl']),
]


# Swagger / drf-yasg
SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header',
        },
    },
    'PERSIST_AUTH': True,
    'VALIDATOR_URL': None,
    'JSON_EDITOR': True,
}


# ─────────────────────────────────────────────────────────────────
# CORS — Allowed origins (NO wildcard)
# Each environment can extend this list via CORS_ALLOWED_ORIGINS.
# CORS_ALLOW_ALL_ORIGINS is intentionally NEVER set to True.
# ─────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'https://whodata.duckdns.org',
    'https://datarepr.duckdns.org',
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-tenant-id',
]

# ─────────────────────────────────────────────────────────────────
# AUTH COOKIES — httpOnly cookie settings for JWT tokens
# Tokens are set as httpOnly cookies so JavaScript cannot access them,
# mitigating XSS token-theft attacks.
# ─────────────────────────────────────────────────────────────────

AUTH_COOKIE_ACCESS_MAX_AGE = 60 * 15          # 15 minutes (matches ACCESS_TOKEN_LIFESPAN_MINUTES)
AUTH_COOKIE_REFRESH_MAX_AGE = 60 * 60 * 24    # 1 day (matches REFRESH_TOKEN_LIFESPAN_DAYS)
AUTH_COOKIE_SECURE = True                      # Require HTTPS (overridden in local.py)
AUTH_COOKIE_HTTPONLY = True                     # Block JavaScript access
AUTH_COOKIE_SAMESITE = 'Lax'                   # Block cross-origin POST
AUTH_COOKIE_DOMAIN = None                      # Auto from request host
AUTH_COOKIE_PATH = '/'                         # Access cookie sent on all paths
AUTH_COOKIE_REFRESH_PATH = '/api/v1/account/auth/token/refresh'  # Refresh cookie only sent to refresh endpoint


# ─────────────────────────────────────────────────────────────────
# CACHING
# ─────────────────────────────────────────────────────────────────

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}


# ─────────────────────────────────────────────────────────────────
# AUTHENTICATION — Custom Token Lifetimes
# ─────────────────────────────────────────────────────────────────

CUSTOM_AUTH = {
    'ACCESS_TOKEN_LIFESPAN_MINUTES': 30,     # Was 60 — reduced for security
    'REFRESH_TOKEN_LIFESPAN_DAYS': 1,        # Was 30 — reduced to max 1 working day
}


# ─────────────────────────────────────────────────────────────────
# CELERY
# ─────────────────────────────────────────────────────────────────

CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_WORKER_POOL = os.getenv('CELERY_WORKER_POOL', 'solo')

# ── wbepi / rpy2 production hardening (Sprint R4) ────────────────
# R does not aggressively release memory; recycling the worker process
# after N tasks lets the OS reclaim the heap.  50 tasks ≈ 1–2 hours of
# typical scenario traffic.  Override via env if staging shows different
# RSS growth characteristics.
CELERY_WORKER_MAX_TASKS_PER_CHILD = int(
    os.getenv('CELERY_WORKER_MAX_TASKS_PER_CHILD', '50')
)
# rpy2 holds the GIL during R calls and R itself is single-threaded
# per process.  Concurrency must be 1 per prefork child; scale by
# adding more worker processes, not threads.  The 'solo' default is
# fine for local dev; production should use 'prefork'.
CELERY_WORKER_CONCURRENCY = int(
    os.getenv('CELERY_WORKER_CONCURRENCY', '1')
)

# Celery Beat — periodic task schedule
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    'hdis-ingest-all': {
        'task': 'hdis.ingestion.ingest_all_sources',
        'schedule': crontab(minute='*/15'),
    },
    'hdis-trust-scores': {
        'task': 'hdis.tasks.update_trust_scores_task',
        'schedule': crontab(minute='*/30'),
    },
    'hdis-alert-engine': {
        'task': 'hdis.tasks.run_alert_engine_task',
        'schedule': crontab(minute='*/30'),
    },
    'hdis-data-retention': {
        'task': 'hdis.tasks.data_retention_task',
        'schedule': crontab(hour=3, minute=0),
    },
    'hdis-daily-briefing': {
        'task': 'hdis.tasks.generate_daily_briefing_task',
        'schedule': crontab(hour=6, minute=0),
    },
    # Sentinel — ingest signals from GDELT, WHO News, AllAfrica, ReliefWeb
    'sentinel-ingest-gdelt': {
        'task': 'sentinel.ingestion.ingest_from_gdelt',
        'schedule': crontab(minute='*/15'),
    },
    'sentinel-ingest-reliefweb': {
        'task': 'sentinel.ingestion.ingest_from_reliefweb',
        'schedule': crontab(minute='*/15'),
    },
    'sentinel-ingest-who-news': {
        'task': 'sentinel.ingestion.ingest_from_who_news',
        'schedule': crontab(minute='*/15'),
    },
    'sentinel-ingest-allafrica': {
        'task': 'sentinel.ingestion.ingest_from_allafrica',
        'schedule': crontab(minute='*/15'),
    },
    # Outbreak workspace — ingest signals (sentinel, spillover, IDSR DHIS2,
    # transmission drivers, etc.) for every active/confirmed outbreak. The
    # IDSR adaptor's headline numbers flow into Outbreak.confirmed_cases /
    # deaths inside the same task, so the PHEIC banner tracks AFRO without
    # manual intervention.
    'outbreak-ingest-active': {
        'task': 'outbreak.tasks.ingest_active_outbreaks',
        'schedule': crontab(minute='*/30'),
    },
    'verification-capture': {
        'task': 'verification.capture',
        'schedule': crontab(minute='*/30'),
    },
    'verification-pipeline': {
        'task': 'verification.run_pipeline',
        'schedule': crontab(minute='*/30'),
    },
}

HDIS_RETENTION_DAYS = int(os.getenv('HDIS_RETENTION_DAYS', '90'))


# ─────────────────────────────────────────────────────────────────
# EXTERNAL SERVICE KEYS (all from environment)
# ─────────────────────────────────────────────────────────────────

WHONGHUB_API_TOKEN = os.getenv('WHONGHUB_API_TOKEN', '')
WHONGHUB_FIELD_REPORTS_DATASET_ID = os.getenv('WHONGHUB_FIELD_REPORTS_DATASET_ID', '')
GLOBAL_SERVICE_NAME = os.getenv('GLOBAL_SERVICE_NAME', 'drivequick')

# ── KoboToolbox CHW ──────────────────────────────────────────────
KOBO_API_TOKEN = os.getenv('KOBO_API_TOKEN', '')
KOBO_ASSET_ID = os.getenv('KOBO_ASSET_ID', 'aLHVQjZHtA2G8uNW4HxHPh')
KOBO_BASE_URL = os.getenv('KOBO_BASE_URL', 'https://kf.kobotoolbox.org')
KOBO_WEBHOOK_SECRET = os.getenv('KOBO_WEBHOOK_SECRET', '')


# ─────────────────────────────────────────────────────────────────
# EMAIL — SMTP Configuration
# ─────────────────────────────────────────────────────────────────

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.resend.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@pdx.who.int')

POWER_AUTOMATE_WEBHOOK_EMAIL = os.getenv('POWER_AUTOMATE_WEBHOOK_EMAIL', '')

# SendGrid (Web API v3)
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', DEFAULT_FROM_EMAIL)

# Frontend URL (for email links)
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'https://whodata.duckdns.org')


# ─────────────────────────────────────────────────────────────────
# WORKFLOW REVIEWERS
# ─────────────────────────────────────────────────────────────────
# Both review benches moved out of env into the DB:
#   Supplier-form (A_1..D_4):
#     model    → supplier_form.models.SupplierReviewer
#     read via → supplier_form.reviewers.supplier_reviewers(section)
#     admin    → /admin/supplier_form/supplierreviewer/
#     backfill → supplier_form/migrations/0008_seed_supplier_reviewers_from_env.py
#
#   Department-form (A..D):
#     model    → department_form.models.DepartmentReviewer
#     read via → department_form.reviewers.department_reviewer(section)
#     admin    → /admin/department_form/departmentreviewer/
#     backfill → department_form/migrations/0004_seed_department_reviewers.py
#
# AFRO ops can edit reviewers in admin without a deploy.


# ─────────────────────────────────────────────────────────────────
# SECURITY HEADERS (applied in all environments)
# ─────────────────────────────────────────────────────────────────

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'


# ─────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {module}: {message}',
            'style': '{',
        },
        'audit': {
            'format': '{asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'audit_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'audit.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB per file
            'backupCount': 10,             # Keep 10 rotated files (100 MB total)
            'formatter': 'audit',
            'encoding': 'utf-8',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'audit': {
            'handlers': ['audit_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        # wbepi / rpy2 — captures R stdout/stderr routed through rpy2
        # callbacks (see r_engine.py _install_r_log_callbacks).
        'wbepi': {
            'handlers': ['console'],
            'level': os.getenv('WBEPI_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'wbepi.r': {
            'handlers': ['console'],
            'level': os.getenv('WBEPI_R_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}

# Ensure logs directory exists
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)


# ─────────────────────────────────────────────────────────────────
# SSO — Microsoft Azure AD (Entra ID) via MSAL
# Protocol: OpenID Connect (OIDC) via Authorization Code + PKCE
# Library: msal (Microsoft Authentication Library for Python)
#
# NOTE: We use MSAL directly instead of django-allauth because
# allauth.account conflicts with our existing 'account' app label.
# MSAL gives us full control and is closer to the WHO IT reference sample.
# See: .claude/sso-work/mistakes.md (Mistake 1)
# ─────────────────────────────────────────────────────────────────

AZURE_AD_CLIENT_ID = os.getenv('AZURE_AD_CLIENT_ID', '')
AZURE_AD_CLIENT_SECRET = os.getenv('AZURE_AD_CLIENT_SECRET', '')
AZURE_AD_TENANT_ID = os.getenv('AZURE_AD_TENANT_ID', 'organizations')
AZURE_AD_AUTHORITY = f'https://login.microsoftonline.com/{os.getenv("AZURE_AD_TENANT_ID", "organizations")}'
AZURE_AD_SCOPES = ['User.Read']  # Delegated permissions for Microsoft Graph
AZURE_AD_REDIRECT_PATH = '/api/v1/account/auth/sso/callback'  # Must match Azure App Registration

# Login/logout redirect URLs (frontend SPA)
LOGIN_REDIRECT_URL = os.getenv('FRONTEND_BASE_URL', 'https://whodata.duckdns.org')
SSO_LOGOUT_REDIRECT_URL = os.getenv('FRONTEND_BASE_URL', 'https://whodata.duckdns.org') + '/login'


# ─────────────────────────────────────────────────────────────────
# SECURITY HEADERS — WHO Cybersecurity Compliance
# ─────────────────────────────────────────────────────────────────

# ── HSTS (Strict Transport Security) ────────────────────────────
# Forces browsers to use HTTPS. Enabled only in production.
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0'))  # Set to 31536000 (1yr) in production
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'False') == 'True'
SECURE_HSTS_PRELOAD = os.getenv('SECURE_HSTS_PRELOAD', 'False') == 'True'

# ── Cookie Security ─────────────────────────────────────────────
SESSION_COOKIE_HTTPONLY = True      # Prevent JS access to session cookie
SESSION_COOKIE_SAMESITE = 'Lax'    # CSRF protection while allowing SSO redirects
CSRF_COOKIE_HTTPONLY = False        # DRF needs to read CSRF token from JS
CSRF_COOKIE_SAMESITE = 'Lax'

# In production: set these to True (requires HTTPS)
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False') == 'True'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'False') == 'True'
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False') == 'True'

# ── Content Security ────────────────────────────────────────────
SECURE_CONTENT_TYPE_NOSNIFF = True   # Prevent MIME-type sniffing
X_FRAME_OPTIONS = 'DENY'            # Prevent clickjacking (already via middleware)
SECURE_BROWSER_XSS_FILTER = True    # Legacy XSS protection

# ── Content Security Policy (CSP) ───────────────────────────────
# NOTE: django-csp is NOT installed. We use a custom middleware below
# to set CSP headers. This allows Azure AD login redirects while
# blocking XSS attacks.
# If django-csp is installed later, remove the custom middleware
# and use CSP_* settings instead.
CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://login.microsoftonline.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: https:; "
    "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com; "
    "frame-src https://login.microsoftonline.com; "
    "form-action 'self' https://login.microsoftonline.com; "
    "base-uri 'self'; "
    "object-src 'none'; "
)

# ── Permissions Policy ───────────────────────────────────────────
PERMISSIONS_POLICY = (
    "geolocation=(), "
    "microphone=(), "
    "camera=(), "
    "payment=(), "
    "usb=(), "
    "magnetometer=(), "
    "gyroscope=(), "
    "accelerometer=()"
)
