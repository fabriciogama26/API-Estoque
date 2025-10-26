const TAXA_BASE = 1000000

const MONTH_NAMES_FULL = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return fallback
  }
  return parsed
}

function parseIsoDate(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function buildPeriodo(ano, mesIndex) {
  const month = String(mesIndex + 1).padStart(2, '0')
  return `${ano}-${month}`
}

function sanitizeMonth(value) {
  if (!value && value !== 0) {
    return null
  }
  const raw = String(value).trim()
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    return null
  }
  return raw
}

function normalizeKey(value) {
  if (!value && value !== 0) {
    return ''
  }
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchesFilter(value, targetKey) {
  if (!targetKey) {
    return true
  }
  if (Array.isArray(value)) {
    return value.some((item) => normalizeKey(item) === targetKey)
  }
  return normalizeKey(value) === targetKey
}

function buildMonthBoundary(periodo, boundary) {
  const sanitized = sanitizeMonth(periodo)
  if (!sanitized) {
    return null
  }
  const [anoStr, mesStr] = sanitized.split('-')
  const ano = Number.parseInt(anoStr, 10)
  const mes = Number.parseInt(mesStr, 10)
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) {
    return null
  }
  if (boundary === 'end') {
    return new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
  }
  return new Date(Date.UTC(ano, mes - 1, 1))
}

function comparePeriodos(a, b) {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return a.localeCompare(b)
}

function incrementPeriodo(periodo) {
  const sanitized = sanitizeMonth(periodo)
  if (!sanitized) {
    return null
  }
  const [anoStr, mesStr] = sanitized.split('-')
  const ano = Number.parseInt(anoStr, 10)
  const mes = Number.parseInt(mesStr, 10)
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) {
    return null
  }
  const base = new Date(Date.UTC(ano, mes - 1, 1))
  base.setUTCMonth(base.getUTCMonth() + 1)
  return buildPeriodo(base.getUTCFullYear(), base.getUTCMonth())
}

function buildPeriodRange(start, end) {
  const sanitizedStart = sanitizeMonth(start)
  const sanitizedEnd = sanitizeMonth(end)

  if (!sanitizedStart && !sanitizedEnd) {
    return []
  }

  let inicio = sanitizedStart || sanitizedEnd
  let fim = sanitizedEnd || sanitizedStart

  if (comparePeriodos(inicio, fim) > 0) {
    const tmp = inicio
    inicio = fim
    fim = tmp
  }

  const resultado = []
  let atual = inicio
  let passos = 0
  const limite = 600 // protecao contra loops

  while (atual && comparePeriodos(atual, fim) <= 0 && passos < limite) {
    resultado.push(atual)
    const proximo = incrementPeriodo(atual)
    if (!proximo || proximo === atual) {
      break
    }
    atual = proximo
    passos += 1
  }

  if (resultado.length === 0 && inicio) {
    resultado.push(inicio)
  }

  return resultado
}

function formatPeriodoExtenso(periodo) {
  const sanitized = sanitizeMonth(periodo)
  if (!sanitized) {
    return ''
  }
  const [anoStr, mesStr] = sanitized.split('-')
  const ano = Number.parseInt(anoStr, 10)
  const mes = Number.parseInt(mesStr, 10)
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) {
    return ''
  }
  const label = MONTH_NAMES_FULL[mes - 1] ?? mesStr
  return `${label} de ${ano}`
}

function buildPeriodoLabel(periodoInicio, periodoFim) {
  const inicioLabel = formatPeriodoExtenso(periodoInicio)
  const fimLabel = formatPeriodoExtenso(periodoFim)

  if (inicioLabel && fimLabel) {
    if (sanitizeMonth(periodoInicio) === sanitizeMonth(periodoFim)) {
      return inicioLabel
    }
    return `${inicioLabel} a ${fimLabel}`
  }

  if (inicioLabel) {
    return `A partir de ${inicioLabel}`
  }

  if (fimLabel) {
    return `Ate ${fimLabel}`
  }

  return 'Todos os periodos'
}

