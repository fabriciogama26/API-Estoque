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
