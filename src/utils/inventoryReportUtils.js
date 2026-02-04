import {
  formatEstoqueMaterialLabel,
  resolveFabricanteDisplay,
  resolveCentroServicoDisplay,
  resolveSetorDisplay,
  resolvePessoaDisplay,
  resolveMaterialNumeroTamanho,
  resolveMaterialDescricaoCompleta,
} from './dashboardEstoqueUtils.js'

const DEFAULT_LIMIT_A = 80
const DEFAULT_LIMIT_B = 95

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const normalizeParetoKey = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim().toLowerCase()
}

const consolidateByMaterialId = (items = []) => {
  const mapa = new Map()
  items.forEach((item) => {
    const key =
      normalizeParetoKey(item?.materialIdDisplay) ||
      normalizeParetoKey(item?.materialId) ||
      normalizeParetoKey(item?.id) ||
      normalizeParetoKey(item?.nome)
    const finalKey = key || `__item_${mapa.size + 1}`
    const atual = mapa.get(finalKey)
    if (!atual) {
      mapa.set(finalKey, { ...item })
      return
    }
    const merged = { ...atual }
    merged.quantidade = toNumber(atual?.quantidade) + toNumber(item?.quantidade)
    merged.valorTotal = Number((toNumber(atual?.valorTotal) + toNumber(item?.valorTotal)).toFixed(2))
    merged.score = toNumber(atual?.score) + toNumber(item?.score)
    if (!merged.descricaoCompleta && item?.descricaoCompleta) merged.descricaoCompleta = item.descricaoCompleta
    if (!merged.descricao && item?.descricao) merged.descricao = item.descricao
    if (!merged.nome && item?.nome) merged.nome = item.nome
    if (!merged.materialId && item?.materialId) merged.materialId = item.materialId
    if (!merged.materialIdDisplay && item?.materialIdDisplay) merged.materialIdDisplay = item.materialIdDisplay
    mapa.set(finalKey, merged)
  })
  return Array.from(mapa.values())
}

const resolveParetoSortKey = (item = {}) => {
  const candidatos = [item.materialIdDisplay, item.materialId, item.id, item.nome]
  for (const candidato of candidatos) {
    const key = normalizeParetoKey(candidato)
    if (key) {
      return key
    }
  }
  return ''
}

const mergeParetoItems = (items = [], valueKey) => {
  const safeKey = valueKey || 'valor'
  const mapa = new Map()
  const mapaId = new Map()
  const mapaNome = new Map()

  items.forEach((item, index) => {
    const idKey =
      normalizeParetoKey(item?.materialIdDisplay) ||
      normalizeParetoKey(item?.materialId) ||
      normalizeParetoKey(item?.id)
    const nomeKey = normalizeParetoKey(item?.descricaoCompleta) || normalizeParetoKey(item?.descricao) || normalizeParetoKey(item?.nome)
    let key = ''

    if (idKey && mapaId.has(idKey)) {
      key = mapaId.get(idKey)
    } else if (nomeKey && mapaNome.has(nomeKey)) {
      key = mapaNome.get(nomeKey)
    } else {
      key = idKey || nomeKey || `__idx_${index}`
      mapa.set(key, { ...item })
      if (idKey) mapaId.set(idKey, key)
      if (nomeKey) mapaNome.set(nomeKey, key)
      return
    }

    const atual = mapa.get(key)
    if (!atual) {
      mapa.set(key, { ...item })
      if (idKey) mapaId.set(idKey, key)
      if (nomeKey) mapaNome.set(nomeKey, key)
      return
    }

    const merged = { ...atual }
    merged[safeKey] = toNumber(atual?.[safeKey]) + toNumber(item?.[safeKey])
    merged.quantidade = toNumber(atual?.quantidade) + toNumber(item?.quantidade)
    merged.valorTotal = Number((toNumber(atual?.valorTotal) + toNumber(item?.valorTotal)).toFixed(2))
    merged.score = toNumber(atual?.score) + toNumber(item?.score)

    if (!merged.descricaoCompleta && item?.descricaoCompleta) merged.descricaoCompleta = item.descricaoCompleta
    if (!merged.descricao && item?.descricao) merged.descricao = item.descricao
    if (!merged.nome && item?.nome) merged.nome = item.nome
    if (!merged.materialId && item?.materialId) merged.materialId = item.materialId
    if (!merged.materialIdDisplay && item?.materialIdDisplay) merged.materialIdDisplay = item.materialIdDisplay

    mapa.set(key, merged)
    if (idKey) mapaId.set(idKey, key)
    if (nomeKey) mapaNome.set(nomeKey, key)
  })

  return Array.from(mapa.values())
}

