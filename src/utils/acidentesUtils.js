// Utilitarios puros usados na tela de Acidentes

export const toInputDateTime = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export const parseList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
      .filter(Boolean)
  }
  if (value === undefined || value === null) {
    return []
  }
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

export const normalizeAgenteNome = (valor) => {
  if (typeof valor === 'string') {
    return valor.trim()
  }
  if (valor === undefined || valor === null) {
    return ''
  }
  return String(valor).trim()
}

export const normalizeAgenteKey = (valor) =>
  normalizeAgenteNome(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

export const extractAgenteNome = (entrada) => {
  if (!entrada) {
    return ''
  }
  if (typeof entrada === 'string') {
    return entrada
  }
  if (typeof entrada === 'object') {
    return entrada.nome ?? entrada.label ?? entrada.value ?? entrada.descricao ?? ''
  }
  return ''
}

export const formatDateTimeLabel = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('pt-BR')
}

export const formatDateWithOptionalTime = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const hasTime = typeof value === 'string' && value.includes('T')
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    ...(hasTime ? { timeStyle: 'short' } : {}),
  })
  return formatter.format(date)
}

export const formatNumberValue = (value) => {
  if (value === null || value === undefined) {
    return '-'
  }
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return '-'
  }
  return numeric
}

export const formatDateOnly = (value) => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toLocaleDateString('pt-BR')
}

export const formatStatusWithDate = (flag, date) => {
  const status = flag ? 'Sim' : 'Nao'
  const dateText = formatDateOnly(date)
  return dateText ? `${status} - ${dateText}` : status
}

export const formatDateShort = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('pt-BR')
}

export const formatDateTimeFull = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR')
}

export const formatHistoryValue = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return 'Nao informado'
  }
  if (Array.isArray(valor)) {
    return valor.length ? valor.join(', ') : 'Nao informado'
  }
  if (campo === 'data' || campo === 'dataEsocial' || campo === 'dataSesmt') {
    return formatDateShort(valor)
  }
  if (campo === 'sesmt') {
    return valor ? 'Sim' : 'Nao'
  }
  return String(valor)
}
