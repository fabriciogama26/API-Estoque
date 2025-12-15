export const MATERIAL_SEARCH_MIN_CHARS = 2
export const MATERIAL_SEARCH_MAX_RESULTS = 10
export const MATERIAL_SEARCH_DEBOUNCE_MS = 250
export const STATUS_CANCELADO_NOME = 'CANCELADO'

export const initialEntradaForm = {
  materialId: '',
  quantidade: '',
  centroCusto: '',
  dataEntrada: '',
}

export const initialEntradaFilters = {
  termo: '',
  registradoPor: '',
  centroCusto: '',
  dataInicio: '',
  dataFim: '',
  status: '',
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

export const normalizeSearchValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export const formatDateToInput = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

export const formatDisplayDate = (value) => {
  if (!value) {
    return 'Nao informado'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado'
  }
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export const materialMatchesTerm = (material, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    material?.nome,
    material?.nomeItemRelacionado,
    material?.materialItemNome,
    material?.grupoMaterial,
    material?.grupoMaterialNome,
    material?.numeroCalcado,
    material?.numeroVestimenta,
    material?.numeroEspecifico,
    material?.fabricante,
    material?.fabricanteNome,
    material?.corMaterial,
    material?.coresTexto,
    material?.ca,
    material?.id,
  ]
  return campos
    .map((campo) => normalizeSearchValue(campo))
    .some((campo) => campo.includes(termoNormalizado))
}

export const formatMaterialSummary = (material) => {
  if (!material) {
    return ''
  }
  const nome =
    [material.materialItemNome, material.nome, material.nomeId, material.id].find(
      (valor) => valor && !isLikelyUuid(valor),
    ) || ''
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ''
  const detalheCandidates = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes[0] : '',
  ]
  const detalhe = detalheCandidates.find((valor) => valor && !isLikelyUuid(valor)) || ''
  const corDescricao =
    material.coresTexto ||
    material.corMaterial ||
    (Array.isArray(material.coresNomes) ? material.coresNomes.join(', ') : '')
  const caracteristicaDescricao =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes) ? material.caracteristicasNomes.join(', ') : '')
  const fabricante =
    material.fabricanteNome ||
    (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : '') ||
    ''
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set()
  const partes = resumo.filter((parte) => {
    const texto = (parte || '').toString().trim()
    if (!texto) {
      return false
    }
    if (vistos.has(texto.toLowerCase())) {
      return false
    }
    vistos.add(texto.toLowerCase())
    return true
  })
  return partes.join(' | ')
}

export const normalizeCentroCustoOptions = (lista) => {
  const mapa = new Map()
  ;(Array.isArray(lista) ? lista : []).forEach((item, index) => {
    const rawNome = typeof item === 'string' ? item : item?.nome
    const displayName = (rawNome ?? '').toString().trim()
    if (!displayName) {
      return
    }
    const id = item?.id ?? displayName
    const chave = item?.id ?? normalizeSearchValue(displayName)
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: id || `centro-${index}`,
        nome: displayName,
      })
    }
  })
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const buildEntradasQuery = (filters) => {
  const query = {}
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
  }
  const registradoPor = filters.registradoPor?.trim()
  if (registradoPor) {
    query.registradoPor = registradoPor
  }
  const status = filters.status?.trim()
  if (status) {
    query.status = status
  }
  if (filters.dataInicio) {
    query.dataInicio = filters.dataInicio
  }
  if (filters.dataFim) {
    query.dataFim = filters.dataFim
  }
  const termo = filters.termo?.trim()
  if (termo) {
    query.termo = termo
  }
  return query
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
