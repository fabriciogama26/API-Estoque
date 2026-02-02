import { dataClient as api } from './dataClient.js'

export const fetchDashboardEstoque = (params = {}) => {
  if (!api?.estoque?.dashboard) {
    throw new Error('Recurso de dashboard de estoque indisponivel.')
  }
  return api.estoque.dashboard(params)
}

export const generateDashboardEstoqueReport = (params = {}) => {
  if (!api?.estoque?.report) {
    throw new Error('Recurso de relatorio de estoque indisponivel.')
  }
  return api.estoque.report(params)
}
