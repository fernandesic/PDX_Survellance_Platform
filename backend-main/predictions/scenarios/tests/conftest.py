"""
conftest.py for scenarios/tests/ — configures Django for standalone testing.

The worktree's predictions/models.py doesn't include Scenario/ScenarioRun
(those exist only in the main repo). We inject a mock ScenarioRun into
predictions.models so that the task code can import it.
"""

import os
import sys
from unittest.mock import MagicMock

import django


def pytest_configure(config):
    """Set up minimal Django settings for testing scenarios serializers/tasks."""
    if not os.environ.get('DJANGO_SETTINGS_MODULE'):
        from django.conf import settings
        if not settings.configured:
            settings.configure(
                DATABASES={
                    'default': {
                        'ENGINE': 'django.db.backends.sqlite3',
                        'NAME': ':memory:',
                    }
                },
                INSTALLED_APPS=[
                    'django.contrib.auth',
                    'django.contrib.contenttypes',
                    'account',
                    'predictions',
                ],
                AUTH_USER_MODEL='account.User',
                DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
                SECRET_KEY='test-secret-key-for-scenarios-tests',
                USE_TZ=True,
            )
            django.setup()

    # After Django setup, inject mock ScenarioRun if not present.
    # The real ScenarioRun lives in the main repo's predictions/models.py
    # but the worktree branch doesn't have it yet.
    import predictions.models as pm
    if not hasattr(pm, 'ScenarioRun'):
        mock_sr = MagicMock()
        mock_sr.STATUS_PENDING = 'PENDING'
        mock_sr.STATUS_RUNNING = 'RUNNING'
        mock_sr.STATUS_SUCCESS = 'SUCCESS'
        mock_sr.STATUS_FAILED = 'FAILED'
        pm.ScenarioRun = mock_sr
    if not hasattr(pm, 'Scenario'):
        pm.Scenario = MagicMock()
