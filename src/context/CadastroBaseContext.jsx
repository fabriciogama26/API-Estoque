import { createContext, useContext } from 'react'
import { useCadastroBaseController } from '../hooks/useCadastroBaseController.js'

const CadastroBaseContext = createContext(null)

export function CadastroBaseProvider({ children }) {
  const value = useCadastroBaseController()
  return <CadastroBaseContext.Provider value={value}>{children}</CadastroBaseContext.Provider>
}

export function useCadastroBaseContext() {
  const ctx = useContext(CadastroBaseContext)
  if (!ctx) {
    throw new Error('useCadastroBaseContext deve ser usado dentro de CadastroBaseProvider')
  }
  return ctx
}
