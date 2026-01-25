import { dataClient as api } from './dataClient.js'

// Acesso centralizado aos dados de acidentes
export const listAcidentes = () => api.acidentes.list()
export const listAgentes = () => api.acidentes.agents()
export const listLocais = () => api.acidentes.locals()
export const listPartes = () => api.acidentes.parts()

export const listLesoesPorAgente = async (agentePayload) => {
  const fetcher = api?.acidentes?.lesions
  if (typeof fetcher !== 'function') {
    return []
  }
  return fetcher(agentePayload)
}

export const listTiposPorAgente = (agentePayload) => api.acidentes.agentTypes(agentePayload)

export const createAcidente = (payload) => api.acidentes.create(payload)
export const updateAcidente = (id, payload) => api.acidentes.update(id, payload)
export const getAcidenteHistory = (id) => api.acidentes.history(id)
export const cancelAcidente = (id, payload) => api.acidentes.cancel(id, payload)

export const downloadAcidenteTemplate = () => {
  if (api?.acidentes?.downloadTemplate) {
    return api.acidentes.downloadTemplate()
  }
  return Promise.reject(new Error('Endpoint de download de modelo nao configurado.'))
}

export const importAcidentePlanilha = (file) => {
  if (!file) {
    return Promise.reject(new Error('Selecione um arquivo XLSX.'))
  }
  if (api?.acidentes?.importPlanilha) {
    return api.acidentes.importPlanilha(file)
  }
  return Promise.reject(new Error('Endpoint de importacao de acidentes nao configurado.'))
}
