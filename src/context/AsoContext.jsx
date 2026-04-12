import { createContext, useContext } from 'react'
import { useAsoController } from '../hooks/useAsoController.js'

const AsoContext = createContext(null)

export function AsoProvider({ children }) {
  const value = useAsoController()
  return <AsoContext.Provider value={value}>{children}</AsoContext.Provider>
}

export function useAsoContext() {
  const ctx = useContext(AsoContext)
  if (!ctx) {
    throw new Error('useAsoContext deve ser usado dentro de AsoProvider')
  }
  return ctx
}
