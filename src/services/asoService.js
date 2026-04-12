import { dataClient as api } from './dataClient.js'

export const listAsos = (query = {}) =>
  api?.aso?.list ? api.aso.list(query) : Promise.resolve([])

export const listAsoTiposExame = () =>
  api?.aso?.types ? api.aso.types() : Promise.resolve([])

export const downloadAsoTemplate = () => {
  if (api?.aso?.downloadTemplate) {
    return api.aso.downloadTemplate()
  }
  return Promise.reject(new Error('Endpoint de download de modelo de ASO nao configurado.'))
}

export const importAsoPlanilha = (file) => {
  if (!file) {
    return Promise.reject(new Error('Selecione um arquivo XLSX.'))
  }
  if (api?.aso?.importPlanilha) {
    return api.aso.importPlanilha(file)
  }
  return Promise.reject(new Error('Endpoint de importacao de ASO nao configurado.'))
}

export const createAso = (payload) => {
  if (!api?.aso?.create) {
    return Promise.reject(new Error('Endpoint de cadastro de ASO nao configurado.'))
  }
  return api.aso.create(payload)
}

export const updateAso = (id, payload) => {
  if (!api?.aso?.update) {
    return Promise.reject(new Error('Endpoint de atualizacao de ASO nao configurado.'))
  }
  return api.aso.update(id, payload)
}

export const registerAsoExam = (id, payload) => {
  if (!api?.aso?.registerExam) {
    return Promise.reject(new Error('Endpoint de baixa de exame nao configurado.'))
  }
  return api.aso.registerExam(id, payload)
}

export const getAsoHistory = (id) => {
  if (!api?.aso?.history) {
    return Promise.reject(new Error('Endpoint de historico de ASO nao configurado.'))
  }
  return api.aso.history(id)
}
