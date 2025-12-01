import { createContext, useContext } from 'react'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { useDashboardEstoque } from '../hooks/useDashboardEstoque.js'
import { chartInfoMessagesEstoque } from '../utils/dashboardEstoqueUtils.js'

const DashboardEstoqueContext = createContext(null)

export function DashboardEstoqueProvider({ children }) {
  const { reportError } = useErrorLogger('dashboard_estoque')
  const state = useDashboardEstoque((err, ctx) => reportError(err, ctx))

  const value = {
    ...state,
    chartInfoMessages: chartInfoMessagesEstoque,
  }

  return <DashboardEstoqueContext.Provider value={value}>{children}</DashboardEstoqueContext.Provider>
}

export function useDashboardEstoqueContext() {
  const ctx = useContext(DashboardEstoqueContext)
  if (!ctx) {
    throw new Error('useDashboardEstoqueContext deve ser usado dentro de DashboardEstoqueProvider')
  }
  return ctx
}
