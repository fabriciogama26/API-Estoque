import { dataClient as api } from './dataClient.js'

export const listAsos = (query = {}) =>
  api?.aso?.list ? api.aso.list(query) : Promise.resolve([])

export const listAsoTiposExame = () =>
  api?.aso?.types ? api.aso.types() : Promise.resolve([])

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
    return Promise.reject(new Error('Endpoint de registro de exame nao configurado.'))
  }
  return api.aso.registerExam(id, payload)
}

export const getAsoHistory = (id) => {
  if (!api?.aso?.history) {
    return Promise.reject(new Error('Endpoint de historico de ASO nao configurado.'))
  }
  return api.aso.history(id)
}
