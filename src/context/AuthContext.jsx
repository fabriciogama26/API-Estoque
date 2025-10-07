import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'

const STORAGE_KEY = 'api-estoque-auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const hasSupabase = isSupabaseConfigured()

  const parseSupabaseUser = useCallback((user) => {
    if (!user) {
      return null
    }

    const metadata = user.user_metadata || {}
    const name = metadata.nome || metadata.full_name || metadata.name || user.email || user.phone || 'Usuario'

    return {
      id: user.id,
      email: user.email,
      name,
      metadata,
      raw: user,
    }
  }, [])

  const [user, setUser] = useState(() => {
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
      console.warn('Supabase não configurado. Autenticação desativada.')
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

  const login = useCallback(async ({ username, password }) => {
    if (!username || !password) {
      throw new Error('Informe usuario e senha')
    }

    if (!hasSupabase || !supabase) {
      throw new Error('Supabase não configurado. Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
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
  }, [hasSupabase, parseSupabaseUser])

  const logout = useCallback(async () => {
    if (hasSupabase && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [hasSupabase])

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
  }), [user, login, logout])

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
