import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { isLocalMode } from '../config/runtime.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { sendPasswordRecovery } from '../services/authService.js'
import { resolveEffectiveAppUser, invalidateEffectiveAppUserCache } from '../services/effectiveUserService.js'

const STORAGE_KEY = 'api-estoque-auth'
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
const LOCAL_AUTH = {
  username: (import.meta.env.VITE_LOCAL_USERNAME || 'admin').trim(),
  password: (import.meta.env.VITE_LOCAL_PASSWORD || 'admin123').trim(),
  name: (import.meta.env.VITE_LOCAL_DISPLAY_NAME || 'Administrador Local').trim(),
}

export const AuthContext = createContext(null)

function buildLocalUser(identifier) {
  const username = identifier || LOCAL_AUTH.username || 'admin'
  const name = LOCAL_AUTH.name || username
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

      if (isLocalMode || !hasSupabase || !supabase) {
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
        return JSON.parse(raw)
      }
    } catch (error) {
      reportError(error, { stage: 'parse_storage' })
    }
    return null
  })

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      if (isLocalMode) {
        return () => {}
      }
      reportError(new Error('Supabase nao configurado. Autenticacao desativada.'), { stage: 'init' })
      return () => {}
    }

    let active = true

    const syncUser = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (!active) {
        return
      }
      if (sessionError) {
        reportError(sessionError, { stage: 'get_session' })
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
        return
      }

      const session = sessionData?.session
      if (!session) {
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
        return
      }

      try {
        const { user: resolvedUser, effective } = await buildResolvedUser(session.user)
        if (effective?.active === false) {
          await supabase.auth.signOut()
          setUser(null)
          window.localStorage.removeItem(STORAGE_KEY)
          return
        }
        setUser(resolvedUser)
        if (resolvedUser) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedUser))
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        reportError(error, { stage: 'sync_user_profile' })
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }

    syncUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const applySessionUser = async () => {
        const currentSessionUser = session?.user
        if (!currentSessionUser) {
          setUser(null)
          window.localStorage.removeItem(STORAGE_KEY)
          return
        }
        try {
          const { user: resolvedUser, effective } = await buildResolvedUser(currentSessionUser)
          if (effective?.active === false) {
            await supabase.auth.signOut()
            setUser(null)
            window.localStorage.removeItem(STORAGE_KEY)
            return
          }
          setUser(resolvedUser)
          if (resolvedUser) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedUser))
          } else {
            window.localStorage.removeItem(STORAGE_KEY)
          }
        } catch (error) {
          reportError(error, { stage: 'auth_state_change' })
          setUser(null)
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }
      applySessionUser()
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [buildResolvedUser, hasSupabase, reportError])

  const login = useCallback(
    async ({ username, password }) => {
      if (!username || !password) {
        throw new Error('Informe usuario e senha')
      }

      if (isLocalMode) {
        const identifier = username.trim()
        if (identifier !== LOCAL_AUTH.username || password !== LOCAL_AUTH.password) {
          throw new Error('Usuario ou senha invalidos')
        }
        const localUser = buildLocalUser(identifier)
        setUser(localUser)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser))
        return localUser
      }

      if (!hasSupabase || !supabase) {
        throw new Error(
          'Supabase nao configurado. Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
        )
      }

      const identifier = username.trim()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      const supabaseUser = data?.user

      const { user: resolvedUser, effective } = await buildResolvedUser(supabaseUser)

      if (effective?.active === false) {
        await supabase.auth.signOut()
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
        throw new Error('Usuario inativo. Procure um administrador.')
      }

      setUser(resolvedUser)
      if (resolvedUser) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedUser))
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      return resolvedUser
    },
    [buildResolvedUser, hasSupabase]
  )

  const recoverPassword = useCallback(
    async (email) => {
      const identifier = (email || '').trim()

      if (!identifier) {
        throw new Error('Informe o email utilizado no login para recuperar a senha.')
      }

      if (isLocalMode) {
        throw new Error('Recuperacao de senha indisponivel no modo offline.')
      }

      if (!hasSupabase || !supabase) {
        throw new Error(
          'Supabase nao configurado. Configure as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
        )
      }

      const rawRedirect = import.meta?.env?.VITE_SUPABASE_PASSWORD_REDIRECT ?? ''
      const redirectTo =
        typeof rawRedirect === 'string' && rawRedirect.trim().length > 0 ? rawRedirect.trim() : undefined

      await sendPasswordRecovery(identifier, redirectTo)
      return true
    },
    [hasSupabase]
  )

  const logout = useCallback(async () => {
    if (!isLocalMode && hasSupabase && supabase) {
      await supabase.auth.signOut()
    }
    invalidateEffectiveAppUserCache()
    setUser(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [hasSupabase])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    if (!user) {
      return undefined
    }

    let timeoutId = null
    let loggedOut = false

    const triggerLogout = async () => {
      if (loggedOut) {
        return
      }
      loggedOut = true
      try {
        await logout()
      } catch (error) {
        reportError(error, { stage: 'logout_inactivity' })
      } finally {
        window.location.href = '/login'
      }
    }

    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        triggerLogout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const handleActivity = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return
      }
      resetTimer()
    }

    const listeners = [
      { target: window, event: 'mousemove' },
      { target: window, event: 'mousedown' },
      { target: window, event: 'keydown' },
      { target: window, event: 'wheel' },
      { target: window, event: 'touchstart' },
      { target: window, event: 'focus' },
      { target: document, event: 'visibilitychange' },
    ]

    listeners.forEach(({ target, event }) => target.addEventListener(event, handleActivity))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      listeners.forEach(({ target, event }) => target.removeEventListener(event, handleActivity))
    }
  }, [user, logout])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      recoverPassword,
      logout,
    }),
    [user, login, recoverPassword, logout]
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
