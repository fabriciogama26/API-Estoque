// Aprovar/rejeitar: quem tem permissao analisa solicitacoes de outros usuarios; a propria
// solicitacao so pode ser analisada pelo titular da conta (o banco aplica a mesma regra).
export function canResolveStockCorrection({ row, userId, canApprove, isAccountOwner }) {
  if (!canApprove || row?.status !== 'PENDENTE') return false
  return row.requested_by !== userId || Boolean(isAccountOwner)
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
