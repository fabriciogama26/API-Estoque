import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { resolveEffectiveAppUser } from '../services/effectiveUserService.js'
import { mapCredentialUuidToText } from '../services/effectiveUserService.js'
import { isLocalMode } from '../config/runtime.js'
import {
  canAccessPath as canAccessPathHelper,
  describeCredential,
  resolveAllowedPageIds,
  resolveAllowedPaths,
} from '../config/permissions.js'
import { useAuth } from './AuthContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'

const PermissionsContext = createContext(null)

export function PermissionsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { reportError } = useErrorLogger('permissions')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(
    () => isAuthenticated && !isLocalMode && isSupabaseConfigured() && Boolean(supabase)
  )
  const [error, setError] = useState(null)

  const credentialFromMetadata =
    user?.metadata?.credential ||
    user?.metadata?.credencial ||
    user?.metadata?.role ||
    user?.metadata?.cargo ||
    user?.role ||
    null

  const pagePermissionsFromMetadata =
    (user?.metadata?.page_permissions || user?.metadata?.permissoes_paginas || user?.metadata?.paginas || [])

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !user?.id || isLocalMode || !isSupabaseConfigured() || !supabase) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const effective = await resolveEffectiveAppUser(user.id, { forceRefresh: true })
      const profileData = effective?.profile
        ? {
            ...effective.profile,
            credential_text: effective.profile.credential_text ?? (await mapCredentialUuidToText(effective.profile.credential)),
            app_user_id: effective.appUserId || effective.profile.id,
            dependent_profile: effective.dependentProfile || null,
            is_dependent: effective.isDependent || false,
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

  const credential = useMemo(() => {
    if (isLocalMode) {
      return 'master'
    }
    return profile?.credential_text || credentialFromMetadata || 'admin'
  }, [credentialFromMetadata, profile?.credential_text])

  const explicitPageIds = useMemo(() => {
    const fromProfile = Array.isArray(profile?.page_permissions) ? profile.page_permissions : []
    const fromMetadata = Array.isArray(pagePermissionsFromMetadata) ? pagePermissionsFromMetadata : []
    return fromProfile.length ? fromProfile : fromMetadata
  }, [profile?.page_permissions, pagePermissionsFromMetadata])

  const allowedPageIds = useMemo(
    () => (isLocalMode ? resolveAllowedPageIds('master') : resolveAllowedPageIds(credential, explicitPageIds)),
    [credential, explicitPageIds]
  )

  const allowedPaths = useMemo(
    () =>
      isLocalMode
        ? resolveAllowedPaths({ credential: 'master', explicitPages: resolveAllowedPageIds('master') })
        : resolveAllowedPaths({ credential, explicitPages: explicitPageIds }),
    [credential, explicitPageIds]
  )

  const canAccessPath = useCallback(
    (pathname) => {
      if (!isAuthenticated) {
        return false
      }
      if (isLocalMode) {
        return true
      }
      return canAccessPathHelper(pathname, { credential, explicitPages: explicitPageIds })
    },
    [credential, explicitPageIds, isAuthenticated]
  )

  const value = useMemo(
    () => ({
      credential,
      credentialLabel: describeCredential(credential),
      isAdmin: ['admin', 'master'].includes((credential || '').toLowerCase()),
      allowedPageIds,
      allowedPaths,
      canAccessPath,
      loading,
      error,
      profile,
      refresh: loadProfile,
    }),
    [allowedPageIds, allowedPaths, canAccessPath, credential, error, loadProfile, loading, profile]
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error('usePermissions precisa ser usado dentro de PermissionsProvider')
  }
  return context
}
