"""
Unit tests for TenantMiddleware and compute_tenant_id logic.

The middleware makes one side-effect: calling set_config() on the DB
cursor. We mock the connection so no real database is needed.
"""
from unittest.mock import MagicMock, call, patch

import pytest
from django.test import RequestFactory

from utils.tenant_middleware import TenantMiddleware


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_mw():
    return TenantMiddleware(get_response=lambda r: MagicMock(status_code=200))


def _mock_cursor(mock_conn):
    """Return a cursor mock and wire the context-manager protocol."""
    cursor = MagicMock()
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=cursor)
    cm.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = cm
    return cursor


def _anon():
    user = MagicMock()
    user.is_authenticated = False
    return user


def _user(tenant_id_for_rls='25'):
    user = MagicMock()
    user.is_authenticated = True
    user.tenant_id_for_rls = tenant_id_for_rls
    return user


factory = RequestFactory()


# ── compute_tenant_id (pure logic, no DB) ─────────────────────────────────────

class TestComputeTenantId:

    def test_unauthenticated_user_returns_minus_one(self):
        request = factory.get('/')
        assert TenantMiddleware.compute_tenant_id(_anon(), request) == '-1'

    def test_none_user_returns_minus_one(self):
        request = factory.get('/')
        assert TenantMiddleware.compute_tenant_id(None, request) == '-1'

    def test_country_user_returns_their_id(self):
        request = factory.get('/')
        assert TenantMiddleware.compute_tenant_id(_user('25'), request) == '25'

    def test_super_admin_returns_zero(self):
        request = factory.get('/')
        assert TenantMiddleware.compute_tenant_id(_user('0'), request) == '0'

    def test_super_admin_valid_header_override(self):
        request = factory.get('/', HTTP_X_TENANT_ID='25')
        assert TenantMiddleware.compute_tenant_id(_user('0'), request) == '25'

    def test_super_admin_negative_header_ignored(self):
        request = factory.get('/', HTTP_X_TENANT_ID='-5')
        assert TenantMiddleware.compute_tenant_id(_user('0'), request) == '0'

    def test_super_admin_zero_header_ignored(self):
        request = factory.get('/', HTTP_X_TENANT_ID='0')
        assert TenantMiddleware.compute_tenant_id(_user('0'), request) == '0'

    def test_super_admin_non_numeric_header_ignored(self):
        request = factory.get('/', HTTP_X_TENANT_ID='not-a-number')
        assert TenantMiddleware.compute_tenant_id(_user('0'), request) == '0'

    def test_country_user_header_ignored(self):
        """Non-super-admin cannot override their tenant via the header."""
        request = factory.get('/', HTTP_X_TENANT_ID='99')
        assert TenantMiddleware.compute_tenant_id(_user('25'), request) == '25'


# ── process_request ───────────────────────────────────────────────────────────

@patch('utils.tenant_middleware.connection')
class TestProcessRequest:

    def test_unauthenticated_sets_deny_all(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        request = factory.get('/')
        request.user = _anon()

        mw.process_request(request)

        assert request.tenant_id == '-1'
        cursor.execute.assert_called_once_with(
            "SELECT set_config('app.current_tenant', %s, false)", ['-1']
        )

    def test_country_user_sets_their_tenant_id(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        request = factory.get('/')
        request.user = _user('25')

        mw.process_request(request)

        assert request.tenant_id == '25'
        cursor.execute.assert_called_once_with(
            "SELECT set_config('app.current_tenant', %s, false)", ['25']
        )

    def test_super_admin_sets_zero(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        request = factory.get('/')
        request.user = _user('0')

        mw.process_request(request)

        assert request.tenant_id == '0'

    def test_super_admin_header_override(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        request = factory.get('/', HTTP_X_TENANT_ID='25')
        request.user = _user('0')

        mw.process_request(request)

        assert request.tenant_id == '25'
        cursor.execute.assert_called_once_with(
            "SELECT set_config('app.current_tenant', %s, false)", ['25']
        )

    def test_country_user_cannot_use_header(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        # Nigeria user (36) sends X-Tenant-ID: 25 (Kenya) — must be ignored
        request = factory.get('/', HTTP_X_TENANT_ID='25')
        request.user = _user('36')

        mw.process_request(request)

        assert request.tenant_id == '36'


# ── process_response ──────────────────────────────────────────────────────────

@patch('utils.tenant_middleware.connection')
class TestProcessResponse:

    def test_response_resets_to_deny_all(self, mock_conn):
        cursor = _mock_cursor(mock_conn)
        mw = _make_mw()
        request = factory.get('/')
        response = MagicMock(status_code=200)

        mw.process_response(request, response)

        cursor.execute.assert_called_with(
            "SELECT set_config('app.current_tenant', %s, false)", ['-1']
        )

    def test_response_returns_response_unchanged(self, mock_conn):
        _mock_cursor(mock_conn)
        mw = _make_mw()
        response = MagicMock(status_code=201)
        result = mw.process_response(factory.get('/'), response)
        assert result is response


# ── _set_pg_tenant error handling ─────────────────────────────────────────────

@patch('utils.tenant_middleware.connection')
class TestSetPgTenantErrorHandling:

    def test_cursor_failure_closes_connection(self, mock_conn):
        """On set_config failure the connection is closed to avoid a tainted pool."""
        mock_conn.cursor.side_effect = Exception('DB is down')

        # Should not raise — error is swallowed, connection closed
        TenantMiddleware._set_pg_tenant('-1')

        mock_conn.close.assert_called_once()
