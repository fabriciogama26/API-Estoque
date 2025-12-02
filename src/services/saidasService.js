import { dataClient as api } from './dataClient.js'

export const listSaidas = (query = {}) => api.saidas.list(query)
export const createSaida = (payload) => api.saidas.create(payload)
export const updateSaida = (id, payload) => api.saidas.update(id, payload)
export const cancelSaida = (id, motivo) => api.saidas.cancelar ? api.saidas.cancelar(id, motivo) : Promise.reject(new Error('Recurso de cancelamento indisponivel'))
export const getSaidaHistory = (id) => api.saidas.history(id)

export const listPessoas = () => api.pessoas.list()
export const listPessoasByIds = (ids = []) => (api?.pessoas?.listByIds ? api.pessoas.listByIds(ids) : Promise.resolve([]))

export const listMateriais = () =>
  api?.entradas?.materialOptions && typeof api.entradas.materialOptions === 'function'
    ? api.entradas.materialOptions()
    : api.materiais.list()

export const searchMateriais = (params) => (api?.materiais?.search ? api.materiais.search(params) : Promise.resolve([]))
export const getMaterialEstoque = (materialId) =>
  api?.materiais?.estoqueAtual ? api.materiais.estoqueAtual(materialId) : Promise.resolve(null)

export const searchPessoas = (params) => (api?.pessoas?.search ? api.pessoas.search(params) : Promise.resolve([]))

export const listCentrosCusto = () =>
  api?.centrosCusto && typeof api.centrosCusto.list === 'function' ? api.centrosCusto.list() : Promise.resolve([])

export const listCentrosServico = () =>
  api?.centrosServico && typeof api.centrosServico.list === 'function' ? api.centrosServico.list() : Promise.resolve([])
