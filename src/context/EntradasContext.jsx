import { createContext, useContext } from 'react'
import { useEntradasController } from '../hooks/useEntradasController.js'

const EntradasContext = createContext(null)

export function EntradasProvider({ children }) {
  const value = useEntradasController()
  return <EntradasContext.Provider value={value}>{children}</EntradasContext.Provider>
}

export function useEntradasContext() {
  const ctx = useContext(EntradasContext)
  if (!ctx) {
    throw new Error('useEntradasContext deve ser usado dentro de EntradasProvider')
  }
  return ctx
}
