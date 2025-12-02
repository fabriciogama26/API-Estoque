import { createContext, useContext } from 'react'
import { useMateriaisController } from '../hooks/useMateriaisController.js'

const MateriaisContext = createContext(null)

export function MateriaisProvider({ children }) {
  const value = useMateriaisController()
  return <MateriaisContext.Provider value={value}>{children}</MateriaisContext.Provider>
}

export function useMateriaisContext() {
  const ctx = useContext(MateriaisContext)
  if (!ctx) {
    throw new Error('useMateriaisContext deve ser usado dentro de MateriaisProvider')
  }
  return ctx
}
