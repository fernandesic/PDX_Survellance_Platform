// @vitest-environment jsdom
/**
 * Tests for the useTenant() hook.
 *
 * All tests mock useAuth() so no real AuthProvider or QueryClient is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useTenant } from '../useTenant';

// ── Mock AuthProvider ──────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSetActiveTenantId = vi.fn();

const KENYA_TENANT = {
  id: 25,
  name: 'Kenya',
  iso_code: 'KEN',
  is_continental: false,
};

const AFR_TENANT = {
  id: 1,
  name: 'WHO AFRO Continental',
  iso_code: 'AFR',
  is_continental: true,
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('useTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Regular country user ───────────────────────────────────────────────────

  it('regular user: tenantId equals their own tenant id', () => {
    mockUseAuth.mockReturnValue({
      tenant: KENYA_TENANT,
      isSuperAdmin: false,
      activeTenantId: null,
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBe(25);
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isViewingAsOtherTenant).toBe(false);
    expect(result.current.isoCode).toBe('KEN');
    expect(result.current.tenant).toEqual(KENYA_TENANT);
  });

  it('regular user: activeTenantId is ignored (always their own tenant)', () => {
    // activeTenantId should only apply to super admins
    mockUseAuth.mockReturnValue({
      tenant: KENYA_TENANT,
      isSuperAdmin: false,
      activeTenantId: 36, // Nigeria — should be ignored
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBe(25); // still Kenya
    expect(result.current.isViewingAsOtherTenant).toBe(false);
  });

  it('regular user with no tenant: tenantId and isoCode are null', () => {
    mockUseAuth.mockReturnValue({
      tenant: null,
      isSuperAdmin: false,
      activeTenantId: null,
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBeNull();
    expect(result.current.isoCode).toBeNull();
  });

  // ── Super admin ────────────────────────────────────────────────────────────

  it('super admin: tenantId is null by default (see-all / continental)', () => {
    mockUseAuth.mockReturnValue({
      tenant: AFR_TENANT,
      isSuperAdmin: true,
      activeTenantId: null,
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBeNull();
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.isViewingAsOtherTenant).toBe(false);
  });

  it('super admin with activeTenantId: tenantId is the override', () => {
    mockUseAuth.mockReturnValue({
      tenant: AFR_TENANT,
      isSuperAdmin: true,
      activeTenantId: 25, // Kenya override
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBe(25);
    expect(result.current.isViewingAsOtherTenant).toBe(true);
    expect(result.current.activeTenantId).toBe(25);
  });

  it('super admin: isoCode comes from their own tenant (not the override)', () => {
    // isoCode is always from the login tenant; it is not updated by the override
    // (the override only affects tenantId sent to the API via X-Tenant-ID)
    mockUseAuth.mockReturnValue({
      tenant: AFR_TENANT,
      isSuperAdmin: true,
      activeTenantId: 25,
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    expect(result.current.isoCode).toBe('AFR');
  });

  // ── setActiveTenantId passthrough ──────────────────────────────────────────

  it('setActiveTenantId is passed through from useAuth', () => {
    mockUseAuth.mockReturnValue({
      tenant: AFR_TENANT,
      isSuperAdmin: true,
      activeTenantId: null,
      setActiveTenantId: mockSetActiveTenantId,
    });

    const { result } = renderHook(() => useTenant());

    result.current.setActiveTenantId(25);
    expect(mockSetActiveTenantId).toHaveBeenCalledWith(25);
  });
});
