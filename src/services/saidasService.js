import { dataClient as api } from './dataClient.js'

export const listSaidas = (query = {}) => api.saidas.list(query)
export const createSaida = (payload) => api.saidas.create(payload)
export const updateSaida = (id, payload) => api.saidas.update(id, payload)
export const cancelSaida = (id, motivo) =>
  api?.saidas?.cancel
    ? api.saidas.cancel(id, motivo)
    : Promise.reject(new Error('Recurso de cancelamento indisponivel'))
export const getSaidaHistory = (id) => api.saidas.history(id)
export const listStatusSaida = () =>
  api?.statusSaida?.list
    ? api.statusSaida.list()
    : Promise.resolve([
        { id: 'registrado', status: 'Registrado' },
        { id: 'cancelado', status: 'Cancelado' },
      ])

export const listPessoas = () => api.pessoas.list({ status: 'ativo' })
export const listPessoasByIds = (ids = []) => (api?.pessoas?.listByIds ? api.pessoas.listByIds(ids) : Promise.resolve([]))

export const listMateriais = () =>
  api?.entradas?.materialOptions && typeof api.entradas.materialOptions === 'function'
    ? api.entradas.materialOptions()
    : api.materiais.list()

export const searchMateriais = (params) => (api?.materiais?.search ? api.materiais.search(params) : Promise.resolve([]))
export const getMaterialEstoque = async (materialId, centroEstoqueId = null) => {
  if (api?.estoque?.current) {
    // Usa a mesma fonte da tela Estoque Atual; se necessário, o backend pode aplicar centro
    const lista = await api.estoque.current({
      materialId,
      centroEstoque: centroEstoqueId,
    })
    const itens = Array.isArray(lista?.itens) ? lista.itens : Array.isArray(lista) ? lista : []
    return (
      itens.find((item) => item?.id === materialId || item?.materialId === materialId) ||
      itens[0] ||
      null
    )
  }
  if (api?.materiais?.estoqueAtual) {
    return api.materiais.estoqueAtual(materialId, centroEstoqueId)
  }
  return Promise.resolve(null)
}

export const searchPessoas = (params) => (api?.pessoas?.search ? api.pessoas.search(params) : Promise.resolve([]))

export const listCentrosCusto = () =>
  api?.centrosCusto && typeof api.centrosCusto.list === 'function' ? api.centrosCusto.list() : Promise.resolve([])

export const listCentrosServico = () =>
  api?.centrosServico && typeof api.centrosServico.list === 'function' ? api.centrosServico.list() : Promise.resolve([])

export const listCentrosEstoque = () => {
  if (api?.centrosEstoque && typeof api.centrosEstoque.list === 'function') {
    return api.centrosEstoque.list()
  }
  if (api?.centrosCusto && typeof api.centrosCusto.list === 'function') {
    return api.centrosCusto.list()
  }
  return Promise.resolve([])
}
