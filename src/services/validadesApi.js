import { supabase } from './supabaseClient.js'

// Camada de acesso do Controle de Validades (RPCs owner-scoped do Supabase).
// Todas as RPCs validam o owner da sessao e a permissao no banco; o owner enviado aqui so identifica o tenant.
// Regras de status, vencimento, snapshot e aplicabilidade ficam no banco: nada disso e recalculado aqui.

function assertClient() {
  if (!supabase) {
    throw new Error('Supabase nao configurado para o controle de validades.')
  }
}

async function callRpc(name, params, fallbackMessage) {
  assertClient()
  const { data, error } = await supabase.rpc(name, params)
  if (error) {
    const wrapped = new Error(error.message || fallbackMessage)
    wrapped.code = error.code
    wrapped.hint = error.hint || null
    wrapped.details = error.details || null
    wrapped.context = { rpc: name }
    throw wrapped
  }
  return data
}

// Remove chaves vazias para o banco aplicar apenas filtros informados.
export function limparFiltros(filtros = {}) {
  return Object.entries(filtros).reduce((acc, [chave, valor]) => {
    const texto = typeof valor === 'string' ? valor.trim() : valor
    if (texto !== '' && texto !== null && texto !== undefined) {
      acc[chave] = texto
    }
    return acc
  }, {})
}

export function fetchValidadesContexto(ownerId) {
  return callRpc('rpc_validades_contexto', { p_owner_id: ownerId }, 'Falha ao carregar o contexto do controle de validades.')
}

export async function carregarCatalogosValidades() {
  const tabelas = ['cargos', 'setores', 'centros_servico', 'centros_custo']
  const [cargos, setores, centrosServico, centrosCusto] = await Promise.all(
    tabelas.map((tabela) =>
      callRpc('rpc_catalog_list', { p_table: tabela }, `Falha ao carregar ${tabela.replace('_', ' ')}.`),
    ),
  )
  const normalizar = (lista) =>
    (Array.isArray(lista) ? lista : [])
      .filter((item) => item?.id && item?.nome)
      .map((item) => ({ id: item.id, nome: String(item.nome).trim() }))
  return {
    cargos: normalizar(cargos),
    setores: normalizar(setores),
    centrosServico: normalizar(centrosServico),
    centrosCusto: normalizar(centrosCusto),
  }
}

// Requisitos de Controle

export function listarRequisitos(ownerId) {
  return callRpc('rpc_requisitos_listar', { p_owner_id: ownerId }, 'Falha ao listar requisitos.')
}

export function salvarRequisito(ownerId, id, payload, motivo) {
  return callRpc(
    'rpc_requisito_salvar',
    { p_owner_id: ownerId, p_id: id || null, p_payload: payload, p_motivo: motivo || null },
    'Falha ao salvar o requisito.',
  )
}

export function definirRequisitoAtivo(ownerId, id, ativo, motivo) {
  return callRpc(
    'rpc_requisito_definir_ativo',
    { p_owner_id: ownerId, p_id: id, p_ativo: ativo, p_motivo: motivo || null },
    'Falha ao alterar a situacao do requisito.',
  )
}

export function listarRegrasRequisito(ownerId, requisitoId) {
  return callRpc(
    'rpc_requisito_regras',
    { p_owner_id: ownerId, p_requisito_id: requisitoId },
    'Falha ao listar as regras do requisito.',
  )
}

export function previaRegra(ownerId, regra) {
  return callRpc('rpc_requisito_previa', { p_owner_id: ownerId, p_regra: regra }, 'Falha ao calcular a previa.')
}

export function adicionarRegra(ownerId, requisitoId, regra) {
  return callRpc(
    'rpc_requisito_regra_adicionar',
    { p_owner_id: ownerId, p_requisito_id: requisitoId, p_regra: regra },
    'Falha ao adicionar a regra.',
  )
}

export function removerRegra(ownerId, regraId, motivo) {
  return callRpc(
    'rpc_requisito_regra_remover',
    { p_owner_id: ownerId, p_regra_id: regraId, p_motivo: motivo },
    'Falha ao remover a regra.',
  )
}

