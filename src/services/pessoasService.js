import { dataClient as api } from './dataClient.js'

export const listPessoas = (query = {}) => api.pessoas.list(query)
export const createPessoa = (payload) => api.pessoas.create(payload)
export const updatePessoa = (id, payload) => api.pessoas.update(id, payload)
export const getPessoaHistory = (id) => api.pessoas.history(id)
export const getPessoasResumo = () => (api.pessoas?.resumo ? api.pessoas.resumo() : Promise.resolve(null))
export const listPessoasReferences = () =>
  api.references && typeof api.references.pessoas === 'function' ? api.references.pessoas() : Promise.resolve(null)
export const searchPessoas = (params) => (api?.pessoas?.search ? api.pessoas.search(params) : Promise.resolve([]))
