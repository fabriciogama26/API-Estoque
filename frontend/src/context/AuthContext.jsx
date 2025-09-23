import { createContext, useContext, useMemo, useState } from 'react'
import { api } from '../services/api.js'

const STORAGE_KEY = 'api-estoque-auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
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

  const login = async ({ username, password }) => {
    if (!username || !password) {
      throw new Error('Informe usuario e senha')
    }

    const response = await api.auth.login({ username, password })
    const nextUser = response?.user ?? { username }

    setUser(nextUser)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    return nextUser
  }

  const logout = () => {
    setUser(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  }
  return context
}
