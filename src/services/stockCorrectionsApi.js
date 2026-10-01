import { supabase, isSupabaseConfigured } from './supabaseClient.js'

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

export async function listStockCorrections({ status = '', materialId = '', stockCenterId = '', start = '', end = '' } = {}) {
  const client = ensureClient()
  let query = client
    .from('stock_correction_requests')
    .select(`
      *,
      stock_center:centros_estoque(id, almox),
      requester:app_users!stock_correction_requests_requested_by_fkey(id, display_name, username),
      approver:app_users!stock_correction_requests_approved_by_fkey(id, display_name, username)
    `)
    .order('requested_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (materialId) query = query.eq('material_id', materialId)
  if (stockCenterId) query = query.eq('stock_center_id', stockCenterId)
  if (start) query = query.gte('requested_at', `${start}T00:00:00`)
  if (end) query = query.lte('requested_at', `${end}T23:59:59.999`)
  const requests = unwrap(await query, 'Falha ao consultar correções de estoque.') || []
  const materialIds = [...new Set(requests.map((request) => request.material_id).filter(Boolean))]
  if (!materialIds.length) return requests

  const materials = unwrap(
    await client.from('materiais_view').select('id, descricao, "materialItemNome"').in('id', materialIds),
    'Falha ao consultar os materiais das correções.',
  ) || []
  const materialsById = new Map(materials.map((material) => [material.id, material]))
  return requests.map((request) => ({ ...request, material: materialsById.get(request.material_id) || null }))
}

export async function listCorrectionOptions() {
  const client = ensureClient()
  const [materialsResult, centersResult] = await Promise.all([
    client.from('materiais_view').select('id, descricao, "materialItemNome"').eq('ativo', true).order('materialItemNome'),
    client.from('centros_estoque').select('id, almox').eq('ativo', true).order('almox'),
  ])
  return {
    materials: unwrap(materialsResult, 'Falha ao consultar materiais.') || [],
    centers: unwrap(centersResult, 'Falha ao consultar centros de estoque.') || [],
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
