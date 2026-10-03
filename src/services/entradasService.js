import { dataClient as api } from './dataClient.js'
import { paginarNoNavegador, registrantesDaLista } from '../utils/movimentacoesPaginacao.js'

export const listEntradas = (query = {}) => api.entradas.list(query)

// Pagina da lista de entradas ({ itens, total }); no modo local pagina no navegador.
export const listEntradasPagina = async (query = {}, opcoes = {}) =>
  api?.entradas?.listPage ? api.entradas.listPage(query, opcoes) : paginarNoNavegador(await api.entradas.list(query), opcoes)

export const exportarEntradas = (query = {}) =>
  api?.entradas?.exportAll ? api.entradas.exportAll(query) : api.entradas.list(query)

export const listRegistrantesEntradas = async () =>
  api?.entradas?.registrantes ? api.entradas.registrantes() : registrantesDaLista(await api.entradas.list({}))

// Saldo oficial do material no centro (mesma regra que o banco usa para validar o cancelamento).
// O modo local nao tem a funcao do banco e soma os lancamentos locais do centro.
export const getSaldoMaterialCentro = async (materialId, centroEstoqueId) => {
  if (api?.materiais?.estoqueAtual) {
    return Number((await api.materiais.estoqueAtual(materialId, centroEstoqueId)) ?? 0)
  }
  const [entradas, saidas] = await Promise.all([api.entradas.list({ materialId }), api.saidas.list({ materialId })])
  const ativo = (registro) => String(registro?.statusNome || registro?.status || '').trim().toLowerCase() !== 'cancelado'
  const somar = (lista, campoCentro) =>
    (lista ?? [])
      .filter((registro) => ativo(registro) && (!centroEstoqueId || String(registro?.[campoCentro] ?? '') === String(centroEstoqueId)))
      .reduce((acc, registro) => acc + Number(registro?.quantidade ?? 0), 0)
  return somar(entradas, 'centroCustoId') - somar(saidas, 'centroEstoqueId')
}

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

export const downloadEntradaTemplate = () => {
  if (api?.entradas?.downloadTemplate) {
    return api.entradas.downloadTemplate()
  }
  return Promise.reject(new Error('Endpoint de download de modelo nao configurado.'))
}

export const importEntradaPlanilha = (file) => {
  if (!file) {
    return Promise.reject(new Error('Selecione um arquivo XLSX.'))
  }
  if (api?.entradas?.importPlanilha) {
    return api.entradas.importPlanilha(file)
  }
  return Promise.reject(new Error('Endpoint de importacao de entradas nao configurado.'))
}

export const listCentrosEstoque = () => {
  if (api?.centrosEstoque && typeof api.centrosEstoque.list === 'function') {
    return api.centrosEstoque.list()
  }
  if (api?.centrosCusto && typeof api.centrosCusto.list === 'function') {
    return api.centrosCusto.list()
  }
  return Promise.resolve([])
}
