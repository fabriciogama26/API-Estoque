import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { request as httpRequest } from '../services/httpClient.js'
import { isLocalMode } from '../config/runtime.js'
import { PAGE_CATALOG, PAGE_REQUIRED_PERMISSION, canAccessPath as canAccessPathHelper, resolveAllowedPaths } from '../config/permissions.js'
import { useAuth } from './AuthContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'

const PermissionsContext = createContext(null)

export function PermissionsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { reportError } = useErrorLogger('permissions')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(() => isAuthenticated && !isLocalMode)
  const [error, setError] = useState(null)

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !user?.id || isLocalMode) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await httpRequest('GET', '/api/permissions/me', { skipSessionGuard: true })
      const data = response?.profile || null
      const profileData = data
        ? {
            user_id: data.user_id,
            owner_id: data.owner_id,
            parent_user_id: data.parent_user_id,
            roles: Array.isArray(data.roles) ? data.roles : [],
            permissions: Array.isArray(data.permissions) ? data.permissions : [],
            perm_version: data.perm_version || 1,
            is_master: Boolean(data.is_master),
          }
        : null
      setProfile(profileData)
    } catch (err) {
      reportError(err, { stage: 'load_permissions_profile', userId: user?.id })
      setProfile(null)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, reportError, user?.id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const derivedIsMaster = useMemo(() => {
    const hasMasterRole = Array.isArray(profile?.roles) && profile.roles.some((r) => (r || '').toLowerCase() === 'master')
    return Boolean(profile?.is_master) || hasMasterRole || isLocalMode
  }, [profile?.is_master, profile?.roles])

  const derivedIsAdmin = useMemo(() => {
    const hasAdminRole =
      Array.isArray(profile?.roles) &&
      profile.roles.some((r) => (r || '').toLowerCase() === 'admin')
    return derivedIsMaster || hasAdminRole
  }, [derivedIsMaster, profile?.roles])

  const allowedPaths = useMemo(
    () =>
      isLocalMode
        ? resolveAllowedPaths({ permissions: [], isMaster: true })
        : resolveAllowedPaths({
            permissions: derivedIsAdmin ? [] : profile?.permissions || [],
            isMaster: derivedIsMaster || derivedIsAdmin,
          }),
    [derivedIsAdmin, derivedIsMaster, profile?.permissions]
  )

  const allowedPageIds = useMemo(() => {
    if (isLocalMode || derivedIsMaster || derivedIsAdmin) {
      return PAGE_CATALOG.map((p) => p.id)
    }
    const perms = Array.isArray(profile?.permissions) ? profile.permissions : []
    return PAGE_CATALOG.filter((page) => {
      const requiredPerm = PAGE_REQUIRED_PERMISSION[page.id]
      if (!requiredPerm) return true
      return perms.includes(requiredPerm)
    }).map((page) => page.id)
  }, [derivedIsAdmin, derivedIsMaster, profile?.permissions])

  const canAccessPath = useCallback(
    (pathname) => {
      if (!isAuthenticated) {
        return false
      }
      if (isLocalMode) {
        return true
      }
      return canAccessPathHelper(pathname, {
        permissions: derivedIsAdmin ? [] : profile?.permissions || [],
        isMaster: derivedIsMaster || derivedIsAdmin,
      })
    },
    [profile?.permissions, derivedIsAdmin, derivedIsMaster, isAuthenticated]
  )

  const value = useMemo(() => {
    const isAdminFlag = derivedIsAdmin
    return {
      permissions: profile?.permissions || [],
      roles: profile?.roles || [],
      ownerId: profile?.owner_id || null,
      userId: profile?.user_id || null,
      credential: profile?.roles?.[0] || (derivedIsMaster ? 'master' : null),
      isMaster: derivedIsMaster,
      isAdmin: isAdminFlag,
      credentialLabel: profile?.roles?.[0] || (derivedIsMaster ? 'Master' : 'Usuario'),
      allowedPageIds,
      allowedPaths,
      canAccessPath,
      loading,
      error,
      profile,
      refresh: loadProfile,
    }
  }, [allowedPaths, canAccessPath, derivedIsAdmin, derivedIsMaster, error, loadProfile, loading, profile])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error('usePermissions precisa ser usado dentro de PermissionsProvider')
  }
  return context
}
