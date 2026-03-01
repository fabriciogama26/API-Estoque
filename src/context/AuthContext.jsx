import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { isLocalMode } from '../config/runtime.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import {
  fetchCurrentUser,
  loginWithLoginName,
  reauthWithPassword,
  requestPasswordRecoveryByLoginName,
} from '../services/authService.js'
import { resolveEffectiveAppUser, invalidateEffectiveAppUserCache } from '../services/effectiveUserService.js'
import { clearCatalogCache } from '../services/api.js'
import {
  touchSession,
  rotateSessionId,
  clearSessionId,
  revokeSession,
} from '../services/sessionService.js'

const STORAGE_KEY = 'api-estoque-auth'
const TOUCH_THROTTLE_MS = 45 * 1000
const PASSWORD_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000
// Credenciais locais só são carregadas em ambiente de desenvolvimento.
const LOCAL_AUTH = import.meta.env.DEV
  ? {
      username: (import.meta.env.VITE_LOCAL_USERNAME || 'admin').trim(),
      password: (import.meta.env.VITE_LOCAL_PASSWORD || 'admin123').trim(),
      name: (import.meta.env.VITE_LOCAL_DISPLAY_NAME || 'Administrador Local').trim(),
    }
  : null

export const AuthContext = createContext(null)

function buildStoredUser(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const id = typeof value.id === 'string' ? value.id : null
  if (!id) {
    return null
  }
  const email = typeof value.email === 'string' ? value.email : null
  const name = typeof value.name === 'string' ? value.name : null
  const username =
    typeof value.metadata?.username === 'string' && value.metadata.username.trim()
      ? value.metadata.username.trim()
      : null
  const appUserId =
    typeof value.metadata?.app_user_id === 'string' && value.metadata.app_user_id.trim()
      ? value.metadata.app_user_id.trim()
      : null

  return {
    id,
    email,
    name,
    metadata: {
      ...(username ? { username } : {}),
      ...(appUserId ? { app_user_id: appUserId } : {}),
    },
  }
}

function buildLocalUser(identifier) {
  const username = identifier || LOCAL_AUTH?.username || 'admin'
  const name = LOCAL_AUTH?.name || username
  return {
    id: 'local-user',
    email: `${username}@local`,
    name,
    metadata: {
      nome: name,
      username,
      mode: 'local',
    },
    raw: null,
  }
}

