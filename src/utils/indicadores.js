const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const OIT_FREQUENCY_BANDS = [
  { limit: 20, label: 'Muito bom', level: 'excellent', range: 'ate 20' },
  { limit: 40, label: 'Bom', level: 'good', range: '20,1 a 40' },
  { limit: 60, label: 'Ruim', level: 'bad', range: '40,1 a 60' },
  { limit: Number.POSITIVE_INFINITY, label: 'Pessimo', level: 'awful', range: 'acima de 60' },
]

const OIT_SEVERITY_BANDS = [
  { limit: 500, label: 'Muito bom', level: 'excellent', range: 'ate 500' },
  { limit: 1000, label: 'Bom', level: 'good', range: '500,01 a 1.000' },
  { limit: 2000, label: 'Ruim', level: 'bad', range: '1.000,01 a 2.000' },
  { limit: Number.POSITIVE_INFINITY, label: 'Pessimo', level: 'awful', range: 'acima de 2.000' },
]

export function formatPeriodoLabel(periodo) {
  if (!periodo) {
    return ''
  }

  if (typeof periodo === 'string') {
    const trimmed = periodo.trim()
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [ano, mes] = trimmed.split('-')
      const monthIndex = Number.parseInt(mes, 10) - 1
      const monthLabel = MONTH_LABELS[monthIndex] ?? mes
      return `${monthLabel}/${ano}`
    }

    if (/^\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed
    }
  }

  if (periodo instanceof Date) {
    const ano = periodo.getFullYear()
    const mes = periodo.getMonth()
    const monthLabel = MONTH_LABELS[mes] ?? String(mes + 1).padStart(2, '0')
    return `${monthLabel}/${ano}`
  }

  return String(periodo)
}

export function resolveIndicadorValor(indicadores = {}, possibilidades = []) {
  for (const chave of possibilidades) {
    if (Object.hasOwn(indicadores, chave)) {
      const valor = indicadores[chave]
      if (valor !== null && valor !== undefined) {
        return valor
      }
    }
  }
  return null
}

function sanitizeNumber(value) {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'))
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function resolveOitBand(value, type) {
  if (value === null || value === undefined) {
    return null
  }
  const numericValue = sanitizeNumber(value)
  if (numericValue === null) {
    return null
  }
  const normalizedValue = Math.max(0, numericValue)
  const bands = type === 'frequency' ? OIT_FREQUENCY_BANDS : OIT_SEVERITY_BANDS
  const band = bands.find(({ limit }) => normalizedValue <= limit)
  if (!band) {
    return null
  }
  return {
    ...band,
    type,
    value: normalizedValue,
  }
}

export function getOitClassification(type, valor) {
  if (!type) {
    return null
  }
  return resolveOitBand(valor, type)
}
