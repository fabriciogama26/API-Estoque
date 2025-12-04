// Utilitarios puros para Estoque

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))

export const formatInteger = (value) => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))

export const normalizeTerm = (termo) => (termo ? termo.trim().toLowerCase() : '')

export const formatDateTimeValue = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
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
  ]
  if (Array.isArray(material.centrosCusto)) {
    camposTexto.push(material.centrosCusto.join(' '))
  }
  return camposTexto.map((valor) => (valor ? String(valor).toLowerCase() : '')).some((texto) => texto.includes(termoNormalizado))
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
      if (Number.isNaN(minimoConfigurado) || minimoConfigurado !== estoqueMinimoNumero) {
        return false
      }
    }

    if (apenasAlertas && !item.alerta) {
      return false
    }

    return matchesTerm(item, termoNormalizado)
  })
}
