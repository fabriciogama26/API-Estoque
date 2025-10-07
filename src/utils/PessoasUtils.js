export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function formatDate(dateISO) {
  if (!dateISO) {
    return '-'
  }
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('pt-BR')
}

export function formatDateTime(dateISO) {
  if (!dateISO) {
    return '-'
  }
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR')
}

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}