export function AuthProvider({ children }) {
  const hasSupabase = !isLocalMode && isSupabaseConfigured()
  const { reportError } = useErrorLogger('auth')

  const parseSupabaseUser = useCallback((user) => {
    if (!user) {
      return null
    }

    const metadata = user.user_metadata || {}
    const name =
      metadata.nome ||
      metadata.full_name ||
      metadata.name ||
      user.email ||
      user.phone ||
      'Usuario'

    return {
      id: user.id,
      email: user.email,
      name,
      metadata,
      raw: user,
    }
  }, [])

  const buildResolvedUser = useCallback(
    async (supabaseUser) => {
      const parsed = parseSupabaseUser(supabaseUser)
      if (!parsed) {
        return { user: null, effective: null }
      }

      if (isLocalMode || !hasSupabase) {
        return { user: parsed, effective: null }
      }

      try {
        const effective = await resolveEffectiveAppUser(parsed.id)
        if (!effective) {
          return { user: parsed, effective: null }
        }

        const profile = effective.profile || null
        const dependentProfile = effective.dependentProfile || null

        const resolvedName =
          dependentProfile?.display_name ||
          profile?.display_name ||
          parsed.metadata?.nome ||
          parsed.metadata?.username ||
          parsed.name
        const resolvedEmail = dependentProfile?.email || profile?.email || parsed.email
        const resolvedUsername = dependentProfile?.username || profile?.username || parsed.metadata?.username

        const mergedMetadata = {
          ...(parsed.metadata || {}),
          credential: effective.credential ?? parsed.metadata?.credential ?? null,
          page_permissions:
            Array.isArray(effective?.pagePermissions) && effective.pagePermissions.length
              ? effective.pagePermissions
              : parsed.metadata?.page_permissions || [],
          username: resolvedUsername || parsed.metadata?.username,
          app_user_id: effective.appUserId || profile?.id || parsed.id,
          dependent_of: effective.isDependent ? effective.appUserId : null,
          dependent_active: effective.dependentActive,
          owner_active: effective.ownerActive,
        }

        const resolvedUser = {
          ...parsed,
          name: resolvedName || parsed.name,
          email: resolvedEmail || parsed.email,
          metadata: mergedMetadata,
        }

        return { user: resolvedUser, effective }
      } catch (error) {
        reportError(error, { stage: 'resolve_effective_user', userId: parsed?.id })
        throw error
      }
    },
    [hasSupabase, parseSupabaseUser, reportError]
  )

  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        return buildStoredUser(JSON.parse(raw))
      }
    } catch (error) {
      reportError(error, { stage: 'parse_storage' })
    }
    return null
  })
  const [reauthState, setReauthState] = useState({
    open: false,
    error: null,
    isSubmitting: false,
  })
  const lastTouchRef = useRef(0)

  useEffect(() => {
    if (isLocalMode) {
      return () => {}
    }
    if (!hasSupabase) {
      reportError(new Error('Supabase nao configurado. Autenticacao desativada.'), { stage: 'init' })
      return () => {}
    }

    let active = true

    const syncUser = async () => {
      try {
        const apiUser = await fetchCurrentUser()
        if (!active) {
          return
        }
        if (!apiUser?.id) {
          setUser(null)
          window.localStorage.removeItem(STORAGE_KEY)
          setReauthState({ open: false, error: null, isSubmitting: false })
          return
        }

        const { user: resolvedUser, effective } = await buildResolvedUser(apiUser)
        if (effective?.active === false) {
          setUser(null)
          window.localStorage.removeItem(STORAGE_KEY)
          setReauthState({ open: false, error: null, isSubmitting: false })
          return
        }
        clearCatalogCache()
        setUser(resolvedUser)
        if (resolvedUser) {
          const storedUser = buildStoredUser(resolvedUser)
          if (storedUser) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedUser))
          } else {
            window.localStorage.removeItem(STORAGE_KEY)
          }
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        reportError(error, { stage: 'sync_user_profile' })
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
        setReauthState({ open: false, error: null, isSubmitting: false })
      }
    }

    syncUser()

    return () => {
      active = false
    }
  }, [buildResolvedUser, hasSupabase, isLocalMode, reportError])

  const login = useCallback(
    async ({ loginName, username, password }) => {
      const rawLogin = (loginName ?? username ?? '').toString()
      if (!rawLogin || password === undefined || password === null || password === '') {
        throw new Error('Informe login e senha')
      }

      if (isLocalMode) {
        if (!LOCAL_AUTH) {
          throw new Error('Modo local indisponivel fora do ambiente de desenvolvimento.')
        }
        const identifier = rawLogin.trim()
        const normalized = identifier.toLowerCase()
        const localLogin = (LOCAL_AUTH.username || '').trim().toLowerCase()
        if (normalized !== localLogin || password !== LOCAL_AUTH.password) {
          throw new Error('Login ou senha invalidos')
        }
        const localUser = buildLocalUser(identifier)
        clearCatalogCache()
        setUser(localUser)
        const storedUser = buildStoredUser(localUser)
        if (storedUser) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedUser))
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
        setReauthState({ open: false, error: null, isSubmitting: false })
        return localUser
      }

      if (!hasSupabase) {
        throw new Error(
          'Supabase nao configurado. Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
        )
      }

      const identifier = rawLogin.trim()
      const apiUser = await loginWithLoginName(identifier, password)
      const { user: resolvedUser, effective } = await buildResolvedUser(apiUser)

      if (effective?.active === false) {
        await revokeSession()
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
        throw new Error('Usuario inativo. Procure um administrador.')
      }

        clearCatalogCache()
        setUser(resolvedUser)
        if (resolvedUser) {
          const storedUser = buildStoredUser(resolvedUser)
          if (storedUser) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedUser))
          } else {
            window.localStorage.removeItem(STORAGE_KEY)
          }
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      if (!isLocalMode && hasSupabase) {
        rotateSessionId()
        touchSession().catch((error) => {
          reportError(error, { stage: 'login_touch' })
        })
      }
      setReauthState({ open: false, error: null, isSubmitting: false })
      return resolvedUser
    },
    [buildResolvedUser, hasSupabase]
  )

  const recoverPassword = useCallback(
    async (loginName) => {
      const identifier = (loginName || '').trim()

      if (!identifier) {
        throw new Error('Informe o login utilizado no acesso para recuperar a senha.')
      }

      if (isLocalMode) {
        throw new Error('Recuperacao de senha indisponivel no modo offline.')
      }

      if (!hasSupabase) {
        throw new Error(
          'Supabase nao configurado. Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
        )
      }

      await requestPasswordRecoveryByLoginName(identifier)
      return true
    },
    [hasSupabase]
  )

  const logout = useCallback(async () => {
    if (!isLocalMode && hasSupabase) {
      try {
        await revokeSession()
      } catch (error) {
        reportError(error, { stage: 'logout' })
      }
    }
    clearCatalogCache()
    clearSessionId()
    invalidateEffectiveAppUserCache()
    setUser(null)
    window.localStorage.removeItem(STORAGE_KEY)
    setReauthState({ open: false, error: null, isSubmitting: false })
  }, [hasSupabase, reportError])

  const openReauthPrompt = useCallback(() => {
    if (!user || isLocalMode || !hasSupabase) {
      return
    }
    setReauthState((prev) => ({
      ...prev,
      open: true,
      error: null,
      isSubmitting: false,
    }))
  }, [user, hasSupabase])

  const cancelReauth = useCallback(() => {
    setReauthState({ open: false, error: null, isSubmitting: false })
  }, [])

  const confirmReauth = useCallback(
    async (password) => {
      const senha = (password || '').trim()
      if (!senha) {
        setReauthState((prev) => ({ ...prev, error: 'Informe sua senha.' }))
        return false
      }

      if (isLocalMode) {
        if (!LOCAL_AUTH || senha !== LOCAL_AUTH.password) {
          setReauthState((prev) => ({ ...prev, error: 'Senha invalida.' }))
          return false
        }
        setReauthState({ open: false, error: null, isSubmitting: false })
        return true
      }

      if (!hasSupabase) {
        setReauthState((prev) => ({
          ...prev,
          error: 'Supabase nao configurado. Nao foi possivel reautenticar.',
        }))
        return false
      }

      setReauthState((prev) => ({ ...prev, isSubmitting: true, error: null }))
      try {
        await reauthWithPassword(senha)
        setReauthState({ open: false, error: null, isSubmitting: false })
        return true
      } catch (error) {
        setReauthState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: error?.message || 'Falha ao reautenticar.',
        }))
        return false
      }
    },
    [hasSupabase]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleExpired = () => {
      const run = async () => {
        try {
          await logout()
        } catch (error) {
          reportError(error, { stage: 'logout_expired' })
        } finally {
          window.location.href = '/login'
        }
      }
      run()
    }

    const handleReauthRequired = () => {
      openReauthPrompt()
    }

    window.addEventListener('session-expired', handleExpired)
    window.addEventListener('session-reauth-required', handleReauthRequired)

    return () => {
      window.removeEventListener('session-expired', handleExpired)
      window.removeEventListener('session-reauth-required', handleReauthRequired)
    }
  }, [logout, openReauthPrompt, reportError])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    if (!user || isLocalMode || !hasSupabase) {
      return undefined
    }

    const handleActivity = (event) => {
      if (typeof document !== 'undefined') {
        if (event?.type === 'visibilitychange') {
          if (!document.hidden) {
            scheduleTouch()
          }
          return
        }
        if (document.hidden) {
          return
        }
      }
      scheduleTouch()
    }

    const scheduleTouch = () => {
      const now = Date.now()
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) {
        return
      }
      lastTouchRef.current = now
      touchSession().catch((error) => {
        reportError(error, { stage: 'session_touch' })
      })
    }

    const listeners = [
      { target: window, event: 'mousemove', options: { passive: true } },
      { target: window, event: 'mousedown', options: { passive: true } },
      { target: window, event: 'pointerdown', options: { passive: true } },
      { target: window, event: 'pointermove', options: { passive: true } },
      { target: window, event: 'keydown' },
      { target: window, event: 'wheel', options: { passive: true } },
      { target: window, event: 'touchstart', options: { passive: true } },
      { target: window, event: 'touchmove', options: { passive: true } },
      { target: window, event: 'focus' },
      { target: document, event: 'focusin' },
      { target: document, event: 'scroll', options: { passive: true, capture: true } },
      { target: document, event: 'visibilitychange' },
    ]

    listeners.forEach(({ target, event, options }) => target.addEventListener(event, handleActivity, options))
    scheduleTouch()

    return () => {
      listeners.forEach(({ target, event, options }) => target.removeEventListener(event, handleActivity, options))
    }
  }, [user, reportError])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    if (!user || isLocalMode || !hasSupabase) {
      return undefined
    }

    const metadata = user.metadata || {}
    const raw = user.raw || {}
    const passwordChangedAt =
      metadata.password_changed_at ||
      metadata.passwordChangedAt ||
      raw.user_metadata?.password_changed_at ||
      raw.created_at ||
      null

    if (!passwordChangedAt) {
      return undefined
    }

    const last = new Date(passwordChangedAt)
    if (!Number.isFinite(last.getTime())) {
      return undefined
    }

    const expired = Date.now() - last.getTime() > PASSWORD_MAX_AGE_MS
    if (!expired) {
      return undefined
    }

    const path = window.location.pathname || ''
    if (!path.startsWith('/reset-password')) {
      window.location.href = '/reset-password?reason=expired'
    }
    return undefined
  }, [user])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      recoverPassword,
      logout,
      reauthState,
      confirmReauth,
      cancelReauth,
    }),
    [user, login, recoverPassword, logout, reauthState, confirmReauth, cancelReauth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  }
  return context
}
