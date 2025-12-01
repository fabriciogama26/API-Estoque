import { dataClient as api } from './dataClient.js'

export const listEntradas = (query = {}) => api.entradas.list(query)

export const createEntrada = (payload) => api.entradas.create(payload)

export const updateEntrada = (id, payload) => api.entradas.update(id, payload)

export const getEntradaHistory = (id) => api.entradas.history(id)

export const listMateriais = () => api.materiais.list()

export const searchMateriais = (params) => (api?.materiais?.search ? api.materiais.search(params) : Promise.resolve([]))

export const listCentrosEstoque = () => {
  if (api?.centrosEstoque && typeof api.centrosEstoque.list === 'function') {
    return api.centrosEstoque.list()
  }
  if (api?.centrosCusto && typeof api.centrosCusto.list === 'function') {
    return api.centrosCusto.list()
  }
  return Promise.resolve([])
}
