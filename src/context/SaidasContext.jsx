import { createContext, useContext } from 'react'
import { useSaidasController } from '../hooks/useSaidasController.js'

const SaidasContext = createContext(null)

export function SaidasProvider({ children }) {
  const value = useSaidasController()
  return <SaidasContext.Provider value={value}>{children}</SaidasContext.Provider>
}

export function useSaidasContext() {
  const ctx = useContext(SaidasContext)
  if (!ctx) {
    throw new Error('useSaidasContext deve ser usado dentro de SaidasProvider')
  }
  return ctx
}
