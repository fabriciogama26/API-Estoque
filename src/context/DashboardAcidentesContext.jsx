import { createContext, useContext } from 'react'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { useDashboardAcidentes } from '../hooks/useDashboardAcidentes.js'
import { CHART_INFO_MESSAGES } from '../utils/dashboardAcidentesUtils.js'

const DashboardAcidentesContext = createContext(null)

export function DashboardAcidentesProvider({ children }) {
  const { reportError } = useErrorLogger('dashboard_acidentes')
  const state = useDashboardAcidentes((err, ctx) => reportError(err, ctx))

  const value = {
    ...state,
    chartInfoMessages: CHART_INFO_MESSAGES,
  }

  return <DashboardAcidentesContext.Provider value={value}>{children}</DashboardAcidentesContext.Provider>
}

export function useDashboardAcidentesContext() {
  const ctx = useContext(DashboardAcidentesContext)
  if (!ctx) {
    throw new Error('useDashboardAcidentesContext deve ser usado dentro de DashboardAcidentesProvider')
  }
  return ctx
}
