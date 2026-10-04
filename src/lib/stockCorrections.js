import { formatMaterialSummary } from '../utils/entradasUtils.js'

// Aprovar/rejeitar: quem tem permissao analisa solicitacoes de outros usuarios; a propria
// solicitacao so pode ser analisada pelo titular da conta (o banco aplica a mesma regra).
export function canResolveStockCorrection({ row, userId, canApprove, isAccountOwner }) {
  if (!canApprove || row?.status !== 'PENDENTE') return false
  return row.requested_by !== userId || Boolean(isAccountOwner)
}

// Nome do usuario igual ao "Registrado por" de Entradas e Saidas (_usuario_nome no banco):
// username primeiro; display_name e email so quando falta.
export function correctionUserName(user) {
  const candidates = [user?.username, user?.display_name, user?.email]
  return candidates.map((value) => String(value ?? '').trim()).find(Boolean) || ''
}

// Nome completo do material (nome | grupo | tamanho/CA | cores | caracteristicas | fabricante), o mesmo
// resumo de Entradas e Saidas; sem cadastro carregado, cai para o ID.
export function correctionMaterialLabel(row) {
  const material = row?.material
  return formatMaterialSummary(material) || material?.materialItemNome || material?.descricao || row?.material_id || ''
}

const normalizeTerm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

// Filtro "Material" da tela de aprovacao: aceita ID, CA, descricao ou qualquer parte do nome completo
// (nome, grupo, tamanho, cores, caracteristicas, fabricante), sem diferenciar maiusculas e acentos.
// Varias palavras precisam aparecer todas.
export function matchesCorrectionMaterial(row, term) {
  const tokens = normalizeTerm(term).split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const material = row?.material || {}
  const text = normalizeTerm([
    row?.material_id,
    material.ca,
    material.descricao,
    correctionMaterialLabel(row),
    material.fabricanteNome,
  ].filter(Boolean).join(' '))
  return tokens.every((token) => text.includes(token))
}

export function dedupeStockCentersById(centers = []) {
  const seenIds = new Set()

  return centers.filter((center) => {
    if (center?.id === null || center?.id === undefined || center.id === '') return true

    const id = String(center.id)
    if (seenIds.has(id)) return false

    seenIds.add(id)
    return true
  })
}
