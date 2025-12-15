import { dataClient as api } from './dataClient.js'

export const listEntradas = (query = {}) => api.entradas.list(query)

export const createEntrada = (payload) => api.entradas.create(payload)

export const updateEntrada = (id, payload) => api.entradas.update(id, payload)

export const getEntradaHistory = (id) => api.entradas.history(id)

export const cancelEntrada = (id, motivo) =>
  api?.entradas?.cancel
    ? api.entradas.cancel(id, motivo)
    : Promise.reject(new Error('Recurso de cancelamento indisponivel'))

export const listStatusEntrada = () =>
  api?.statusEntrada?.list
    ? api.statusEntrada.list()
    : Promise.resolve([
        { id: '82f86834-5b97-4bf0-9801-1372b6d1bd37', status: 'REGISTRADO', nome: 'REGISTRADO', ativo: true },
        { id: 'c5f5d4e8-8c1f-4c8d-bf52-918c0b9fbde3', status: 'CANCELADO', nome: 'CANCELADO', ativo: true },
      ])

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
