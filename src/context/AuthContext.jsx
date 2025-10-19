import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { isLocalMode } from '../config/runtime.js'

const STORAGE_KEY = 'api-estoque-auth'
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
const LOCAL_AUTH = {
  username: (import.meta.env.VITE_LOCAL_USERNAME || 'admin').trim(),
  password: (import.meta.env.VITE_LOCAL_PASSWORD || 'admin123').trim(),
  name: (import.meta.env.VITE_LOCAL_DISPLAY_NAME || 'Administrador Local').trim(),
}

const AuthContext = createContext(null)

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
      console.error('Failed to parse auth storage', error)
    }
    return null
  })

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      if (isLocalMode) {
        return () => {}
      }
      console.warn('Supabase nao configurado. Autenticacao desativada.')
      return () => {}
    }

    let active = true

    const syncUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!active) {
        return
      }
      if (error) {
        console.warn('Nao foi possivel obter usuario do Supabase', error)
        setUser(null)
        return
      }
      setUser(parseSupabaseUser(data?.user))
    }

    syncUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = parseSupabaseUser(session?.user)
      setUser(current)
      if (current) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [hasSupabase, parseSupabaseUser])

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

      const nextUser = parseSupabaseUser(data?.user)
      setUser(nextUser)
      if (nextUser) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      return nextUser
    },
    [hasSupabase, parseSupabaseUser]
  )

  const logout = useCallback(async () => {
    if (!isLocalMode && hasSupabase && supabase) {
      await supabase.auth.signOut()
    }
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
        console.error('Falha ao encerrar sessão por inatividade', error)
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
      logout,
    }),
    [user, login, logout]
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
