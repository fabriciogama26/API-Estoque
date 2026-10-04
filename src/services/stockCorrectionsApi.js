import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { dedupeStockCentersById } from '../lib/stockCorrections.js'

function ensureClient() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('As correções de estoque exigem conexão com o Supabase.')
  }
  return supabase
}

function unwrap({ data, error }, fallback) {
  if (error) throw new Error(error.message || fallback)
  return data
}

// Campos do material para os detalhes da correcao e para o filtro por ID, CA ou nome.
const MATERIAL_DETAIL_COLUMNS = [
  'id',
  'nome',
  '"materialItemNome"',
  'descricao',
  'ca',
  '"fabricanteNome"',
  '"grupoMaterialNome"',
  '"numeroCalcadoNome"',
  '"numeroVestimentaNome"',
  '"numeroEspecifico"',
  '"coresTexto"',
  '"caracteristicasTexto"',
  '"validadeDias"',
  '"valorUnitario"',
  '"estoqueMinimo"',
  'ativo',
].join(', ')

const USER_COLUMNS = 'id, username, display_name, email'

// O filtro de material e feito na tela (ID, CA ou nome), sobre os materiais carregados aqui.
export async function listStockCorrections({ status = '', stockCenterId = '', start = '', end = '' } = {}) {
  const client = ensureClient()
  let query = client
    .from('stock_correction_requests')
    .select(`
      *,
      stock_center:centros_estoque(id, almox),
      requester:app_users!stock_correction_requests_requested_by_fkey(${USER_COLUMNS}),
      approver:app_users!stock_correction_requests_approved_by_fkey(${USER_COLUMNS}),
      rejecter:app_users!stock_correction_requests_rejected_by_fkey(${USER_COLUMNS}),
      canceller:app_users!stock_correction_requests_cancelled_by_fkey(${USER_COLUMNS}),
      adjustment:stock_adjustments(id, adjustment_quantity, created_at)
    `)
    .order('requested_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (stockCenterId) query = query.eq('stock_center_id', stockCenterId)
  if (start) query = query.gte('requested_at', `${start}T00:00:00`)
  if (end) query = query.lte('requested_at', `${end}T23:59:59.999`)
  const requests = unwrap(await query, 'Falha ao consultar correções de estoque.') || []
  const materialIds = [...new Set(requests.map((request) => request.material_id).filter(Boolean))]
  if (!materialIds.length) return requests

  const materials = unwrap(
    await client.from('materiais_view').select(MATERIAL_DETAIL_COLUMNS).in('id', materialIds),
    'Falha ao consultar os materiais das correções.',
  ) || []
  const materialsById = new Map(materials.map((material) => [material.id, material]))
  return requests.map((request) => ({ ...request, material: materialsById.get(request.material_id) || null }))
}

export async function listCorrectionCenters() {
  const centers = unwrap(
    await ensureClient().rpc('rpc_catalog_list', { p_table: 'centros_estoque' }),
    'Falha ao consultar centros de estoque.',
  ) || []
  return dedupeStockCentersById(centers).map((center) => ({ ...center, almox: center.nome }))
}

export async function listCorrectionOptions() {
  const [materialsResult, centers] = await Promise.all([
    ensureClient().rpc('rpc_stock_correction_material_options'),
    listCorrectionCenters(),
  ])
  return {
    materials: (unwrap(materialsResult, 'Falha ao consultar materiais.') || []).map((material) => ({
      ...material,
      materialItemNome: material.material_item_nome,
    })),
    centers,
  }
}

export async function requestStockCorrection({ materialId, stockCenterId, physicalQuantity, notes }) {
  return unwrap(await ensureClient().rpc('rpc_stock_correction_request', {
    p_material_id: materialId,
    p_stock_center_id: stockCenterId,
    p_physical_quantity: physicalQuantity,
    p_notes: notes || null,
  }), 'Falha ao solicitar correção.')
}

export async function getCorrectionBalance(materialId, stockCenterId) {
  return unwrap(await ensureClient().rpc('rpc_stock_correction_balance', {
    p_material_id: materialId,
    p_stock_center_id: stockCenterId,
  }), 'Falha ao consultar saldo oficial.')
}

export async function approveStockCorrection(id) {
  return unwrap(await ensureClient().rpc('rpc_stock_correction_approve', { p_request_id: id }), 'Falha ao aprovar correção.')
}

export async function rejectStockCorrection(id, reason) {
  return unwrap(await ensureClient().rpc('rpc_stock_correction_reject', { p_request_id: id, p_reason: reason }), 'Falha ao rejeitar correção.')
}

export async function cancelStockCorrection(id, reason = '') {
  return unwrap(await ensureClient().rpc('rpc_stock_correction_cancel', { p_request_id: id, p_reason: reason || null }), 'Falha ao cancelar correção.')
}
