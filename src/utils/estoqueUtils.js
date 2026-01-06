// Utilitarios puros para Estoque

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))

export const formatInteger = (value) => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))

export const normalizeTerm = (termo) => (termo ? termo.trim().toLowerCase() : '')

const sanitizeDigits = (value) => String(value ?? '').replace(/\D/g, '')

export const formatDateTimeValue = (value) => {
  if (!value) {
    return '-'
  }
  const raw = typeof value === 'string' ? value.trim() : value
  if (!raw) {
    return '-'
  }

  const isoMatch =
    typeof raw === 'string'
      ? raw.match(
          /^\s*(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?\s*$/,
        )
      : null
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'

  if (isoMatch) {
    const [, year, month, day, hour, minute, second] = isoMatch
    const dateOnlyText = `${year}-${month}-${day}`
    const hasTime = hour !== undefined && hour !== null
    const timeIsZero = hasTime && hour === '00' && minute === '00' && (!second || second === '00')

    if (!hasTime || timeIsZero) {
      const localDate = new Date(`${dateOnlyText}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) {
        return '-'
      }
      return localDate.toLocaleDateString('pt-BR', { timeZone })
    }
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone,
  })
}

export const uniqueSorted = (values = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))

const matchesTerm = (material = {}, termoNormalizado = '') => {
  if (!termoNormalizado) {
    return true
  }
  const camposTexto = [
    material.nome,
    material.fabricante,
    material.resumo,
    material.grupoMaterialNome,
    material.grupoMaterial,
    material.caracteristicasTexto,
    material.corMaterial,
    material.coresTexto,
    material.numeroEspecifico,
    material.numeroCalcado,
    material.numeroCalcadoNome,
    material.numeroVestimenta,
    material.numeroVestimentaNome,
    material.id,
    material.materialId,
    material.ca,
  ]
  if (Array.isArray(material.centrosCusto)) {
    camposTexto.push(material.centrosCusto.join(' '))
  }
  if (material.ca) {
    const caSomenteDigitos = sanitizeDigits(material.ca)
    if (caSomenteDigitos) {
      camposTexto.push(caSomenteDigitos)
    }
  }
  return camposTexto
    .map((valor) => (valor ? String(valor).toLowerCase() : ''))
    .some((texto) => texto.includes(termoNormalizado))
}

export const parsePeriodoRange = (inicio, fim) => {
  const parseMonthStart = (value) => {
    if (!value) return null
    const [ano, mes] = value.split('-').map(Number)
    if (!ano || !mes) return null
    return new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0))
  }
  const parseMonthEnd = (value) => {
    if (!value) return null
    const [ano, mes] = value.split('-').map(Number)
    if (!ano || !mes) return null
    return new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
  }
  const start = parseMonthStart(inicio)
  const end = parseMonthEnd(fim || inicio)
  return { start, end }
}

export const filterEstoqueItens = (itens = [], filters = {}, periodoFiltro = {}) => {
  const termoNormalizado = normalizeTerm(filters.termo)
  const centroFiltro = (filters.centroCusto ?? '').trim().toLowerCase()
  const estoqueMinimoFiltro = (filters.estoqueMinimo ?? '').trim()
  const estoqueMinimoNumero =
    estoqueMinimoFiltro !== '' && !Number.isNaN(Number(estoqueMinimoFiltro))
      ? Number(estoqueMinimoFiltro)
      : null
  const aplicarEstoqueMinimo = estoqueMinimoNumero !== null
  const apenasAlertas = Boolean(filters.apenasAlertas)
  const apenasSaidas = Boolean(filters.apenasSaidas)

  return itens.filter((item) => {
    if (centroFiltro) {
      const centros = Array.isArray(item.centrosCusto) ? item.centrosCusto : []
      const possuiCentro = centros.some((centro) => centro.toLowerCase() === centroFiltro)
      if (!possuiCentro) {
        return false
      }
    }

    if (periodoFiltro.start || periodoFiltro.end) {
      const ultimaAtualizacao = item.ultimaAtualizacao ? new Date(item.ultimaAtualizacao) : null
      if (!ultimaAtualizacao || Number.isNaN(ultimaAtualizacao.getTime())) {
        return false
      }
      if (periodoFiltro.start && ultimaAtualizacao < periodoFiltro.start) {
        return false
      }
      if (periodoFiltro.end && ultimaAtualizacao > periodoFiltro.end) {
        return false
      }
    }

    if (aplicarEstoqueMinimo) {
      const minimoConfigurado = Number(item.estoqueMinimo ?? 0)
      if (Number.isNaN(minimoConfigurado) || minimoConfigurado < estoqueMinimoNumero) {
        return false
      }
    }

    if (apenasAlertas && !item.alerta) {
      return false
    }

    if (apenasSaidas) {
      const temSaidaFlag = Boolean(item.temSaida || item.ultimaSaida)
      const totalSaidas = Number(item.totalSaidas ?? 0)
      if (!temSaidaFlag && totalSaidas <= 0) {
        return false
      }
    }

    return matchesTerm(item, termoNormalizado)
  })
}

const sanitizeCsvValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : String(value)
  const clean = text.replace(/"/g, '""').replace(/\r?\n/g, ' ').trim()
  if (/[;"\n]/.test(clean)) {
    return `"${clean}"`
  }
  return clean
}

const formatCsvNumber = (value, decimals = null) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return ''
  }
  if (decimals === null) {
    return String(num)
  }
  return num.toFixed(decimals)
}

const formatCsvDate = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('pt-BR')
}

export const buildEstoqueCsv = (itens = []) => {
  const headers = [
    'Material ID',
    'Material',
    'Fabricante',
    'CA',
    'Cor',
    'Validade (dias)',
    'Centros de estoque',
    'Quantidade em estoque',
    'Total de entradas',
    'Total de saídas',
    'Estoque mínimo',
    'Déficit',
    'Valor unitário',
    'Valor total',
    'Valor para reposição',
    'Última atualização',
    'Última saída (data)',
  ]

  const rows = (Array.isArray(itens) ? itens : []).map((item) => {
    const ultimaSaidaData = item?.ultimaSaida?.dataEntrega ?? null
    const valores = [
      item?.materialId,
      item?.resumo || item?.nome || '',
      item?.fabricanteNome || item?.fabricante || '',
      item?.ca || '',
      item?.corMaterial || item?.coresTexto || '',
      item?.validadeDias ?? '',
      Array.isArray(item?.centrosCusto) ? item.centrosCusto.join(', ') : '',
      formatCsvNumber(item?.quantidade ?? item?.estoqueAtual ?? 0),
      formatCsvNumber(item?.totalEntradas ?? 0),
      formatCsvNumber(item?.totalSaidas ?? 0),
      formatCsvNumber(item?.estoqueMinimo ?? 0),
      formatCsvNumber(item?.deficitQuantidade ?? 0),
      formatCsvNumber(item?.valorUnitario ?? 0, 2),
      formatCsvNumber(item?.valorTotal ?? 0, 2),
      formatCsvNumber(item?.valorReposicao ?? 0, 2),
      formatCsvDate(item?.ultimaAtualizacao),
      formatCsvDate(ultimaSaidaData),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return [headers.join(';'), ...rows].join('\n')
}

export const downloadEstoqueCsv = (itens = [], options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'estoque-atual.csv'
  const csvContent = buildEstoqueCsv(itens)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
