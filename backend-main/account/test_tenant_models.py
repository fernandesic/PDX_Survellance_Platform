"""
Tests for tenant-related User model properties.

Uses mocks so no database is needed — the properties are pure Python logic.
"""
from unittest.mock import MagicMock, patch, PropertyMock

from account.models import User


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user(is_superuser=False, role_name=None, is_continental=None, tenant_id=None):
    """Build a minimal mock User for property testing."""
    user = MagicMock(spec=User)
    user.is_superuser = is_superuser

    if role_name:
        user.role = MagicMock()
        user.role.name = role_name
    else:
        user.role = None

    if is_continental is not None:
        user.tenant = MagicMock()
        user.tenant.is_continental = is_continental
    else:
        user.tenant = None

    user.tenant_id = tenant_id
    return user


def _is_super_admin(user) -> bool:
    """Call the real property logic via fget."""
    return User.is_super_admin.fget(user)


def _tenant_id_for_rls(user) -> str:
    """Call the real property logic via fget (is_super_admin patched on the mock)."""
    return User.tenant_id_for_rls.fget(user)


# ── User.is_super_admin ───────────────────────────────────────────────────────

class TestIsSuperAdmin:

    def test_django_superuser_flag_grants_access(self):
        user = _user(is_superuser=True)
        assert _is_super_admin(user) is True

    def test_super_admin_role_grants_access(self):
        user = _user(role_name='super_admin')
        assert _is_super_admin(user) is True

    def test_continental_tenant_grants_access(self):
        user = _user(is_continental=True)
        assert _is_super_admin(user) is True

    def test_regular_user_with_country_tenant_is_not_super_admin(self):
        user = _user(role_name='user', is_continental=False)
        assert _is_super_admin(user) is False

    def test_user_with_no_role_no_tenant_is_not_super_admin(self):
        user = _user()
        assert _is_super_admin(user) is False

    def test_admin_role_is_not_super_admin(self):
        user = _user(role_name='admin')
        assert _is_super_admin(user) is False


# ── User.tenant_id_for_rls ────────────────────────────────────────────────────

class TestTenantIdForRls:

    def _rls(self, is_super, tenant_id=None) -> str:
        user = MagicMock(spec=User)
        # Patch is_super_admin as a property on the mock instance
        type(user).is_super_admin = PropertyMock(return_value=is_super)
        user.tenant_id = tenant_id
        return User.tenant_id_for_rls.fget(user)

    def test_super_admin_returns_zero(self):
        assert self._rls(is_super=True) == '0'

    def test_super_admin_with_tenant_still_returns_zero(self):
        assert self._rls(is_super=True, tenant_id=25) == '0'

    def test_country_user_returns_their_tenant_id(self):
        assert self._rls(is_super=False, tenant_id=25) == '25'

    def test_user_without_tenant_returns_minus_one(self):
        assert self._rls(is_super=False, tenant_id=None) == '-1'

    def test_tenant_id_is_stringified(self):
        result = self._rls(is_super=False, tenant_id=1)
        assert isinstance(result, str)
        assert result == '1'
