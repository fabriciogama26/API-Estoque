import { dataClient as api } from './dataClient.js'

export const listHhtMensal = (query = {}) => api.hhtMensal.list(query)

export const createHhtMensal = (payload) => api.hhtMensal.create(payload)

export const updateHhtMensal = (id, payload) => api.hhtMensal.update(id, payload)

export const deleteHhtMensal = (id, motivo) => api.hhtMensal.delete(id, motivo)

export const getHhtMensalHistory = (id) => api.hhtMensal.history(id)

export const getHhtMensalPessoasCount = (centroServicoId, centroServicoNome = null) =>
  api?.hhtMensal?.peopleCount
    ? api.hhtMensal.peopleCount({ centroServicoId, centroServicoNome })
    : Promise.resolve(0)
