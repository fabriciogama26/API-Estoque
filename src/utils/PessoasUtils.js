export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function formatDate(dateISO) {
  if (!dateISO) {
    return '-'
  }
  const raw = String(dateISO).trim()
  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  const value = dateOnlyMatch ? `${dateOnlyMatch[1]}T00:00:00Z` : raw
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function formatDateTime(dateISO) {
  if (!dateISO) {
    return '-'
  }
  const raw = String(dateISO).trim()
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR', { timeZone: 'UTC' })
}

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}
