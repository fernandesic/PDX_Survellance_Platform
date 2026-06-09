import type React from "react"
import { createContext, useContext, useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { LoginResponse, TenantInfo } from "@/types/auth_type";
import { authService } from "@/services/auth_service";

interface AuthDataContextType {
  user: LoginResponse["data"]["user"] | null
  /** The user's own tenant from the login response */
  tenant: TenantInfo | null
  /** Whether the current user is a super admin (continental / superuser) */
  isSuperAdmin: boolean
  /**
   * For super admins only: the tenant ID they are currently "viewing as".
   * null = viewing as themselves (continental / all data).
   * Set via setActiveTenantId().
   */
  activeTenantId: number | null
  /** Switch the active tenant context (super admin only). Clears React Query cache. */
  setActiveTenantId: (id: number | null) => void
  isAuthChecking: boolean
  clear: () => void
  set: (userData: LoginResponse["data"]["user"]) => void
}

const AuthContext = createContext<AuthDataContextType | undefined>(undefined)

const STORAGE_KEY = 'whodatarepruser'
const ACTIVE_TENANT_KEY = 'who_active_tenant_id'

export function AuthDataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const [user, setUser] = useState<LoginResponse["data"]["user"] | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY)
    if (savedUser) {
      try {
        return JSON.parse(savedUser)
      } catch (e) {
        return null
      }
    }
    return null
  })

  const [activeTenantId, setActiveTenantIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(ACTIVE_TENANT_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      return isNaN(parsed) ? null : parsed
    }
    return null
  })

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => user !== null)

  const set = (userData: LoginResponse["data"]["user"]) => {
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    // Reset active tenant override when a new user logs in
    setActiveTenantIdState(null)
    localStorage.removeItem(ACTIVE_TENANT_KEY)
    setIsAuthChecking(false)
  }

  const clear = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    setActiveTenantIdState(null)
    localStorage.removeItem(ACTIVE_TENANT_KEY)
    setIsAuthChecking(false)
  }

  const setActiveTenantId = useCallback((id: number | null) => {
    setActiveTenantIdState(id)
    if (id !== null) {
      localStorage.setItem(ACTIVE_TENANT_KEY, String(id))
    } else {
      localStorage.removeItem(ACTIVE_TENANT_KEY)
    }
    // Clear all React Query caches so pages refetch with the new tenant context
    queryClient.clear()
  }, [queryClient])

  const tenant = user?.tenant ?? null
  const isSuperAdmin = user?.is_super_admin ?? false

  useEffect(() => {
    let cancelled = false

    const verifySession = async () => {
      try {
        const response = await authService.session()
        if (cancelled) return
        const sessionUser = response.data.user
        setUser(sessionUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
      } catch {
        if (cancelled) return
        // Only clear if we had a cached user (avoid clearing on fresh load)
        if (user) {
          setUser(null)
          localStorage.removeItem(STORAGE_KEY)
          setActiveTenantIdState(null)
          localStorage.removeItem(ACTIVE_TENANT_KEY)
        }
      } finally {
        if (!cancelled) {
          setIsAuthChecking(false)
        }
      }
    }

    // Always verify session — SSO sets httpOnly cookies without
    // localStorage, so we must check even with no cached user.
    setIsAuthChecking(true)
    verifySession()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      tenant,
      isSuperAdmin,
      activeTenantId,
      setActiveTenantId,
      isAuthChecking,
      set,
      clear,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
