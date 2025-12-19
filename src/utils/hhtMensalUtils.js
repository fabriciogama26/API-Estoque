const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

export function buildMesRefFromMonth(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    return null
  }
  return `${raw}-01`
}

export function formatMesRefLabel(mesRef) {
  const raw = String(mesRef ?? '').trim()
  if (!raw) {
    return '-'
  }
  // Se vier em ISO (YYYY-MM-DD) ou apenas YYYY-MM, evita fuso extraindo direto do texto.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.slice(0, 7) : /^\d{4}-\d{2}$/.test(raw) ? raw : null
  if (normalized) {
    const [year, month] = normalized.split('-')
    return `${month}/${year}`
  }
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return raw
  }
  return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

export function normalizeModo(value) {
  const modo = String(value ?? '').trim().toLowerCase()
  if (modo === 'manual' || modo === 'simples' || modo === 'completo') {
    return modo
  }
  return 'simples'
}

export function computeHhtCalculado(payload = {}) {
  const modo = normalizeModo(payload.modo)
  const qtdPessoas = Math.max(0, Math.trunc(toNumber(payload.qtdPessoas ?? payload.qtd_pessoas, 0)))
  const horasMesBase = Math.max(0, toNumber(payload.horasMesBase ?? payload.horas_mes_base, 0))

  if (modo === 'simples') {
    return qtdPessoas * horasMesBase
  }

  const escalaFactor = Math.max(0, toNumber(payload.escalaFactor ?? payload.escala_factor, 1))
  const horasAfastamento = Math.max(0, toNumber(payload.horasAfastamento ?? payload.horas_afastamento, 0))
  const horasFerias = Math.max(0, toNumber(payload.horasFerias ?? payload.horas_ferias, 0))
  const horasTreinamento = Math.max(0, toNumber(payload.horasTreinamento ?? payload.horas_treinamento, 0))
  const horasOutrosDescontos = Math.max(
    0,
    toNumber(payload.horasOutrosDescontos ?? payload.horas_outros_descontos, 0),
  )
  const horasExtras = Math.max(0, toNumber(payload.horasExtras ?? payload.horas_extras, 0))

  const base = qtdPessoas * horasMesBase * escalaFactor
  const descontos = horasAfastamento + horasFerias + horasTreinamento + horasOutrosDescontos
  return base - descontos + horasExtras
}

export function computeHhtFinal(payload = {}) {
  const modo = normalizeModo(payload.modo)
  if (modo === 'manual') {
    const informado = payload.hhtInformado ?? payload.hht_informado
    if (informado === undefined || informado === null || informado === '') {
      return null
    }
    return toNumber(informado, null)
  }
  return computeHhtCalculado(payload)
}

export function formatHhtValue(value) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  const number = Number(value)
  if (Number.isNaN(number)) {
    return String(value)
  }
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
