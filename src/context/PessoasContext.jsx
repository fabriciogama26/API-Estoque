import { createContext, useContext } from 'react'
import { usePessoasController } from '../hooks/usePessoasController.js'

const PessoasContext = createContext(null)

export function PessoasProvider({ children }) {
  const value = usePessoasController()
  return <PessoasContext.Provider value={value}>{children}</PessoasContext.Provider>
}

export function usePessoasContext() {
  const ctx = useContext(PessoasContext)
  if (!ctx) {
    throw new Error('usePessoasContext deve ser usado dentro de PessoasProvider')
  }
  return ctx
}