export const DEFAULT_RISK_WEIGHTS = {
  estoqueBaixo: 2,
  saidaAlta: 2,
  saidaExtrema: 1,
  giroAlto: 1,
  tipoCritico: 1,
  rupturaPressao: 2,
}

export const DEFAULT_RISK_THRESHOLDS = {
  critico: 5,
  atencao: 3,
}

export const DEFAULT_VARIACAO_RELEVANTE = 0.1

export function computePercentile(values = [], percentile = 0.8) {
  const list = values
    .map((value) => toNumber(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
  if (!list.length) {
    return 0
  }
  const index = clamp(Math.ceil(percentile * list.length) - 1, 0, list.length - 1)
  return list[index]
}

export function buildParetoList(items = [], valueKey, { limitA = DEFAULT_LIMIT_A, limitB = DEFAULT_LIMIT_B } = {}) {
  const safeKey = valueKey || 'valor'
  const mergedItems = mergeParetoItems(items, safeKey)
  const sorted = [...mergedItems].sort((a, b) => {
    const diff = toNumber(b?.[safeKey]) - toNumber(a?.[safeKey])
    if (diff !== 0) {
      return diff
    }
    const keyA = resolveParetoSortKey(a)
    const keyB = resolveParetoSortKey(b)
    if (keyA && keyB) {
      return keyA.localeCompare(keyB)
    }
    return keyA ? -1 : keyB ? 1 : 0
  })
  const total = sorted.reduce((acc, item) => acc + toNumber(item?.[safeKey]), 0)
  let acumulado = 0
  const limitAValue = toNumber(limitA)
  const limitBValue = toNumber(limitB)

  const lista = sorted.map((item) => {
    const valor = toNumber(item?.[safeKey])
    acumulado += valor
    const percentual = total > 0 ? (valor / total) * 100 : 0
    const percentualAcumulado = total > 0 ? (acumulado / total) * 100 : 0
    let classe = 'C'
    if (percentualAcumulado <= limitAValue) {
      classe = 'A'
    } else if (percentualAcumulado <= limitBValue) {
      classe = 'B'
    }

    return {
      ...item,
      percentual,
      percentualAcumulado,
      classe,
    }
  })

  return {
    total,
    lista,
  }
}

function resolveMaterialLabel(material = {}) {
  return formatEstoqueMaterialLabel(material)
}

function resolveMaterialDescricao(material = {}) {
  const base = material.resumo || [material.nome, resolveFabricanteDisplay(material)].filter(Boolean).join(' | ')
  const tamanhoNumero = resolveMaterialNumeroTamanho(material)
  return [base, tamanhoNumero, material.ca].filter(Boolean).join(' | ')
}

export function buildSaidasResumo(saidasDetalhadas = []) {
  const mapa = new Map()

  saidasDetalhadas.forEach((saida) => {
    const material = saida?.material
    if (!material) return

    const materialIdDisplay = saida?.materialId ?? material.id ?? null
    const chaveNormalizada =
      normalizeParetoKey(saida?.materialId) ||
      normalizeParetoKey(material.id) ||
      normalizeParetoKey(material.nome) ||
      normalizeParetoKey(resolveMaterialLabel(material))
    const chave =
      chaveNormalizada || saida?.materialId || material.id || material.nome || resolveMaterialLabel(material)
    const atual = mapa.get(chave) || {
      materialId: materialIdDisplay || chave,
      materialIdDisplay,
      nome: resolveMaterialLabel(material),
      descricao: resolveMaterialDescricao(material),
      descricaoCompleta: resolveMaterialDescricaoCompleta(material),
      grupoMaterial: material.grupoMaterialNome || material.grupoMaterial || '',
      valorUnitario: toNumber(material.valorUnitario),
      validadeDias: toNumber(material.validadeDias),
      estoqueMinimo: toNumber(material.estoqueMinimo),
      quantidade: 0,
      valorTotal: 0,
    }

    const quantidade = toNumber(saida?.quantidade)
    atual.quantidade += quantidade
    atual.valorTotal = Number((atual.valorTotal + quantidade * atual.valorUnitario).toFixed(2))

    mapa.set(chave, atual)
  })

  const lista = Array.from(mapa.values()).filter((item) => item.quantidade > 0)
  return consolidateByMaterialId(lista)
}

export function buildRiscoOperacional({
  saidasResumo = [],
  estoqueAtual = [],
  diasPeriodo = 0,
  weights = DEFAULT_RISK_WEIGHTS,
  thresholds = DEFAULT_RISK_THRESHOLDS,
  p80Quantidade = 0,
  p90Quantidade = 0,
  p80Giro = 0,
} = {}) {
  const estoqueMap = new Map((estoqueAtual || []).map((item) => [item.materialId, item]))
  const dias = Math.max(1, toNumber(diasPeriodo))

  return saidasResumo.map((item) => {
    const estoqueItem = estoqueMap.get(item.materialId) || {}
    const estoqueAtualItem = toNumber(estoqueItem.estoqueAtual ?? estoqueItem.quantidade)
    const estoqueMinimo = toNumber(item.estoqueMinimo ?? estoqueItem.estoqueMinimo)
    const quantidade = toNumber(item.quantidade)
    const giroDiario = quantidade / dias
    const validadeDias = toNumber(item.validadeDias)
    const pressaoVidaUtil = validadeDias > 0 ? (quantidade * validadeDias) / dias : 0
    const grupoMaterial = (item.grupoMaterial || '').toString().toLowerCase()
    const tipoCritico = grupoMaterial.includes('epi') || grupoMaterial.includes('epc')

    const estoqueBaixo = estoqueAtualItem < estoqueMinimo
    const saidaAlta = quantidade >= p80Quantidade && p80Quantidade > 0
    const saidaExtrema = quantidade >= p90Quantidade && p90Quantidade > 0
    const giroAlto = giroDiario >= p80Giro && p80Giro > 0
    const rupturaPressao = pressaoVidaUtil > estoqueAtualItem

    const score =
      (estoqueBaixo ? weights.estoqueBaixo : 0) +
      (saidaAlta ? weights.saidaAlta : 0) +
      (saidaExtrema ? weights.saidaExtrema : 0) +
      (giroAlto ? weights.giroAlto : 0) +
      (tipoCritico ? weights.tipoCritico : 0) +
      (rupturaPressao ? weights.rupturaPressao : 0)

    let classeRisco = 'C'
    if (estoqueBaixo && giroAlto) {
      classeRisco = 'A'
    } else if (estoqueBaixo) {
      classeRisco = 'B'
    }

    return {
      ...item,
      estoqueAtual: estoqueAtualItem,
      estoqueMinimo,
      giroDiario,
      pressaoVidaUtil,
      tipoCritico,
      flags: {
        estoqueBaixo,
        saidaAlta,
        saidaExtrema,
        giroAlto,
        rupturaPressao,
        tipoCritico,
      },
      score,
      classe: classeRisco,
      classeRisco,
    }
  })
}

export function buildResumoPorCentroServico(saidas = []) {
  const mapa = new Map()
  saidas.forEach((saida) => {
    const nome = resolveCentroServicoDisplay(saida)
    const chave = saida.centroServicoId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += toNumber(saida.quantidade)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export function buildResumoPorSetor(saidas = []) {
  const mapa = new Map()
  saidas.forEach((saida) => {
    const nome = resolveSetorDisplay(saida)
    const chave = saida.setorId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += toNumber(saida.quantidade)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export function buildResumoPorPessoa(saidas = []) {
  const mapa = new Map()
  saidas.forEach((saida) => {
    const nome = resolvePessoaDisplay(saida)
    const chave = saida.pessoaId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += toNumber(saida.quantidade)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export function buildResumoPorCategoria(saidasResumo = []) {
  const mapa = new Map()
  saidasResumo.forEach((item) => {
    const categoria = item.grupoMaterial || 'Nao classificado'
    const atual = mapa.get(categoria) || {
      nome: categoria,
      quantidade: 0,
      valorTotal: 0,
    }
    atual.quantidade += toNumber(item.quantidade)
    atual.valorTotal = Number((atual.valorTotal + toNumber(item.valorTotal)).toFixed(2))
    mapa.set(categoria, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.valorTotal - a.valorTotal)
}

export function buildResumoPorCentroCusto(saidas = []) {
  const mapa = new Map()
  saidas.forEach((saida) => {
    const nome = (saida.centroCusto || '').toString().trim() || 'Nao informado'
    const chave = saida.centroCustoId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += toNumber(saida.quantidade)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export function formatPercent(value, digits = 1) {
  const pct = toNumber(value)
  return `${pct.toFixed(digits)}%`
}

export function formatNumber(value, digits = 0) {
  const num = toNumber(value)
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatCurrency(value) {
  const num = toNumber(value)
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  })
}
