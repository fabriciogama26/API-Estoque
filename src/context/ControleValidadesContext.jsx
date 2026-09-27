import { createContext, useContext } from 'react'
import { useControleValidadesController } from '../hooks/useControleValidadesController.js'

const ControleValidadesContext = createContext(null)

export function ControleValidadesProvider({ children }) {
  const value = useControleValidadesController()
  return <ControleValidadesContext.Provider value={value}>{children}</ControleValidadesContext.Provider>
}

export function useControleValidadesContext() {
  const ctx = useContext(ControleValidadesContext)
  if (!ctx) {
    throw new Error('useControleValidadesContext deve ser usado dentro de ControleValidadesProvider')
  }
  return ctx
}