export function historicoRequisito(ownerId, requisitoId, limit = 100) {
  return callRpc(
    'rpc_requisitos_historico',
    { p_owner_id: ownerId, p_requisito_id: requisitoId, p_limit: limit },
    'Falha ao consultar o historico do requisito.',
  )
}

export function atualizarConfigValidades(ownerId, payload, motivo) {
  return callRpc(
    'rpc_requisitos_config_update',
    { p_owner_id: ownerId, p_payload: payload, p_motivo: motivo },
    'Falha ao salvar a configuracao.',
  )
}

// Controle de Validades

export function listarValidades(ownerId, filtros = {}, { limite = 20, offset = 0 } = {}) {
  return callRpc(
    'rpc_validades_lista',
    { p_owner_id: ownerId, p_filtros: limparFiltros(filtros), p_limite: limite, p_offset: offset },
    'Falha ao listar o controle de validades.',
  )
}

// Exportacao: percorre todas as paginas com os filtros aplicados.
export async function listarTodasValidades(ownerId, filtros = {}, tamanhoPagina = 2000) {
  const itens = []
  let offset = 0
  let total = Infinity
  while (offset < total) {
    const pagina = await listarValidades(ownerId, filtros, { limite: tamanhoPagina, offset })
    const lote = Array.isArray(pagina?.itens) ? pagina.itens : []
    total = Number(pagina?.total ?? 0)
    itens.push(...lote)
    if (!lote.length) break
    offset += lote.length
  }
  return itens
}

export function resumoValidades(ownerId, filtros = {}) {
  return callRpc(
    'rpc_validades_resumo',
    { p_owner_id: ownerId, p_filtros: limparFiltros(filtros) },
    'Falha ao carregar o painel de validades.',
  )
}

export function simularVencimento(ownerId, requisitoId, data) {
  return callRpc(
    'rpc_validades_simular_vencimento',
    { p_owner_id: ownerId, p_requisito_id: requisitoId, p_data: data },
    'Falha ao calcular o vencimento.',
  )
}

export function registrarRealizacao(ownerId, payload) {
  return callRpc('rpc_validades_registrar', { p_owner_id: ownerId, p_payload: payload }, 'Falha ao registrar a realizacao.')
}

export function renovarRealizacao(ownerId, realizacaoId, payload) {
  return callRpc(
    'rpc_validades_renovar',
    { p_owner_id: ownerId, p_realizacao_id: realizacaoId, p_payload: payload },
    'Falha ao renovar.',
  )
}

export function editarRealizacao(ownerId, realizacaoId, payload, motivo) {
  return callRpc(
    'rpc_validades_editar',
    { p_owner_id: ownerId, p_realizacao_id: realizacaoId, p_payload: payload, p_motivo: motivo },
    'Falha ao editar o registro.',
  )
}

export function cancelarRealizacao(ownerId, realizacaoId, motivo) {
  return callRpc(
    'rpc_validades_cancelar',
    { p_owner_id: ownerId, p_realizacao_id: realizacaoId, p_motivo: motivo },
    'Falha ao cancelar o registro.',
  )
}

export function historicoValidade(ownerId, pessoaId, requisitoId) {
  return callRpc(
    'rpc_validades_historico',
    { p_owner_id: ownerId, p_pessoa_id: pessoaId, p_requisito_id: requisitoId },
    'Falha ao consultar o historico.',
  )
}

export function dispensarRequisito(ownerId, payload) {
  return callRpc('rpc_validades_dispensar', { p_owner_id: ownerId, p_payload: payload }, 'Falha ao registrar a dispensa.')
}

export function revogarDispensa(ownerId, dispensaId, motivo) {
  return callRpc(
    'rpc_validades_dispensa_revogar',
    { p_owner_id: ownerId, p_dispensa_id: dispensaId, p_motivo: motivo },
    'Falha ao revogar a dispensa.',
  )
}