function collectOptions(lista, selector) {
  const mapa = new Map()
  lista.forEach((item) => {
    const bruto = selector(item)
    const valores = Array.isArray(bruto) ? bruto : [bruto]
    valores.forEach((valor) => {
      if (valor === undefined || valor === null) {
        return
      }
      const label = String(valor).trim()
      if (!label) {
        return
      }
      const chave = normalizeKey(label)
      if (!mapa.has(chave)) {
        mapa.set(chave, label)
      }
    })
  })

  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

function distribuirPorChave(lista, keySelector, fallback) {
  const mapa = new Map()
  lista.forEach((item) => {
    const bruto = keySelector(item)
    const valores = Array.isArray(bruto) && bruto.length > 0 ? bruto : [bruto]
    if (!valores.length) {
      const label = fallback || 'Nao informado'
      const chave = normalizeKey(label)
      if (!mapa.has(chave)) {
        mapa.set(chave, { label, total: 0 })
      }
      mapa.get(chave).total += 1
      return
    }
    valores.forEach((valor) => {
      const labelBase = valor === undefined || valor === null || valor === '' ? fallback : valor
      const label = String(labelBase || fallback || 'Nao informado').trim() || fallback || 'Nao informado'
      const chave = normalizeKey(label)
      if (!mapa.has(chave)) {
        mapa.set(chave, { label, total: 0 })
      }
      mapa.get(chave).total += 1
    })
  })

  return Array.from(mapa.values()).sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
  )
}

function montarTendencia(acidentes, periodoInicio, periodoFim) {
  const mapa = new Map()

  acidentes.forEach((acidente) => {
    const data = parseIsoDate(acidente?.data)
    if (!data) {
      return
    }
    const periodo = buildPeriodo(data.getUTCFullYear(), data.getUTCMonth())
    if (!mapa.has(periodo)) {
      mapa.set(periodo, {
        periodo,
        total_acidentes: 0,
        dias_perdidos: 0,
        hht_total: 0,
      })
    }
    const grupo = mapa.get(periodo)
    grupo.total_acidentes += 1
    grupo.dias_perdidos += toNumber(acidente?.diasPerdidos)
    grupo.hht_total += toNumber(acidente?.hht)
  })

  const periodosDisponiveis = Array.from(mapa.keys()).sort(comparePeriodos)

  let inicio = sanitizeMonth(periodoInicio)
  let fim = sanitizeMonth(periodoFim)

  if (!inicio && periodosDisponiveis.length) {
    inicio = periodosDisponiveis[0]
  }
  if (!fim && periodosDisponiveis.length) {
    fim = periodosDisponiveis[periodosDisponiveis.length - 1]
  }
  if (inicio && !fim) {
    fim = inicio
  }
  if (!inicio && fim) {
    inicio = fim
  }
  if (inicio && fim && comparePeriodos(inicio, fim) > 0) {
    const tmp = inicio
    inicio = fim
    fim = tmp
  }

  let periodosOrdenados = periodosDisponiveis
  if (inicio && fim) {
    periodosOrdenados = buildPeriodRange(inicio, fim)
  }

  return periodosOrdenados.map((periodo) => {
    const grupo = mapa.get(periodo) ?? {
      periodo,
      total_acidentes: 0,
      dias_perdidos: 0,
      hht_total: 0,
    }
    const { total_acidentes, dias_perdidos, hht_total } = grupo
    const taxa_frequencia = hht_total > 0 ? Number(((total_acidentes * TAXA_BASE) / hht_total).toFixed(2)) : 0
    const taxa_gravidade = hht_total > 0 ? Number(((dias_perdidos * TAXA_BASE) / hht_total).toFixed(2)) : 0

    return {
      periodo,
      total_acidentes,
      taxa_frequencia,
      taxa_gravidade,
    }
  })
}

