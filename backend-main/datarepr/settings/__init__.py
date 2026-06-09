"""
Django settings package for datarepr project.

Loads the appropriate settings module based on DJANGO_SETTINGS_MODULE.
Default: datarepr.settings.local (safe for development).

Production: set DJANGO_SETTINGS_MODULE=datarepr.settings.production
"""
import os

environment = os.getenv('DJANGO_ENV', 'local')

if environment == 'production':
    from .production import *  # noqa: F401,F403
else:
    from .local import *  # noqa: F401,F403
