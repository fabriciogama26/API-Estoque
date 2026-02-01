import { dataClient as api } from './dataClient.js'

export const listBasicRegistration = (table, params = {}) =>
  api?.basicRegistration?.list
    ? api.basicRegistration.list({ table, ...params })
    : Promise.reject(new Error('Endpoint de cadastro base nao configurado.'))

export const createBasicRegistration = (table, data) =>
  api?.basicRegistration?.create
    ? api.basicRegistration.create({ table, data })
    : Promise.reject(new Error('Endpoint de cadastro base nao configurado.'))

export const updateBasicRegistration = (table, id, data) =>
  api?.basicRegistration?.update
    ? api.basicRegistration.update({ table, id, data })
    : Promise.reject(new Error('Endpoint de cadastro base nao configurado.'))

export const inactivateBasicRegistration = (table, id) =>
  api?.basicRegistration?.inactivate
    ? api.basicRegistration.inactivate({ table, id })
    : Promise.reject(new Error('Endpoint de cadastro base nao configurado.'))

export const listBasicRegistrationHistory = (table, recordId, limit = 50) =>
  api?.basicRegistration?.history
    ? api.basicRegistration.history({ table, recordId, limit })
    : Promise.resolve([])

export const downloadBasicRegistrationTemplate = (table) => {
  if (api?.basicRegistration?.downloadTemplate) {
    return api.basicRegistration.downloadTemplate({ table })
  }
  return Promise.reject(new Error('Endpoint de download de modelo nao configurado.'))
}

export const importBasicRegistrationPlanilha = (table, file) => {
  if (!file) {
    return Promise.reject(new Error('Selecione um arquivo XLSX.'))
  }
  if (api?.basicRegistration?.importPlanilha) {
    return api.basicRegistration.importPlanilha({ table, file })
  }
  return Promise.reject(new Error('Endpoint de importacao de cadastro base nao configurado.'))
}
