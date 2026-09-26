import { supabase } from './supabaseClient.js'

// Camada de acesso da politica de reposicao (RPCs owner-scoped do Supabase).
// Todas as RPCs validam o owner da sessao no banco; o owner enviado aqui so identifica o tenant.

function assertClient() {
  if (!supabase) {
    throw new Error('Supabase nao configurado para consultar a reposicao.')
  }
}

async function callRpc(name, params, fallbackMessage) {
  assertClient()
  const { data, error } = await supabase.rpc(name, params)
  if (error) {
    const wrapped = new Error(error.message || fallbackMessage)
    wrapped.code = error.code
    wrapped.details = error.details || null
    wrapped.context = { rpc: name }
    throw wrapped
  }
  return data
}

export function fetchReposicaoItens(ownerId) {
  return callRpc('rpc_reposicao_itens', { p_owner_id: ownerId }, 'Falha ao consultar a reposicao atual.')
}

export function fetchPoliticaReposicao(ownerId) {
  return callRpc('rpc_inventory_policy_get', { p_owner_id: ownerId }, 'Falha ao consultar a politica de reposicao.')
}

export function fetchPoliticaReposicaoHistorico(ownerId, limit = 30) {
  return callRpc(
    'rpc_inventory_policy_history',
    { p_owner_id: ownerId, p_limit: limit },
    'Falha ao consultar o historico da politica.',
  )
}

export function updatePoliticaReposicao(ownerId, payload, motivo) {
  return callRpc(
    'rpc_inventory_policy_update',
    { p_owner_id: ownerId, p_payload: payload, p_motivo: motivo },
    'Falha ao salvar a politica de reposicao.',
  )
}

export function setOverrideReposicao(ownerId, { materialId, minimo, maximo, motivo, expiraEm }) {
  return callRpc(
    'rpc_inventory_override_set',
    {
      p_owner_id: ownerId,
      p_material_id: materialId,
      p_minimo: minimo,
      p_maximo: maximo,
      p_motivo: motivo,
      p_expira_em: expiraEm || null,
    },
    'Falha ao salvar o override do material.',
  )
}

export function revokeOverrideReposicao(ownerId, overrideId, motivo) {
  return callRpc(
    'rpc_inventory_override_revoke',
    { p_owner_id: ownerId, p_override_id: overrideId, p_motivo: motivo },
    'Falha ao revogar o override do material.',
  )
}

// Altera somente materiais."estoqueMinimo" (minimo cadastrado), com historico no banco.
export function updateEstoqueMinimoCadastrado(materialId, estoqueMinimo, motivo = null) {
  return callRpc(
    'rpc_material_estoque_minimo_update',
    { p_material_id: materialId, p_estoque_minimo: estoqueMinimo, p_motivo: motivo || null },
    'Falha ao salvar o minimo cadastrado.',
  )
}
