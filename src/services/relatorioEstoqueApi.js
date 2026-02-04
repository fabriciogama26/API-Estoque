import { dataClient as api } from './dataClient.js'

export const fetchRelatoriosEstoque = (params = {}) => {
  if (!api?.estoque?.reportHistory) {
    throw new Error('Recurso de relatorios de estoque indisponivel.')
  }
  return api.estoque.reportHistory(params)
}

export const generateRelatorioEstoquePdf = (params = {}) => {
  if (!api?.estoque?.reportPdf) {
    throw new Error('Recurso de PDF de relatorio indisponivel.')
  }
  return api.estoque.reportPdf(params)
}
