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
