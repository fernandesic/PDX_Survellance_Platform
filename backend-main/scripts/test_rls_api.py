#!/usr/bin/env python
"""
RLS API Integration Tests — verify Row-Level Security data isolation
through the Django API stack (middleware + DRF auth + views).

This script runs against the REAL database (from .env settings).
RLS migrations must be applied before running.

Usage:
  cd backend-main
  python scripts/test_rls_api.py

No running server required — uses Django's test client internally.
The test client exercises the full middleware + view stack, including
TenantMiddleware and CustomTokenAuthentication.

Cleanup: test users created here are deleted in a finally block.
"""

import os
import sys

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Bootstrap Django ───────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings')

import django
django.setup()

# ── Imports (after setup) ──────────────────────────────────────────────────────
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework.test import APIClient

from account.models import Role, Tenant, CustomAuthToken

User = get_user_model()

# ── Output helpers (ASCII-safe) ───────────────────────────────────────────────

def _ok(msg):   print(f"  [PASS]  {msg}")
def _fail(msg): print(f"  [FAIL]  {msg}")
def _info(msg): print(f"  [info]  {msg}")
def _section(title):
    print(f"\n{'=' * 62}")
    print(f"  {title}")
    print(f"{'=' * 62}")


class RLSTestRunner:

    def __init__(self):
        self._results = []   # [(name, passed: bool)]
        self._test_users = []
        self._test_tokens = []

    # ── assertions ────────────────────────────────────────────────────────────

    def _assert(self, name, passed, detail=''):
        if passed:
            _ok(f"{name}{' — ' + detail if detail else ''}")
        else:
            _fail(f"{name}{' — ' + detail if detail else ''}")
        self._results.append((name, passed))
        return passed

    def _eq(self, name, actual, expected):
        return self._assert(name, actual == expected,
                            f"expected {expected!r}, got {actual!r}")

    def _gt(self, name, actual, threshold):
        return self._assert(name, actual > threshold,
                            f"{actual} > {threshold}")

    def _lt(self, name, actual, threshold):
        return self._assert(name, actual < threshold,
                            f"{actual} < {threshold}")

    # ── setup ─────────────────────────────────────────────────────────────────

    def setup(self):
        _section("Setup — Creating temporary test users")

        try:
            kenya   = Tenant.objects.get(iso_code='KEN')
            nigeria = Tenant.objects.get(iso_code='NGA')
            afr     = Tenant.objects.get(iso_code='AFR')
            sa_role = Role.objects.get(name='super_admin')
            u_role  = Role.objects.get(name='user')
        except (Tenant.DoesNotExist, Role.DoesNotExist) as e:
            print(f"\n{RED}FATAL:{RESET} Missing DB objects: {e}")
            print("  Run: python scripts/seed_tenants.py && python manage.py seed_users")
            sys.exit(1)

        _info(f"Kenya tenant: id={kenya.id} ({kenya.name})")
        _info(f"Nigeria tenant: id={nigeria.id} ({nigeria.name})")

        def _get_or_create_user(email, role, tenant, is_superuser=False):
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'full_name': f'RLS Test {role.name}',
                    'date_of_birth': '1990-01-01',
                    'country': tenant.name,
                    'role': role,
                    'tenant': tenant,
                    'is_active': True,
                    'email_verified': True,
                    'is_superuser': is_superuser,
                },
            )
            if not created:
                # Ensure tenant/role are correct (user may have been leftover)
                user.role = role
                user.tenant = tenant
                user.is_active = True
                user.email_verified = True
            user.set_password('rls-test-pass-9876!')
            user.save()
            self._test_users.append(user)
            _ok(f"{'Created' if created else 'Updated'}: {email}")
            return user

        self.sa_user  = _get_or_create_user('_rls_sa@__rls_test__.int',  sa_role, afr)
        self.ken_user = _get_or_create_user('_rls_ken@__rls_test__.int', u_role,  kenya)
        self.nga_user = _get_or_create_user('_rls_nga@__rls_test__.int', u_role,  nigeria)
        self.kenya    = kenya
        self.nigeria  = nigeria

    # ── helpers ───────────────────────────────────────────────────────────────

    def _client_for(self, user):
        """Return a DRF APIClient authenticated with a real token.

        force_authenticate() bypasses CustomTokenAuthentication.authenticate()
        entirely, so the tenant context fix never runs. We must create a real
        CustomAuthToken and send it in the Authorization header — this exercises
        the full middleware + auth + RLS pipeline.
        """
        ct = ContentType.objects.get_for_model(user)
        token = CustomAuthToken.objects.create(
            user_type=ct,
            user_id=user.id,
            access_expires_at=timezone.now() + timedelta(hours=1),
            refresh_expires_at=timezone.now() + timedelta(days=1),
        )
        self._test_tokens.append(token)

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')
        return client

    def _signal_count(self, client, extra_headers=None):
        """GET /api/v1/sentinel/signals/ and return the row count."""
        kwargs = {}
        if extra_headers:
            kwargs.update(extra_headers)
        resp = client.get('/api/v1/sentinel/signals/', **kwargs)
        if resp.status_code != 200:
            return None, resp.status_code
        data = resp.json()
        if isinstance(data, list):
            return len(data), 200
        # Paginated response
        return data.get('count', len(data.get('results', []))), 200

    def _signal_isos(self, client):
        """Return the set of ISO codes in the response (for isolation check)."""
        resp = client.get('/api/v1/sentinel/signals/')
        if resp.status_code != 200:
            return None
        data = resp.json()
        rows = data if isinstance(data, list) else data.get('results', [])
        return {r.get('location_country_iso') for r in rows}

    # ── Test 1: Sentinel signals isolation ────────────────────────────────────

    def test_signals_isolation(self):
        _section("Test 1 — /api/v1/sentinel/signals/ — tenant isolation")

        # Super admin: must see all signals (many tables)
        sa_client = self._client_for(self.sa_user)
        sa_count, sa_status = self._signal_count(sa_client)
        self._eq("Super admin: 200 response", sa_status, 200)
        self._gt("Super admin: sees > 0 signals", sa_count or 0, 0)
        _info(f"Super admin count: {sa_count}")

        # Kenya user: must see only Kenya signals
        ken_client = self._client_for(self.ken_user)
        ken_count, ken_status = self._signal_count(ken_client)
        self._eq("Kenya user: 200 response", ken_status, 200)
        _info(f"Kenya user count: {ken_count}")

        if sa_count and ken_count is not None:
            self._lt("Kenya user: sees FEWER than super admin", ken_count, sa_count)

        ken_isos = self._signal_isos(ken_client)
        if ken_isos is not None and len(ken_isos) > 0:
            non_ken = ken_isos - {'KEN'}
            self._assert(
                "Kenya user: zero non-KEN ISO codes in response",
                len(non_ken) == 0,
                f"unexpected ISOs: {non_ken}" if non_ken else '',
            )

        # Nigeria user: must see only Nigeria signals
        nga_client = self._client_for(self.nga_user)
        nga_count, nga_status = self._signal_count(nga_client)
        self._eq("Nigeria user: 200 response", nga_status, 200)
        _info(f"Nigeria user count: {nga_count}")

        nga_isos = self._signal_isos(nga_client)
        if nga_isos is not None and len(nga_isos) > 0:
            non_nga = nga_isos - {'NGA'}
            self._assert(
                "Nigeria user: zero non-NGA ISO codes in response",
                len(non_nga) == 0,
                f"unexpected ISOs: {non_nga}" if non_nga else '',
            )

        # Unauthenticated: must get 401
        anon_client = APIClient()
        resp = anon_client.get('/api/v1/sentinel/signals/')
        self._eq("Unauthenticated: 401 response", resp.status_code, 401)

        # Cross-tenant: Kenya and Nigeria must not overlap (if both have data)
        if ken_count and nga_count:
            # We can't directly compare sets across clients but we can check
            # that each user's ISO set is exclusive
            _info("Both countries have signals — isolation confirmed by ISO checks above")

    # ── Test 2: Super admin X-Tenant-ID header override ───────────────────────

    def test_header_override(self):
        _section("Test 2 — X-Tenant-ID header override (super admin only)")

        sa_client = self._client_for(self.sa_user)

        # Without header: super admin sees all
        all_count, _ = self._signal_count(sa_client)
        _info(f"Super admin (no header): {all_count} signals")

        # With X-Tenant-ID = Kenya: must see only Kenya signals
        ken_count, status = self._signal_count(
            sa_client, extra_headers={'HTTP_X_TENANT_ID': str(self.kenya.id)}
        )
        self._eq("X-Tenant-ID: 200 response", status, 200)
        _info(f"Super admin with X-Tenant-ID={self.kenya.id} (KEN): {ken_count} signals")

        if all_count and ken_count is not None:
            self._lt("X-Tenant-ID: filtered count < total count", ken_count, all_count)

        # Verify ISOs
        sa_client_copy = self._client_for(self.sa_user)
        resp = sa_client_copy.get(
            '/api/v1/sentinel/signals/',
            HTTP_X_TENANT_ID=str(self.kenya.id),
        )
        if resp.status_code == 200:
            data = resp.json()
            rows = data if isinstance(data, list) else data.get('results', [])
            non_ken = {r.get('location_country_iso') for r in rows} - {'KEN'}
            self._assert(
                "X-Tenant-ID: all returned signals are KEN",
                len(non_ken) == 0,
                f"unexpected ISOs: {non_ken}" if non_ken else '',
            )

        # Country user cannot use X-Tenant-ID to see another tenant's data
        ken_client = self._client_for(self.ken_user)
        nga_count_via_header, _ = self._signal_count(
            ken_client,
            extra_headers={'HTTP_X_TENANT_ID': str(self.nigeria.id)},
        )
        _info(f"Kenya user with X-Tenant-ID={self.nigeria.id} (NGA): {nga_count_via_header} signals")
        # Kenya user must still only see Kenya data (header is ignored for non-super-admin)
        ken_direct, _ = self._signal_count(self._client_for(self.ken_user))
        self._assert(
            "Country user: X-Tenant-ID header is ignored",
            nga_count_via_header == ken_direct,
            f"with header: {nga_count_via_header}, without: {ken_direct}",
        )

    # ── Test 3: middleware properties (is_super_admin, tenant_id_for_rls) ─────

    def test_tenant_id_for_rls_values(self):
        _section("Test 3 — User.tenant_id_for_rls computed values")

        self._eq("Super admin: tenant_id_for_rls == '0'",
                 self.sa_user.tenant_id_for_rls, '0')
        self._eq("Kenya user: tenant_id_for_rls == str(kenya.id)",
                 self.ken_user.tenant_id_for_rls, str(self.kenya.id))
        self._eq("Nigeria user: tenant_id_for_rls == str(nigeria.id)",
                 self.nga_user.tenant_id_for_rls, str(self.nigeria.id))

        self._eq("Super admin: is_super_admin == True",
                 self.sa_user.is_super_admin, True)
        self._eq("Kenya user: is_super_admin == False",
                 self.ken_user.is_super_admin, False)

    # ── cleanup ───────────────────────────────────────────────────────────────

    def cleanup(self):
        _section("Cleanup — Deleting temporary test data")
        for token in self._test_tokens:
            try:
                token.delete()
            except Exception:
                pass
        _ok(f"Deleted {len(self._test_tokens)} test tokens")
        for user in self._test_users:
            user.delete()
            _ok(f"Deleted user: {user.email}")

    # ── run ───────────────────────────────────────────────────────────────────

    def run(self):
        db_host = os.getenv('DATABASE_URL', '(from .env)').split('@')[-1]
        print(f"\n{'=' * 62}")
        print(f"   RLS API Integration Tests")
        print(f"   Database: {db_host}")
        print(f"{'=' * 62}")

        try:
            self.setup()
            self.test_tenant_id_for_rls_values()
            self.test_signals_isolation()
            self.test_header_override()
        finally:
            self.cleanup()

        # ── Summary ───────────────────────────────────────────────────────────
        _section("Summary")
        passed = sum(1 for _, p in self._results if p)
        total  = len(self._results)

        for name, p in self._results:
            icon = "PASS" if p else "FAIL"
            print(f"  [{icon}]  {name}")

        print()
        if passed == total:
            print(f"OK -- All {total} tests passed!\n")
            return 0
        else:
            print(f"FAILED -- {total - passed}/{total} tests failed.\n")
            return 1


if __name__ == '__main__':
    sys.exit(RLSTestRunner().run())
