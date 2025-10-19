const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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
