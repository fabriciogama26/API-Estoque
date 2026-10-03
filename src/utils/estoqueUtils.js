// Utilitarios puros para Estoque
import {
  coberturaEmDias,
  formatBaseCalculo,
  formatFonteRegra,
  formatSituacaoReposicao,
} from './reposicaoUtils.js'

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

const parseFiltroNumero = (value) => {
  const texto = String(value ?? '').trim()
  if (texto === '') return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

// Faixa de cobertura em dias (de/ate, inclusive); se o usuario inverter os limites, a faixa e reordenada.
const parseFaixaCoberturaDias = (minValue, maxValue) => {
  const min = parseFiltroNumero(minValue)
  const max = parseFiltroNumero(maxValue)
  if (min === null && max === null) return null
  if (min !== null && max !== null && min > max) return { min: max, max: min }
  return { min, max }
}

export const filterEstoqueItens = (itens = [], filters = {}, options = {}) => {
  const termoNormalizado = normalizeTerm(filters.termo)
  // Cobertura e situacao vem da politica de reposicao (mesmos dados do card);
  // sem a politica carregada (erro ou modo local) esses dois filtros ficam sem efeito.
  const politicaMap =
    options.reposicaoPorMaterial instanceof Map && options.reposicaoPorMaterial.size > 0
      ? options.reposicaoPorMaterial
      : null
  const coberturaFaixa = politicaMap
    ? parseFaixaCoberturaDias(filters.coberturaDiasMin, filters.coberturaDiasMax)
    : null
  const situacaoFiltro = politicaMap ? String(filters.situacaoReposicao ?? '').trim() : ''
  const centroFiltro = (filters.centroCusto ?? '').trim().toLowerCase()
  const quantidadeMinFiltro = (filters.quantidadeMax ?? '').trim()
  const quantidadeMinNumero =
    quantidadeMinFiltro !== '' && !Number.isNaN(Number(quantidadeMinFiltro))
      ? Number(quantidadeMinFiltro)
      : null
  const estoqueMinimoFiltro = (filters.estoqueMinimo ?? '').trim()
  const estoqueMinimoNumero =
    estoqueMinimoFiltro !== '' && !Number.isNaN(Number(estoqueMinimoFiltro))
      ? Number(estoqueMinimoFiltro)
      : null
  const aplicarEstoqueMinimo = estoqueMinimoNumero !== null
  const apenasAlertas = Boolean(filters.apenasAlertas)
  const apenasSaidas = Boolean(filters.apenasSaidas)
  const apenasZerado = Boolean(filters.apenasZerado)

  return itens.filter((item) => {
    if (centroFiltro) {
      const centros = Array.isArray(item.centrosCusto) ? item.centrosCusto : []
      const possuiCentro = centros.some((centro) => centro.toLowerCase() === centroFiltro)
      if (!possuiCentro) {
        return false
      }
    }

    if (aplicarEstoqueMinimo) {
      const minimoConfigurado = Number(item.estoqueMinimo ?? 0)
      if (Number.isNaN(minimoConfigurado) || minimoConfigurado < estoqueMinimoNumero) {
        return false
      }
    }

    if (quantidadeMinNumero !== null) {
      const quantidade = Number(item.quantidade ?? item.estoqueAtual ?? 0)
      if (!Number.isNaN(quantidade) && quantidade < quantidadeMinNumero) {
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

    if (apenasZerado) {
      const quantidade = Number(item.quantidade ?? item.estoqueAtual ?? 0)
      if (Number.isNaN(quantidade) || quantidade !== 0) {
        return false
      }
    }

    if (coberturaFaixa || situacaoFiltro) {
      const politica = politicaMap.get(String(item.materialId ?? ''))
      if (!politica) {
        return false
      }
      if (situacaoFiltro && politica.situacao !== situacaoFiltro) {
        return false
      }
      if (coberturaFaixa) {
        // "Nao calculavel" (null) nunca vira zero: fica fora de qualquer faixa.
        const dias = coberturaEmDias(politica.cobertura_atual_meses)
        if (dias === null) {
          return false
        }
        if (coberturaFaixa.min !== null && dias < coberturaFaixa.min) {
          return false
        }
        if (coberturaFaixa.max !== null && dias > coberturaFaixa.max) {
          return false
        }
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
  let clean = text.replace(/"/g, '""').replace(/\r?\n/g, ' ').trim()
  // Neutraliza formula injection (=, +, -, @) sem afetar numeros negativos.
  if (/^[=+\-@\t]/.test(clean) && !/^-?\d+([.,]\d+)?$/.test(clean)) {
    clean = `'${clean}`
  }
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

// null da politica vira texto explicito, nunca zero.
const formatCsvPolitica = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'nao calculavel'
  }
  return formatCsvNumber(value)
}

export const buildEstoqueCsv = (itens = [], reposicaoPorMaterial = null) => {
  const politicaMap = reposicaoPorMaterial instanceof Map ? reposicaoPorMaterial : new Map()
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
    'Mínimo cadastrado',
    'Mínimo sugerido',
    'Mínimo efetivo',
    'Máximo efetivo',
    'Fonte da regra',
    'Base do cálculo',
    'Consumo médio mensal',
    'Cobertura (meses)',
    'Situação da reposição',
    'Déficit',
    'Valor unitário',
    'Valor total',
    'Valor para reposição',
    'Última atualização',
    'Última saída (data)',
  ]

  const rows = (Array.isArray(itens) ? itens : []).map((item) => {
    const ultimaSaidaData = item?.ultimaSaida?.dataEntrega ?? null
    const politica = politicaMap.get(String(item?.materialId ?? '')) || null
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
      politica ? formatCsvPolitica(politica.minimo_automatico) : 'indisponivel',
      politica ? formatCsvPolitica(politica.minimo_efetivo) : 'indisponivel',
      politica ? formatCsvPolitica(politica.maximo_efetivo) : 'indisponivel',
      politica ? formatFonteRegra(politica.fonte_regra) : '',
      politica ? formatBaseCalculo(politica.base_calculo) : '',
      politica ? formatCsvPolitica(politica.consumo_medio_mensal) : 'indisponivel',
      politica ? formatCsvPolitica(politica.cobertura_atual_meses) : 'indisponivel',
      politica ? formatSituacaoReposicao(politica.situacao) : '',
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
  const csvContent = buildEstoqueCsv(itens, options.reposicaoPorMaterial)
  // BOM para o Excel abrir acentos corretamente.
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
