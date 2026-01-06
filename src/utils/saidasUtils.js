// Defaults de formulário e filtros
export const initialSaidaForm = {
  pessoaId: '',
  materialId: '',
  quantidade: '',
  centroEstoqueId: '',
  centroEstoque: '',
  centroCusto: '',
  centroCustoId: '',
  centroServico: '',
  centroServicoId: '',
  dataEntrega: '',
}

export const initialSaidaFilters = {
  termo: '',
  registradoPor: '',
  centroCusto: '',
  centroServico: '',
  status: '',
  dataInicio: '',
  dataFim: '',
}

// Limites de busca e debounce
export const MATERIAL_SEARCH_MIN_CHARS = 2
export const MATERIAL_SEARCH_MAX_RESULTS = 10
export const MATERIAL_SEARCH_DEBOUNCE_MS = 250
export const PESSOA_SEARCH_MIN_CHARS = 1
export const PESSOA_SEARCH_MAX_RESULTS = 10
export const PESSOA_SEARCH_DEBOUNCE_MS = 250

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

export const normalizeSearchValue = (value) => {
  if (value === undefined || value === null) return ''
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export const materialMatchesTerm = (material, termoNormalizado) => {
  if (!termoNormalizado) return true
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
  return campos.map(normalizeSearchValue).some((campo) => campo.includes(termoNormalizado))
}

export const pessoaMatchesTerm = (pessoa, termoNormalizado) => {
  if (!termoNormalizado) return true
  const campos = [pessoa?.nome, pessoa?.matricula, pessoa?.centroServico, pessoa?.local, pessoa?.setor, pessoa?.cargo]
  return campos.map(normalizeSearchValue).some((campo) => campo.includes(termoNormalizado))
}

export const formatMaterialSummary = (material) => {
  if (!material) return ''
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
    material.fabricanteNome || (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : '') || ''
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set()
  const partes = resumo.filter((parte) => {
    const texto = (parte || '').toString().trim()
    if (!texto) return false
    const chave = texto.toLowerCase()
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
  return partes.join(' | ')
}

export const formatPessoaSummary = (pessoa) => {
  if (!pessoa) return ''
  const nome = (pessoa.nome || '').trim()
  const matricula = (pessoa.matricula || '').trim()
  const cargo = (pessoa.cargo || '').trim()
  if (nome && matricula) {
    return cargo ? `${nome} (${matricula}) - ${cargo}` : `${nome} (${matricula})`
  }
  return nome || matricula
}

export const formatPessoaDetail = (pessoa) => {
  if (!pessoa) return ''
  return pessoa.cargo ? pessoa.cargo : ''
}

export const mergePessoasList = (base = [], extras = []) => {
  const mapa = new Map()
  ;(Array.isArray(base) ? base : []).forEach((item) => {
    if (item?.id) {
      mapa.set(item.id, item)
    }
  })
  ;(Array.isArray(extras) ? extras : []).forEach((item) => {
    if (item?.id) {
      mapa.set(item.id, item)
    }
  })
  return Array.from(mapa.values())
}

export const buildSaidasQuery = (filters) => {
  const query = {}
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) query.centroCusto = centroCusto
  const centroServico = filters.centroServico?.trim()
  if (centroServico) query.centroServico = centroServico
  const registradoPor = filters.registradoPor?.trim()
  if (registradoPor) query.registradoPor = registradoPor
  const status = filters.status?.trim()
  if (status) query.status = status
  if (filters.dataInicio) query.dataInicio = filters.dataInicio
  if (filters.dataFim) query.dataFim = filters.dataFim
  const termo = filters.termo?.trim()
  if (termo) query.termo = termo
  return query
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))

export const formatDisplayDateTime = (value) => {
  if (!value) return 'Nao informado'
  const raw = typeof value === 'string' ? value.trim() : value
  if (!raw) return 'Nao informado'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return 'Nao informado'

  // Valores de data apenas (ex.: YYYY-MM-DD ou meia noite UTC) nao devem perder 1 dia por causa do fuso.
  const isDateOnlyValue =
    typeof raw === 'string' &&
    (/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
      /^\d{4}-\d{2}-\d{2}[T\s]00:00:00(?:\.\d+)?(?:Z|[+-]00:?00)?$/.test(raw))

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone: isDateOnlyValue ? 'UTC' : timeZone,
  })
}

export const formatDisplayDate = (value) => {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return date.toLocaleDateString('pt-BR', { timeZone })
}

export const formatDateToInput = (value) => {
  if (!value) return ''
  // Se já vier no formato YYYY-MM-DD, devolve direto
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // Corrige o fuso para não somar/subtrair dia no input type="date"
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}
