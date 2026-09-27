import { createContext, useContext } from 'react'
import { useRequisitosController } from '../hooks/useRequisitosController.js'

const RequisitosControleContext = createContext(null)

export function RequisitosControleProvider({ children }) {
  const value = useRequisitosController()
  return <RequisitosControleContext.Provider value={value}>{children}</RequisitosControleContext.Provider>
}

export function useRequisitosControleContext() {
  const ctx = useContext(RequisitosControleContext)
  if (!ctx) {
    throw new Error('useRequisitosControleContext deve ser usado dentro de RequisitosControleProvider')
  }
  return ctx
}
