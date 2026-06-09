/**
 * useTenant() — Primary hook for tenant-aware components.
 *
 * Returns the current tenant context:
 *  - tenantId: the effective tenant ID (overridden for super-admin, else from login)
 *  - tenant: the full TenantInfo object from the login response
 *  - isSuperAdmin: whether the user is a continental/super admin
 *  - isViewingAsOtherTenant: true when a super admin is impersonating a country tenant
 *  - activeTenantId: the super-admin override (null = viewing as self)
 *  - setActiveTenantId: setter for super-admin tenant switching
 *  - isoCode: shortcut to the effective ISO code (from override or login tenant)
 *
 * For regular users, tenantId always comes from their login response.
 * For super admins, tenantId defaults to null (see-all) but can be overridden
 * via setActiveTenantId() to impersonate a specific country tenant.
 */

import { useAuth } from "@/contexts/AuthProvider";
import type { TenantInfo } from "@/types/auth_type";

interface UseTenantReturn {
  /** The effective tenant ID for data scoping. null = see-all (super admin default) */
  tenantId: number | null;
  /** The user's own tenant from the login response */
  tenant: TenantInfo | null;
  /** Whether the current user is a super admin */
  isSuperAdmin: boolean;
  /** True when a super admin is viewing as a specific country tenant */
  isViewingAsOtherTenant: boolean;
  /** The super-admin override tenant ID (null = no override) */
  activeTenantId: number | null;
  /** Switch to a different tenant (super admin only). Clears query cache. */
  setActiveTenantId: (id: number | null) => void;
  /** The effective ISO code (from override or user's tenant) */
  isoCode: string | null;
}

export function useTenant(): UseTenantReturn {
  const { tenant, isSuperAdmin, activeTenantId, setActiveTenantId } = useAuth();

  // For super admin: activeTenantId overrides if set, else null (see-all)
  // For regular users: always their own tenant ID
  const tenantId = isSuperAdmin
    ? activeTenantId  // null = see-all, or the overridden ID
    : (tenant?.id ?? null);

  const isViewingAsOtherTenant = isSuperAdmin && activeTenantId !== null;

  // ISO code: if super admin is overriding, we don't have the override's ISO
  // from the login response — the TenantSwitcher component will need to provide it.
  // For regular users, it's their own tenant's ISO code.
  const isoCode = tenant?.iso_code ?? null;

  return {
    tenantId,
    tenant,
    isSuperAdmin,
    isViewingAsOtherTenant,
    activeTenantId,
    setActiveTenantId,
    isoCode,
  };
}