export function montarDashboardAcidentes(acidentes = [], filtros = {}) {
  let periodoInicio = sanitizeMonth(filtros.periodoInicio)
  let periodoFim = sanitizeMonth(filtros.periodoFim)
  if (periodoInicio && periodoFim && comparePeriodos(periodoInicio, periodoFim) > 0) {
    const tmp = periodoInicio
    periodoInicio = periodoFim
    periodoFim = tmp
  }

  const centroServicoFiltro = normalizeKey(filtros.centroServico)
  const tipoFiltro = normalizeKey(filtros.tipo)
  const lesaoFiltro = normalizeKey(filtros.lesao)
  const parteFiltro = normalizeKey(filtros.parteLesionada)
  const agenteFiltro = normalizeKey(filtros.agente)
  const cargoFiltro = normalizeKey(filtros.cargo)

  const inicioDate = buildMonthBoundary(periodoInicio, 'start')
  const fimDate = buildMonthBoundary(periodoFim, 'end')

  const acidentesValidos = Array.isArray(acidentes) ? acidentes : []

  const filtradosPorPeriodo = acidentesValidos.filter((acidente) => {
    const data = parseIsoDate(acidente?.data)
    if (!data) {
      return false
    }
    if (inicioDate && data < inicioDate) {
      return false
    }
    if (fimDate && data > fimDate) {
      return false
    }
    return true
  })

  const availableOptions = {
    centrosServico: collectOptions(filtradosPorPeriodo, (item) => item?.centroServico ?? item?.setor ?? item?.local),
    tipos: collectOptions(filtradosPorPeriodo, (item) => item?.tipo),
    lesoes: collectOptions(filtradosPorPeriodo, (item) => item?.lesao),
    partesLesionadas: collectOptions(
      filtradosPorPeriodo,
      (item) => item?.partesLesionadas ?? (item?.parteLesionada ? [item.parteLesionada] : []),
    ),
    agentes: collectOptions(filtradosPorPeriodo, (item) => item?.agente),
    cargos: collectOptions(filtradosPorPeriodo, (item) => item?.cargo),
  }

  const listaFiltrada = filtradosPorPeriodo.filter((acidente) => {
    if (!matchesFilter(acidente?.centroServico ?? acidente?.setor ?? acidente?.local, centroServicoFiltro)) {
      return false
    }
    if (!matchesFilter(acidente?.tipo, tipoFiltro)) {
      return false
    }
    if (!matchesFilter(acidente?.lesao, lesaoFiltro)) {
      return false
    }
    if (
      !matchesFilter(acidente?.partesLesionadas ?? (acidente?.parteLesionada ? [acidente.parteLesionada] : []), parteFiltro)
    ) {
      return false
    }
    if (!matchesFilter(acidente?.agente, agenteFiltro)) {
      return false
    }
    if (!matchesFilter(acidente?.cargo, cargoFiltro)) {
      return false
    }
    return true
  })

  const totalAcidentes = listaFiltrada.length
  const diasPerdidos = listaFiltrada.reduce((total, acidente) => total + toNumber(acidente?.diasPerdidos), 0)
  const hhtTotal = listaFiltrada.reduce((total, acidente) => total + toNumber(acidente?.hht), 0)

  const resumo = {
    total_acidentes: totalAcidentes,
    dias_perdidos: diasPerdidos,
    hht_total: hhtTotal,
    taxa_frequencia: hhtTotal > 0 ? Number(((totalAcidentes * TAXA_BASE) / hhtTotal).toFixed(2)) : 0,
    taxa_gravidade: hhtTotal > 0 ? Number(((diasPerdidos * TAXA_BASE) / hhtTotal).toFixed(2)) : 0,
    periodo_label: buildPeriodoLabel(periodoInicio, periodoFim),
  }

  const tendencia = montarTendencia(listaFiltrada, periodoInicio, periodoFim)
  const tipos = distribuirPorChave(listaFiltrada, (item) => item?.tipo, 'Nao informado').map((item) => ({
    tipo: item.label,
    total: item.total,
  }))
  const partesLesionadas = distribuirPorChave(
    listaFiltrada,
    (item) => item?.partesLesionadas ?? (item?.parteLesionada ? [item.parteLesionada] : []),
    'Nao informado'
  ).map((item) => ({
    parte_lesionada: item.label,
    total: item.total,
  }))
  const cargos = distribuirPorChave(listaFiltrada, (item) => item?.cargo, 'Nao informado').map((item) => ({
    cargo: item.label,
    total: item.total,
  }))
  const agentes = distribuirPorChave(listaFiltrada, (item) => item?.agente, 'Nao informado').map((item) => ({
    agente: item.label,
    total: item.total,
  }))

  return {
    resumo,
    tendencia,
    tipos,
    partesLesionadas,
    cargos,
    agentes,
    options: availableOptions,
  }
}
