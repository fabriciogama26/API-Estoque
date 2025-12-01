import { dataClient } from './dataClient.js'

export const fetchDashboardAcidentes = (params) => {
  if (!dataClient?.acidentes?.dashboard) {
    throw new Error('Recurso de dashboard de acidentes indisponivel.')
  }
  return dataClient.acidentes.dashboard(params)
}
