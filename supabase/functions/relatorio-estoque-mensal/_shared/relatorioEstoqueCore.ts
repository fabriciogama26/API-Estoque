import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const DEFAULT_MATERIAIS_VIEW = "vw_materiais_vinculos"
const REPORT_TYPE_MENSAL = "mensal"
const CENTRO_ESTOQUE_TABLE = "centros_estoque"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const materiaisView = Deno.env.get("MATERIAIS_VIEW") || DEFAULT_MATERIAIS_VIEW

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  },
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MATERIAL_RELATION_ID_KEYS = [
  "id",
  "uuid",
  "catalogoId",
  "catalogo_id",
  "caracteristicaId",
  "caracteristica_id",
  "corId",
  "cor_id",
]

const DEFAULT_RISK_WEIGHTS = {
  estoqueBaixo: 2,
  saidaAlta: 2,
  saidaExtrema: 1,
  giroAlto: 1,
  tipoCritico: 1,
  rupturaPressao: 2,
}

const DEFAULT_RISK_THRESHOLDS = {
  critico: 5,
  atencao: 3,
}

const DEFAULT_VARIACAO_RELEVANTE = 0.1

const trim = (value: unknown) => {
  if (value === undefined || value === null) {
    return ""
  }
  return String(value).trim()
}

const normalizeSearchTerm = (value: unknown) => (value ? String(value).trim().toLowerCase() : "")

const toDateOnly = (value: Date | string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split("T")[0]
}

const toStartOfMonthUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))

const toEndOfMonthUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))

const buildMonthPeriods = (startDate?: Date | null, endDate?: Date | null) => {
  const periods: Array<{ start: Date; end: Date }> = []
  if (!startDate || !endDate) {
    return periods
  }
  let cursor = toStartOfMonthUtc(startDate)
  const end = toEndOfMonthUtc(endDate)
  while (cursor <= end) {
    const start = new Date(cursor)
    const finish = toEndOfMonthUtc(cursor)
    periods.push({ start, end: finish })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return periods
}


const formatDateBr = (date: Date | string | null | undefined) => {
  if (!date) return ""
  return new Date(date).toLocaleDateString("pt-BR")
}

const formatMonthRef = (date: Date | string | null | undefined) => {
  if (!date) return ""
  const d = new Date(date)
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0")
  const ano = d.getUTCFullYear()
  return `${mes}/${ano}`
}


const calcularVariacaoPercentual = (atual: unknown, anterior: unknown) => {
  const atualNum = Number(atual ?? 0)
  const anteriorNum = Number(anterior ?? 0)
  if (anteriorNum === 0) {
    return atualNum === 0 ? 0 : 100
  }
  return Number((((atualNum - anteriorNum) / anteriorNum) * 100).toFixed(1))
}

const interpretarVariacao = (variacao: number, positivo: string, negativo: string) => {
  if (variacao > DEFAULT_VARIACAO_RELEVANTE * 100) return positivo
  if (variacao < -DEFAULT_VARIACAO_RELEVANTE * 100) return negativo
  return "Sem variacao relevante."
}

const calcularDiasPeriodo = (range?: { start?: Date; end?: Date }) => {
  if (!range?.start || !range?.end) return 0
  const diff = range.end.getTime() - range.start.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const normalizeText = (value: unknown) => {
  if (value === undefined || value === null) {
    return ""
  }
  return String(value).trim()
}

const isRegistroCancelado = (registro: any = {}) => {
  const statusTexto = (registro.statusNome || registro.status || "").toString().trim().toLowerCase()
  return statusTexto === "cancelado"
}

const normalizeMixedArray = (value: unknown) => {
  if (value === undefined || value === null) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === "string") {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return [value]
}

const extractUuidFromCandidate = (candidate: unknown) => {
  if (!candidate) {
    return null
  }
  if (typeof candidate === "string") {
    const trimmed = candidate.trim()
    if (!trimmed) {
      return null
    }
    if (!UUID_REGEX.test(trimmed)) {
      return undefined
    }
    return trimmed
  }
  if (typeof candidate === "object") {
    for (const key of MATERIAL_RELATION_ID_KEYS) {
      const valor = (candidate as Record<string, unknown>)[key]
      if (typeof valor === "string" && UUID_REGEX.test(valor.trim())) {
        return valor.trim()
      }
    }
  }
  return null
}

const resolveCatalogoNome = (registro: Record<string, unknown>) => {
  if (!registro || typeof registro !== "object") {
    return ""
  }
  const keys = [
    "nome",
    "descricao",
    "label",
    "valor",
    "value",
    "caracteristica_material",
    "caracteristicaMaterial",
    "numero_calcado",
    "numeroCalcado",
    "medidas",
    "tamanho",
    "cor",
    "cor_material",
  ]
  for (const key of keys) {
    const valor = registro[key]
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim()
    }
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return String(valor)
    }
  }
  return ""
}

const normalizeCatalogoLista = (lista: unknown[]) => {
  const valores = new Set<string>()
  ;(lista ?? []).forEach((item) => {
    const nome = resolveCatalogoNome(item as Record<string, unknown>)
    if (nome) {
      valores.add(nome)
    }
  })
  return Array.from(valores).sort((a, b) => a.localeCompare(b))
}

const normalizeMaterialRelationItems = (value: unknown) => {
  const lista = normalizeMixedArray(value)
  const unique = new Map<string, { id: string; nome: string }>()

  lista.forEach((item) => {
    if (!item || typeof item !== "object") {
      return
    }

    const uuid = extractUuidFromCandidate(item)
    if (!uuid || uuid === undefined) {
      return
    }

    const nome = resolveCatalogoNome(item as Record<string, unknown>)
    if (!nome) {
      return
    }

    if (!unique.has(uuid)) {
      unique.set(uuid, { id: uuid, nome })
    }
  })

  return Array.from(unique.values())
}

const buildCatalogoTexto = (lista: unknown[]) => normalizeCatalogoLista(lista).join("; ")

const getFirstAvailable = (obj: unknown, keys: string[]) => {
  if (!obj || typeof obj !== "object") {
    return undefined
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key]
      if (value !== undefined && value !== null) {
        return value
      }
    }
  }
  return undefined
}

const MATERIAL_CARACTERISTICAS_KEYS = [
  "caracteristicas",
  "caracteristicasEpi",
  "caracteristicas_epi",
  "caracteristicas_vinculos",
  "caracteristica_vinculos",
  "caracteristicasAgg",
  "caracteristicas_agg",
  "caracteristicasList",
  "caracteristicas_list",
]

const MATERIAL_CORES_KEYS = [
  "cores",
  "cores_vinculos",
  "coresAgg",
  "cores_agg",
  "coresRelacionadas",
  "cores_relacionadas",
  "coresList",
  "cores_list",
]

const MATERIAL_CARACTERISTICAS_TEXTO_KEYS = [
  "caracteristicasTexto",
  "caracteristicas_texto",
  "caracteristicaEpi",
  "caracteristica_epi",
]

const MATERIAL_CORES_TEXTO_KEYS = [
  "coresTexto",
  "cores_texto",
  "corMaterial",
  "cor_material",
]

const mapMaterialRecord = (record: Record<string, unknown>) => {
  if (!record || typeof record !== "object") {
    return record
  }

  const caracteristicasFonte = getFirstAvailable(record, MATERIAL_CARACTERISTICAS_KEYS)
  const coresFonte = getFirstAvailable(record, MATERIAL_CORES_KEYS)

  const caracteristicas = normalizeMaterialRelationItems(caracteristicasFonte)
  const cores = normalizeMaterialRelationItems(coresFonte)

  const caracteristicasTextoBase = getFirstAvailable(record, MATERIAL_CARACTERISTICAS_TEXTO_KEYS)
  const coresTextoBase = getFirstAvailable(record, MATERIAL_CORES_TEXTO_KEYS)

  const caracteristicasTexto =
    (typeof caracteristicasTextoBase === "string" ? caracteristicasTextoBase.trim() : "") ||
    buildCatalogoTexto(caracteristicas)

  const coresTexto =
    (typeof coresTextoBase === "string" ? coresTextoBase.trim() : "") || buildCatalogoTexto(cores)

  const corMaterial = coresTexto || ""
  const caracteristicaEpi = caracteristicasTexto || ""

  const mapped: Record<string, unknown> = {
    ...record,
    caracteristicas,
    cores,
    caracteristicasTexto,
    coresTexto,
    corMaterial,
    caracteristicaEpi,
  }

  mapped.cor_material = corMaterial
  mapped.caracteristica_epi = caracteristicaEpi

  return mapped
}

const mapEntradaRecord = (record: Record<string, unknown>) => {
  if (!record || typeof record !== "object") {
    return record
  }
  const centroEstoqueValor =
    (record as any).centroEstoque ?? (record as any).centro_estoque ?? (record as any).centroCusto ?? null
  const centroCustoRaw = (record as any).centroCusto ?? ""
  const centroCustoId =
    typeof centroEstoqueValor === "string" && UUID_REGEX.test(String(centroEstoqueValor).trim())
      ? String(centroEstoqueValor).trim()
      : null
  const centroCustoNome =
    trim(
      (record as any).centroCustoNome ??
        (record as any).centro_estoque_nome ??
        (record as any).centroEstoqueNome ??
        "",
    ) || (centroCustoId ? "" : trim(centroCustoRaw))
  const usuarioRaw = (record as any).usuarioResponsavel ?? (record as any).usuario_responsavel ?? ""
  const usuarioId = typeof usuarioRaw === "string" && UUID_REGEX.test(usuarioRaw.trim())
    ? usuarioRaw.trim()
    : null
  const usuarioTexto = trim(usuarioRaw)
  return {
    ...record,
    centroCustoId: centroCustoId ?? null,
    centroCusto: centroCustoNome || centroCustoRaw || "",
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? "" : usuarioTexto,
  }
}

const mapSaidaRecord = (record: Record<string, unknown>) => {
  if (!record || typeof record !== "object") {
    return record
  }
  return {
    ...record,
    centroCusto: (record as any).centroCusto ?? "",
    centroServico: (record as any).centroServico ?? "",
  }
}

const sanitizeDisplayText = (value: unknown) => (value ? String(value).trim() : "")

const isLikelyUuid = (value: unknown) => UUID_REGEX.test(String(value || "").trim())

const resolveListText = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item === "object" && "nome" in item ? String((item as any).nome).trim() : String(item ?? "").trim()))
      .filter(Boolean)
      .join("; ")
  }
  return sanitizeDisplayText(value)
}

const resolveMaterialSizeValue = (value: unknown) => {
  const texto = sanitizeDisplayText(value)
  if (!texto || isLikelyUuid(texto)) {
    return ""
  }
  return texto
}

const resolveMaterialNumeroTamanho = (material: Record<string, unknown> = {}) => {
  const numeroCalcado =
    resolveMaterialSizeValue((material as any).numeroCalcadoNome) || resolveMaterialSizeValue((material as any).numeroCalcado)
  if (numeroCalcado) {
    return numeroCalcado
  }
  const tamanhoVestimenta =
    resolveMaterialSizeValue((material as any).numeroVestimentaNome) ||
    resolveMaterialSizeValue((material as any).numeroVestimenta)
  if (tamanhoVestimenta) {
    return tamanhoVestimenta
  }
  return resolveMaterialSizeValue((material as any).numeroEspecifico)
}

const resolveFabricanteDisplay = (material: Record<string, unknown> = {}) => {
  const candidatos = [(material as any).fabricanteNome, (material as any).fabricante]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return "Nao informado"
}

const resolveMaterialDescricaoCompleta = (material: Record<string, unknown> = {}) => {
  if (!material) {
    return ""
  }
  const item = sanitizeDisplayText((material as any).materialItemNome || (material as any).nome)
  const grupo = sanitizeDisplayText((material as any).grupoMaterialNome || (material as any).grupoMaterial)
  const tamanhoNumero = resolveMaterialNumeroTamanho(material)
  const ca = sanitizeDisplayText((material as any).ca)
  const caracteristicas = resolveListText((material as any).caracteristicasTexto || (material as any).caracteristicaEpi)
  const cor = resolveListText((material as any).corMaterial || (material as any).coresTexto || (material as any).cores)
  const fabricante = resolveFabricanteDisplay(material)

  return [item, grupo, tamanhoNumero, ca, caracteristicas, cor, fabricante].filter(Boolean).join(" | ")
}

const resolveCentroServicoDisplay = (saida: Record<string, unknown> = {}) => {
  const candidatos = [
    (saida as any).centroServicoNome,
    (saida as any).centroServico,
    (saida as any).setorNome,
    (saida as any).setor,
    (saida as any).local,
    (saida as any).pessoa?.centroServico,
    (saida as any).pessoa?.setor,
    (saida as any).pessoa?.local,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return "Nao informado"
}

const resolveSetorDisplay = (saida: Record<string, unknown> = {}) => {
  const candidatos = [
    (saida as any).setorNome,
    (saida as any).setor,
    (saida as any).pessoa?.setor,
    (saida as any).pessoa?.centroServico,
    (saida as any).pessoa?.local,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return "Nao informado"
}

const resolvePessoaDisplay = (saida: Record<string, unknown> = {}) => {
  const candidatos = [(saida as any).pessoa?.nome, (saida as any).pessoaNome, (saida as any).nome]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto) {
      return texto
    }
  }
  return "Nao informado"
}

const formatEstoqueMaterialLabel = (item: Record<string, unknown> = {}) => {
  const tamanhoNumero = resolveMaterialNumeroTamanho(item)
  const ca = sanitizeDisplayText((item as any).ca)
  const base = (item as any).resumo || [item.nome, resolveFabricanteDisplay(item), tamanhoNumero, ca].filter(Boolean).join(" | ")
  const partes = base.split("|").map((parte) => sanitizeDisplayText(parte)).filter(Boolean)
  const compacto = partes.slice(0, 4).join(" | ")
  if (compacto.length <= 55) {
    return compacto
  }
  return `${compacto.slice(0, 52)}...`
}

const formatPercent = (value: unknown, digits = 1) => {
  const pct = Number(value ?? 0)
  return `${pct.toFixed(digits)}%`
}

const formatNumber = (value: unknown, digits = 0) => {
  const num = Number(value ?? 0)
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const formatCurrency = (value: unknown) => {
  const num = Number(value ?? 0)
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  })
}

const normalizeParetoKey = (value: unknown) => {
  if (value === null || value === undefined) {
    return ""
  }
  return String(value).trim().toLowerCase()
}

const consolidateByMaterialId = (items: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, Record<string, unknown>>()
  items.forEach((item) => {
    const key =
      normalizeParetoKey((item as any)?.materialIdDisplay) ||
      normalizeParetoKey((item as any)?.materialId) ||
      normalizeParetoKey((item as any)?.id) ||
      normalizeParetoKey((item as any)?.nome)
    const finalKey = key || `__item_${mapa.size + 1}`
    const atual = mapa.get(finalKey)
    if (!atual) {
      mapa.set(finalKey, { ...item })
      return
    }
    const merged = { ...atual }
    merged.quantidade = Number((atual as any)?.quantidade ?? 0) + Number((item as any)?.quantidade ?? 0)
    merged.valorTotal = Number((Number((atual as any)?.valorTotal ?? 0) + Number((item as any)?.valorTotal ?? 0)).toFixed(2))
    merged.score = Number((atual as any)?.score ?? 0) + Number((item as any)?.score ?? 0)
    if (!(merged as any).descricaoCompleta && (item as any)?.descricaoCompleta) merged.descricaoCompleta = (item as any).descricaoCompleta
    if (!(merged as any).descricao && (item as any)?.descricao) merged.descricao = (item as any).descricao
    if (!(merged as any).nome && (item as any)?.nome) merged.nome = (item as any).nome
    if (!(merged as any).materialId && (item as any)?.materialId) merged.materialId = (item as any).materialId
    if (!(merged as any).materialIdDisplay && (item as any)?.materialIdDisplay) merged.materialIdDisplay = (item as any).materialIdDisplay
    mapa.set(finalKey, merged)
  })
  return Array.from(mapa.values())
}

const resolveParetoSortKey = (item: Record<string, unknown> = {}) => {
  const candidatos = [(item as any).materialIdDisplay, (item as any).materialId, (item as any).id, (item as any).nome]
  for (const candidato of candidatos) {
    const key = normalizeParetoKey(candidato)
    if (key) {
      return key
    }
  }
  return ""
}

const mergeParetoItems = (items: Record<string, unknown>[] = [], valueKey?: string) => {
  const safeKey = valueKey || "valor"
  const mapa = new Map<string, Record<string, unknown>>()
  const mapaId = new Map<string, string>()
  const mapaNome = new Map<string, string>()

  items.forEach((item, index) => {
    const idKey =
      normalizeParetoKey((item as any)?.materialIdDisplay) ||
      normalizeParetoKey((item as any)?.materialId) ||
      normalizeParetoKey((item as any)?.id)
    const nomeKey = normalizeParetoKey((item as any)?.descricaoCompleta) || normalizeParetoKey((item as any)?.descricao) || normalizeParetoKey((item as any)?.nome)
    let key = ""

    if (idKey && mapaId.has(idKey)) {
      key = mapaId.get(idKey) as string
    } else if (nomeKey && mapaNome.has(nomeKey)) {
      key = mapaNome.get(nomeKey) as string
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

    const merged: Record<string, unknown> = { ...atual }
    merged[safeKey] = Number((atual as any)?.[safeKey] ?? 0) + Number((item as any)?.[safeKey] ?? 0)
    merged.quantidade = Number((atual as any)?.quantidade ?? 0) + Number((item as any)?.quantidade ?? 0)
    merged.valorTotal = Number((Number((atual as any)?.valorTotal ?? 0) + Number((item as any)?.valorTotal ?? 0)).toFixed(2))
    merged.score = Number((atual as any)?.score ?? 0) + Number((item as any)?.score ?? 0)

    if (!(merged as any).descricaoCompleta && (item as any)?.descricaoCompleta) merged.descricaoCompleta = (item as any).descricaoCompleta
    if (!(merged as any).descricao && (item as any)?.descricao) merged.descricao = (item as any).descricao
    if (!(merged as any).nome && (item as any)?.nome) merged.nome = (item as any).nome
    if (!(merged as any).materialId && (item as any)?.materialId) merged.materialId = (item as any).materialId
    if (!(merged as any).materialIdDisplay && (item as any)?.materialIdDisplay) merged.materialIdDisplay = (item as any).materialIdDisplay

    mapa.set(key, merged)
    if (idKey) mapaId.set(idKey, key)
    if (nomeKey) mapaNome.set(nomeKey, key)
  })

  return Array.from(mapa.values())
}

const computePercentile = (values: unknown[] = [], percentile = 0.8) => {
  const list = values
    .map((value) => Number(value ?? 0))
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
  if (!list.length) {
    return 0
  }
  const index = clamp(Math.ceil(percentile * list.length) - 1, 0, list.length - 1)
  return list[index]
}

const buildParetoList = (
  items: Record<string, unknown>[] = [],
  valueKey?: string,
  { limitA = 80, limitB = 95 }: { limitA?: number; limitB?: number } = {},
) => {
  const safeKey = valueKey || "valor"
  const mergedItems = mergeParetoItems(items, safeKey)
  const sorted = [...mergedItems].sort((a, b) => {
    const diff = Number((b as any)?.[safeKey] ?? 0) - Number((a as any)?.[safeKey] ?? 0)
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
  const total = sorted.reduce((acc, item) => acc + Number((item as any)?.[safeKey] ?? 0), 0)
  let acumulado = 0
  const limitAValue = Number(limitA ?? 0)
  const limitBValue = Number(limitB ?? 0)

  const lista = sorted.map((item) => {
    const valor = Number((item as any)?.[safeKey] ?? 0)
    acumulado += valor
    const percentual = total > 0 ? (valor / total) * 100 : 0
    const percentualAcumulado = total > 0 ? (acumulado / total) * 100 : 0
    let classe = "C"
    if (percentualAcumulado <= limitAValue) {
      classe = "A"
    } else if (percentualAcumulado <= limitBValue) {
      classe = "B"
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

const resolveMaterialLabel = (material: Record<string, unknown> = {}) => {
  return formatEstoqueMaterialLabel(material)
}

const resolveMaterialDescricao = (material: Record<string, unknown> = {}) => {
  const base = (material as any).resumo || [material.nome, resolveFabricanteDisplay(material)].filter(Boolean).join(" | ")
  const tamanhoNumero = resolveMaterialNumeroTamanho(material)
  return [base, tamanhoNumero, (material as any).ca].filter(Boolean).join(" | ")
}

const buildSaidasResumo = (saidasDetalhadas: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, Record<string, unknown>>()

  saidasDetalhadas.forEach((saida) => {
    const material = (saida as any)?.material
    if (!material) return

    const materialIdDisplay = (saida as any)?.materialId ?? (material as any).id ?? null
    const chaveNormalizada =
      normalizeParetoKey((saida as any)?.materialId) ||
      normalizeParetoKey((material as any).id) ||
      normalizeParetoKey((material as any).nome) ||
      normalizeParetoKey(resolveMaterialLabel(material))
    const chave =
      chaveNormalizada || (saida as any)?.materialId || (material as any).id || (material as any).nome || resolveMaterialLabel(material)
    const atual = mapa.get(chave) || {
      materialId: materialIdDisplay || chave,
      materialIdDisplay,
      nome: resolveMaterialLabel(material),
      descricao: resolveMaterialDescricao(material),
      descricaoCompleta: resolveMaterialDescricaoCompleta(material),
      grupoMaterial: (material as any).grupoMaterialNome || (material as any).grupoMaterial || "",
      valorUnitario: Number((material as any).valorUnitario ?? 0),
      validadeDias: Number((material as any).validadeDias ?? 0),
      estoqueMinimo: Number((material as any).estoqueMinimo ?? 0),
      quantidade: 0,
      valorTotal: 0,
    }

    const quantidade = Number((saida as any)?.quantidade ?? 0)
    atual.quantidade = Number((atual as any).quantidade ?? 0) + quantidade
    atual.valorTotal = Number((Number((atual as any).valorTotal ?? 0) + quantidade * Number((atual as any).valorUnitario ?? 0)).toFixed(2))

    mapa.set(chave, atual)
  })

  const lista = Array.from(mapa.values()).filter((item) => Number((item as any).quantidade ?? 0) > 0)
  return consolidateByMaterialId(lista)
}

const buildRiscoOperacional = ({
  saidasResumo = [],
  estoqueAtual = [],
  diasPeriodo = 0,
  weights = DEFAULT_RISK_WEIGHTS,
  thresholds = DEFAULT_RISK_THRESHOLDS,
  p80Quantidade = 0,
  p90Quantidade = 0,
  p80Giro = 0,
}: {
  saidasResumo?: Record<string, unknown>[]
  estoqueAtual?: Record<string, unknown>[]
  diasPeriodo?: number
  weights?: Record<string, number>
  thresholds?: Record<string, number>
  p80Quantidade?: number
  p90Quantidade?: number
  p80Giro?: number
} = {}) => {
  const estoqueMap = new Map((estoqueAtual || []).map((item) => [(item as any).materialId, item]))
  const dias = Math.max(1, Number(diasPeriodo ?? 0))

  return saidasResumo.map((item) => {
    const estoqueItem = estoqueMap.get((item as any).materialId) || {}
    const estoqueAtualItem = Number((estoqueItem as any).estoqueAtual ?? (estoqueItem as any).quantidade ?? 0)
    const estoqueMinimo = Number((item as any).estoqueMinimo ?? (estoqueItem as any).estoqueMinimo ?? 0)
    const quantidade = Number((item as any).quantidade ?? 0)
    const giroDiario = quantidade / dias
    const validadeDias = Number((item as any).validadeDias ?? 0)
    const pressaoVidaUtil = validadeDias > 0 ? (quantidade * validadeDias) / dias : 0
    const grupoMaterial = ((item as any).grupoMaterial || "").toString().toLowerCase()
    const tipoCritico = grupoMaterial.includes("epi") || grupoMaterial.includes("epc")

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

    let classeRisco = "C"
    if (estoqueBaixo && giroAlto) {
      classeRisco = "A"
    } else if (estoqueBaixo) {
      classeRisco = "B"
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

const buildResumoPorCentroServico = (saidas: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, { id: unknown; nome: string; quantidade: number }>()
  saidas.forEach((saida) => {
    const nome = resolveCentroServicoDisplay(saida)
    const chave = (saida as any).centroServicoId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += Number((saida as any).quantidade ?? 0)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

const buildResumoPorSetor = (saidas: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, { id: unknown; nome: string; quantidade: number }>()
  saidas.forEach((saida) => {
    const nome = resolveSetorDisplay(saida)
    const chave = (saida as any).setorId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += Number((saida as any).quantidade ?? 0)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

const buildResumoPorCategoria = (saidasResumo: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, { nome: string; quantidade: number; valorTotal: number }>()
  saidasResumo.forEach((item) => {
    const categoria = ((item as any).grupoMaterial || "Nao classificado") as string
    const atual = mapa.get(categoria) || {
      nome: categoria,
      quantidade: 0,
      valorTotal: 0,
    }
    atual.quantidade += Number((item as any).quantidade ?? 0)
    atual.valorTotal = Number((atual.valorTotal + Number((item as any).valorTotal ?? 0)).toFixed(2))
    mapa.set(categoria, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.valorTotal - a.valorTotal)
}

const buildResumoPorCentroCusto = (saidas: Record<string, unknown>[] = []) => {
  const mapa = new Map<string, { id: unknown; nome: string; quantidade: number }>()
  saidas.forEach((saida) => {
    const nome = ((saida as any).centroCusto || "").toString().trim() || "Nao informado"
    const chave = (saida as any).centroCustoId || nome
    const atual = mapa.get(chave) || {
      id: chave,
      nome,
      quantidade: 0,
    }
    atual.quantidade += Number((saida as any).quantidade ?? 0)
    mapa.set(chave, atual)
  })

  return Array.from(mapa.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

const normalizarTermo = (termo: unknown) => {
  const texto = sanitizeDisplayText(termo)
  if (!texto) {
    return ""
  }
  const normalized =
    typeof texto.normalize === "function" ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : texto
  return normalized.toLowerCase()
}

const combinaComTermo = (material: Record<string, unknown> = {}, termoNormalizado = "") => {
  if (!termoNormalizado) return true
  const partes = [
    (material as any).nome,
    (material as any).fabricante,
    (material as any).fabricanteNome,
    (material as any).resumo,
    (material as any).grupoMaterial,
    (material as any).grupoMaterialNome,
    (material as any).categoria,
  ]
    .map((parte) => normalizarTermo(parte))
    .filter(Boolean)
    .join(" ")
  return partes.includes(termoNormalizado)
}

const combinaSaidaComTermo = (saida: Record<string, unknown> = {}, termoNormalizado = "") => {
  if (!termoNormalizado) return true
  const campos = [
    (saida as any).nome,
    (saida as any).pessoa?.nome,
    (saida as any).pessoa?.matricula,
    (saida as any).pessoa?.cargo,
    (saida as any).pessoa?.centroServico,
    (saida as any).pessoa?.setor,
    (saida as any).pessoa?.local,
    (saida as any).pessoaNome,
    (saida as any).centroServico,
    (saida as any).centroServicoNome,
    (saida as any).setor,
    (saida as any).setorNome,
    (saida as any).local,
    (saida as any).material?.nome,
    (saida as any).material?.materialItemNome,
    (saida as any).material?.fabricante,
    (saida as any).material?.fabricanteNome,
    (saida as any).material?.resumo,
    (saida as any).material?.grupoMaterialNome,
    (saida as any).material?.grupoMaterial,
    (saida as any).material?.categoria,
  ]
  const corpus = campos.map((campo) => normalizarTermo(campo)).filter(Boolean).join(" ")
  return corpus.includes(termoNormalizado)
}

const filtrarPorTermo = (lista: Record<string, unknown>[] = [], termoNormalizado = "") => {
  if (!termoNormalizado) return lista
  return lista.filter((item) => {
    if (
      (item as any)?.pessoa ||
      (item as any)?.pessoaId ||
      (item as any)?.centroServico ||
      (item as any)?.setor ||
      (item as any)?.local ||
      (item as any)?.pessoaNome
    ) {
      return combinaSaidaComTermo(item, termoNormalizado)
    }
    return combinaComTermo((item as any).material ?? item, termoNormalizado)
  })
}

const execute = async (builder: Promise<{ data: any; error: any }>, fallbackMessage: string) => {
  const { data, error } = await builder
  if (error) {
    throw new Error(error.message || fallbackMessage)
  }
  return data
}

const executeSingle = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder.single()
  if (error) {
    throw new Error(error.message || fallbackMessage)
  }
  return data
}

const executeMaybeSingle = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder.maybeSingle()
  if (error) {
    throw new Error(error.message || fallbackMessage)
  }
  return data
}

const parsePeriodo = (params: Record<string, unknown> = {}) => {
  const { periodoInicio, periodoFim, ano, mes } = params
  const hasInterval = Boolean(periodoInicio || periodoFim)

  if (hasInterval) {
    const periodo: any = {}

    if (periodoInicio) {
      const [anoInicioRaw, mesInicioRaw] = String(periodoInicio).split("-")
      const anoInicio = toNumber(anoInicioRaw)
      const mesInicio = toNumber(mesInicioRaw)
      if (anoInicio !== null) {
        periodo.inicio = { ano: anoInicio }
        if (mesInicio !== null) {
          periodo.inicio.mes = mesInicio
        }
      }
    }

    if (periodoFim) {
      const [anoFimRaw, mesFimRaw] = String(periodoFim).split("-")
      const anoFim = toNumber(anoFimRaw)
      const mesFim = toNumber(mesFimRaw)
      if (anoFim !== null) {
        periodo.fim = { ano: anoFim }
        if (mesFim !== null) {
          periodo.fim.mes = mesFim
        }
      }
    }

    if (periodo.inicio && !periodo.fim) {
      periodo.fim = { ...periodo.inicio }
    }
    if (periodo.fim && !periodo.inicio) {
      periodo.inicio = { ...periodo.fim }
    }

    if (periodo.inicio || periodo.fim) {
      return periodo
    }
  }

  const periodoSimples: any = {}
  const anoNumero = toNumber(ano)
  const mesNumero = toNumber(mes)

  if (anoNumero !== null) {
    periodoSimples.ano = anoNumero
  }
  if (mesNumero !== null) {
    periodoSimples.mes = mesNumero
  }

  return Object.keys(periodoSimples).length ? periodoSimples : null
}

const filtrarPorPeriodo = (registro: Record<string, unknown>, campoData: string, periodo: any) => {
  if (!periodo) {
    return true
  }

  const rawValue = registro[campoData]
  if (!rawValue) {
    return false
  }

  const data = new Date(rawValue as string)
  if (Number.isNaN(data.getTime())) {
    return false
  }

  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + 1

  if (periodo.inicio || periodo.fim) {
    const indice = ano * 12 + (mes - 1)

    if (periodo.inicio) {
      const inicioAno = toNumber(periodo.inicio.ano)
      const inicioMes = periodo.inicio.mes !== undefined ? toNumber(periodo.inicio.mes) - 1 : 0
      if (inicioAno !== null) {
        const inicioIndice = inicioAno * 12 + Math.max(0, inicioMes ?? 0)
        if (indice < inicioIndice) {
          return false
        }
      }
    }

    if (periodo.fim) {
      const fimAno = toNumber(periodo.fim.ano)
      const fimMes = periodo.fim.mes !== undefined ? toNumber(periodo.fim.mes) - 1 : 11
      if (fimAno !== null) {
        const fimIndice = fimAno * 12 + Math.max(0, fimMes ?? 0)
        if (indice > fimIndice) {
          return false
        }
      }
    }

    return true
  }

  if (periodo.ano !== undefined && ano !== toNumber(periodo.ano)) {
    return false
  }
  if (periodo.mes !== undefined && mes !== toNumber(periodo.mes)) {
    return false
  }
  return true
}

const calcularSaldoMaterial = (materialId: string, entradas: any[], saidas: any[], periodo: any) => {
  const entradasFiltradas = entradas
    .filter((entrada) => entrada.materialId === materialId)
    .filter((entrada) => filtrarPorPeriodo(entrada, "dataEntrada", periodo))
    .filter((entrada) => !isRegistroCancelado(entrada))

  const saidasFiltradas = saidas
    .filter((saida) => saida.materialId === materialId)
    .filter((saida) => filtrarPorPeriodo(saida, "dataEntrega", periodo))
    .filter((saida) => !isRegistroCancelado(saida))

  const totalEntradas = entradasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const totalSaidas = saidasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)

  return totalEntradas - totalSaidas
}

const normalizarMaterial = (material: Record<string, unknown>) => {
  if (!material) {
    return null
  }
  return {
    ...material,
    estoqueMinimo:
      (material as any).estoqueMinimo !== undefined && (material as any).estoqueMinimo !== null
        ? Number((material as any).estoqueMinimo)
        : null,
    valorUnitario: Number((material as any).valorUnitario ?? 0),
    validadeDias: (material as any).validadeDias !== undefined ? Number((material as any).validadeDias) : null,
  }
}

const formatMaterialResumo = (material: Record<string, unknown>) => {
  if (!material) {
    return ""
  }
  const partes = [
    (material as any).materialItemNome || (material as any).nome,
    (material as any).grupoMaterialNome || (material as any).grupoMaterial,
    (material as any).numeroVestimentaNome ||
      (material as any).numeroCalcadoNome ||
      (material as any).numeroVestimenta ||
      (material as any).numeroCalcado ||
      (material as any).numeroEspecifico,
    (material as any).caracteristicasTexto,
    (material as any).fabricanteNome || (material as any).fabricante,
  ]
  return partes
    .map((parte) => (parte ? String(parte).trim() : ""))
    .filter(Boolean)
    .join(" | ")
}

const montarEstoqueAtual = (materiais: any[] = [], entradas: any[] = [], saidas: any[] = [], periodo: any = null, options: any = {}) => {
  const includeAll = Boolean(options?.includeAll)
  const materiaisNormalizados = materiais.map((material) => normalizarMaterial(material)).filter(Boolean)
  const materiaisComMovimentacao = new Set<string>()

  const itens = materiaisNormalizados.map((material: any) => {
    const entradasMaterial = entradas
      .filter((entrada) => entrada.materialId === material.id)
      .filter((entrada) => filtrarPorPeriodo(entrada, "dataEntrada", periodo))
      .filter((entrada) => !isRegistroCancelado(entrada))
    const saidasMaterial = saidas
      .filter((saida) => saida.materialId === material.id)
      .filter((saida) => filtrarPorPeriodo(saida, "dataEntrega", periodo))
      .filter((saida) => !isRegistroCancelado(saida))

    const saldo = calcularSaldoMaterial(material.id, entradas, saidas, periodo)
    const estoqueMinimo = Number(material.estoqueMinimo ?? 0)
    const deficitQuantidade = Math.max(estoqueMinimo - saldo, 0)
    const valorReposicao = Number((deficitQuantidade * Number(material.valorUnitario ?? 0)).toFixed(2))

    if (saldo !== 0 || entradasMaterial.length > 0) {
      materiaisComMovimentacao.add(material.id)
    }

    const centrosCustoSet = new Set<string>()
    entradasMaterial.forEach((entrada) => {
      if (entrada?.centroCusto) {
        centrosCustoSet.add(String(entrada.centroCusto).trim())
      }
    })

    const totalEntradasMaterial = entradasMaterial.reduce(
      (acc, entrada) => acc + Number(entrada.quantidade ?? 0),
      0,
    )
    const totalSaidasMaterial = saidasMaterial.reduce(
      (acc, saida) => acc + Number(saida.quantidade ?? 0),
      0,
    )

    const ultimaAtualizacaoDate = [
      ...entradasMaterial.map((item) => item.dataEntrada),
      ...saidasMaterial.map((item) => item.dataEntrega),
    ]
      .map((raw) => {
        const data = new Date(raw)
        return Number.isNaN(data.getTime()) ? null : data
      })
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] || null

    const alertaAtivo = deficitQuantidade > 0
    const ultimaSaidaInfo =
      saidasMaterial
        .map((saida) => {
          const dataEntregaDate = new Date(saida.dataEntrega ?? (saida as any).data_entrega ?? null)
          if (Number.isNaN(dataEntregaDate.getTime())) {
            return null
          }
          return {
            saidaId: saida.id ?? (saida as any).saidaId ?? null,
            pessoaId: saida.pessoaId ?? null,
            pessoaNome: normalizeText((saida as any).pessoaNome ?? (saida as any).pessoa?.nome ?? ""),
            pessoaMatricula: normalizeText((saida as any).pessoaMatricula ?? (saida as any).pessoa?.matricula ?? ""),
            quantidade: Number(saida.quantidade ?? 0),
            dataEntrega: dataEntregaDate.toISOString(),
            dataEntregaValue: dataEntregaDate.getTime(),
            usuarioResponsavel: normalizeText(
              (saida as any).usuarioResponsavelNome ??
                (saida as any).usuarioResponsavel ??
                (saida as any).usuario_responsavel ??
                (saida as any).usuarioResponsavelId ??
                "",
            ),
          }
        })
        .filter(Boolean)
        .sort((a, b) => (b as any).dataEntregaValue - (a as any).dataEntregaValue)[0] || null

    let ultimaSaida = null
    if (ultimaSaidaInfo) {
      const { dataEntregaValue, ...rest } = ultimaSaidaInfo as any
      ultimaSaida = rest
    }

    return {
      materialId: material.id,
      nome: material.nome,
      resumo: formatMaterialResumo(material),
      fabricante: material.fabricante,
      fabricanteNome: material.fabricanteNome || material.fabricante || "",
      corMaterial: material.corMaterial || material.coresTexto || "",
      coresTexto: material.coresTexto || "",
      validadeDias: material.validadeDias,
      ca: material.ca,
      valorUnitario: material.valorUnitario,
      quantidade: saldo,
      estoqueAtual: saldo,
      valorTotal: Number((saldo * material.valorUnitario).toFixed(2)),
      estoqueMinimo,
      deficitQuantidade,
      valorReposicao,
      alerta: alertaAtivo,
      centrosCusto: Array.from(centrosCustoSet).filter(Boolean),
      totalEntradas: totalEntradasMaterial,
      totalSaidas: totalSaidasMaterial,
      ultimaAtualizacao: ultimaAtualizacaoDate ? (ultimaAtualizacaoDate as Date).toISOString() : null,
      temSaida: saidasMaterial.length > 0,
      ultimaSaida,
    }
  })

  const itensFiltrados = includeAll ? itens : itens.filter((item) => materiaisComMovimentacao.has(item.materialId))

  const alertas = itensFiltrados
    .filter((item) => item.alerta)
    .map((item) => ({
      materialId: item.materialId,
      nome: item.nome,
      resumo: item.resumo,
      fabricante: item.fabricante,
      fabricanteNome: item.fabricanteNome,
      estoqueAtual: item.estoqueAtual,
      estoqueMinimo: item.estoqueMinimo,
      deficitQuantidade: item.deficitQuantidade,
      valorReposicao: item.valorReposicao,
      centrosCusto: item.centrosCusto,
    }))

  const totalItens = itensFiltrados.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const valorReposicaoTotal = itensFiltrados.reduce((acc, item) => acc + Number(item.valorReposicao ?? 0), 0)
  const ultimaAtualizacaoGeral = itensFiltrados
    .map((item) => (item.ultimaAtualizacao ? new Date(item.ultimaAtualizacao) : null))
    .filter((data) => data && !Number.isNaN((data as Date).getTime()))
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] || null

  return {
    itens: itensFiltrados,
    alertas,
    resumo: {
      totalItens,
      valorReposicao: Number(valorReposicaoTotal.toFixed(2)),
      ultimaAtualizacao: ultimaAtualizacaoGeral ? (ultimaAtualizacaoGeral as Date).toISOString() : null,
    },
  }
}

const agruparHistorico = (lista: any[], campoData: string, materiaisMap: Map<string, any>) => {
  const mapa = new Map<string, any>()

  lista.forEach((item) => {
    const data = new Date(item[campoData])
    if (Number.isNaN(data.getTime())) {
      return
    }
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${mes}`

    const material = item.material || materiaisMap.get(item.materialId) || null
    const quantidade = Number(item.quantidade ?? 0)
    const valorUnitario = Number(material?.valorUnitario ?? 0)
    const valor = quantidade * valorUnitario

    if (!mapa.has(key)) {
      mapa.set(key, {
        ano,
        mes,
        quantidade: 0,
        valorTotal: 0,
      })
    }

    const atual = mapa.get(key)
    atual.quantidade += quantidade
    atual.valorTotal = Number((atual.valorTotal + valor).toFixed(2))
  })

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.ano !== b.ano) {
      return a.ano - b.ano
    }
    return a.mes - b.mes
  })
}

const somaValores = (lista: any[], materiaisMap: Map<string, any>) => {
  return lista.reduce((acc, item) => {
    const material = materiaisMap.get(item.materialId) || null
    if (!material) {
      return acc
    }
    const valorUnitario = Number(material.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)
    return acc + valorUnitario * quantidade
  }, 0)
}

const somaQuantidade = (lista: any[]) => {
  return lista.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
}

const montarDashboard = ({ materiais = [], entradas = [], saidas = [], pessoas = [] }: any, periodo: any = null) => {
  const materiaisNormalizados = materiais.map((material: any) => normalizarMaterial(material)).filter(Boolean)
  const materiaisMap = new Map(materiaisNormalizados.map((material: any) => [material.id, material]))
  const pessoasAtivas = (Array.isArray(pessoas) ? pessoas : []).filter((pessoa) => pessoa?.ativo !== false)
  const pessoasMap = new Map(pessoasAtivas.map((pessoa: any) => [pessoa.id, pessoa]))

  const filtrar = (lista: any[], campoData: string) => lista.filter((item) => filtrarPorPeriodo(item, campoData, periodo))

  const entradasFiltradas = filtrar(entradas, "dataEntrada").filter((entrada) => !isRegistroCancelado(entrada))
  const pessoaAtivaIds = new Set(pessoasAtivas.map((pessoa: any) => pessoa?.id).filter(Boolean))
  const saidasFiltradas = filtrar(saidas, "dataEntrega")
    .filter((saida) => !isRegistroCancelado(saida))
    .filter((saida) => {
      if (!saida?.pessoaId) {
        return true
      }
      return pessoaAtivaIds.has(saida.pessoaId)
    })

  const entradasDetalhadas = entradasFiltradas.map((entrada) => ({
    ...entrada,
    material: materiaisMap.get(entrada.materialId) || null,
  }))

  const saidasDetalhadas = saidasFiltradas.map((saida) => ({
    ...saida,
    material: materiaisMap.get(saida.materialId) || null,
    pessoa: pessoasMap.get(saida.pessoaId) || null,
  }))

  const materialContexto = new Map<string, Set<string>>()
  saidasDetalhadas.forEach((saida) => {
    const materialId = saida.materialId
    if (!materialId) {
      return
    }
    const atual = materialContexto.get(materialId) ?? new Set()
    const candidatos = [
      saida.centroServico,
      saida.setor,
      saida.local,
      (saida as any).pessoa?.nome,
      (saida as any).pessoa?.centroServico,
      (saida as any).pessoa?.setor,
      (saida as any).pessoa?.local,
      (saida as any).pessoa?.cargo,
    ]
    candidatos
      .map((valor) => (typeof valor === "string" ? valor.trim() : ""))
      .filter(Boolean)
      .forEach((texto) => atual.add(texto))
    if (atual.size) {
      materialContexto.set(materialId, atual)
    }
  })

  const totalEntradasValor = somaValores(entradasFiltradas, materiaisMap)
  const totalSaidasValor = somaValores(saidasFiltradas, materiaisMap)

  const movimentacaoPorMaterial = materiaisNormalizados.map((material: any) => {
    const entradasMaterial = entradasFiltradas.filter((item) => item.materialId === material.id)
    const saidasMaterial = saidasFiltradas.filter((item) => item.materialId === material.id)
    const totalQuantidade =
      entradasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0) +
      saidasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
    const fabricanteNome = material.fabricanteNome || material.fabricante || ""
    return {
      materialId: material.id,
      nome: material.nome,
      fabricante: material.fabricante,
      fabricanteNome,
      totalQuantidade,
      contexto: Array.from(materialContexto.get(material.id) ?? []),
    }
  })

  const maisMovimentados = movimentacaoPorMaterial
    .filter((item) => item.totalQuantidade > 0)
    .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
    .slice(0, 10)

  const estoqueAtual = montarEstoqueAtual(materiaisNormalizados, entradas, saidas, null)

  const entradasHistoricas = agruparHistorico(entradasDetalhadas, "dataEntrada", materiaisMap)
  const saidasHistoricas = agruparHistorico(saidasDetalhadas, "dataEntrega", materiaisMap)

  return {
    periodo: periodo || null,
    entradas: {
      quantidade: somaQuantidade(entradasFiltradas),
      valorTotal: Number(totalEntradasValor.toFixed(2)),
    },
    saidas: {
      quantidade: somaQuantidade(saidasFiltradas),
      valorTotal: Number(totalSaidasValor.toFixed(2)),
    },
    entradasDetalhadas,
    saidasDetalhadas,
    entradasHistoricas,
    saidasHistoricas,
    materiaisMaisMovimentados: maisMovimentados,
    estoqueAtual,
  }
}

const buildParetoResumo = (pareto: { lista: any[] }) => {
  const totalMateriais = pareto.lista.length
  const itensA = pareto.lista.filter((item) => item.classe === "A")
  const percentualPareto = totalMateriais ? (itensA.length / totalMateriais) * 100 : 0
  return {
    totalMateriais,
    totalItensA: itensA.length,
    percentualPareto,
    percentualMateriais: totalMateriais ? (itensA.length / totalMateriais) * 100 : 0,
  }
}

const buildListaPareto = (lista: any[] = [], valueKey: string, valueFormatter?: (value: any) => string, maxItems = 10) => {
  const linhas = lista.slice(0, maxItems).map((item) => {
    const valor = valueFormatter ? valueFormatter(item?.[valueKey]) : item?.[valueKey]
    return `${item?.descricao || item?.nome || "Nao informado"} - ${valor} - ${formatPercent(item?.percentualAcumulado ?? 0)}`
  })
  return linhas.length ? linhas.join("\n") : "Sem dados"
}

const buildListaCriticos = (lista: any[] = []) => {
  const linhas = lista.map((item) => item?.nome || item?.descricao || "Nao informado")
  return linhas.length ? linhas.join("\n") : "Sem dados"
}

const buildListaConsumo = (setores: any[] = [], centros: any[] = []) => {
  const linhas: string[] = []
  setores.slice(0, 5).forEach((item) => {
    linhas.push(`Setor: ${item.nome || "Nao informado"} - ${formatNumber(item.quantidade)}`)
  })
  centros.slice(0, 5).forEach((item) => {
    linhas.push(`Centro: ${item.nome || "Nao informado"} - ${formatNumber(item.quantidade)}`)
  })
  return linhas.length ? linhas.join("\n") : "Sem dados"
}

const buildListaFinanceiro = (pareto: any[] = [], categorias: any[] = []) => {
  const linhas: string[] = []
  pareto.slice(0, 5).forEach((item) => {
    linhas.push(`Material: ${item.descricao || item.nome || "Nao informado"} - ${formatCurrency(item.valorTotal)}`)
  })
  categorias.slice(0, 5).forEach((item) => {
    linhas.push(`Categoria: ${item.nome || "Nao informado"} - ${formatCurrency(item.valorTotal)}`)
  })
  return linhas.length ? linhas.join("\n") : "Sem dados"
}

const buildCoberturaResumo = (consumoPorTrabalhador: number | null) => {
  if (consumoPorTrabalhador === null) {
    return { status: "SEM DADOS", interpretacao: "Sem trabalhadores ativos no periodo." }
  }
  if (consumoPorTrabalhador >= 1) {
    return { status: "OK", interpretacao: "Cobertura adequada para o consumo medio atual." }
  }
  if (consumoPorTrabalhador >= 0.5) {
    return { status: "ATENCAO", interpretacao: "Cobertura moderada, requer acompanhamento." }
  }
  return { status: "CRITICO", interpretacao: "Cobertura baixa para o consumo observado." }
}

const buildNivelRiscoResumo = (qtdCriticos: number, qtdAtencao: number) => {
  if (qtdCriticos > 0) return "CRITICO"
  if (qtdAtencao > 0) return "ATENCAO"
  return "OK"
}

const buildReportSummary = ({ dashboard, pessoas = [], periodoRange, termo, estoqueBase }: any) => {
  const termoNormalizado = normalizarTermo(termo)
  const entradasDetalhadas = filtrarPorTermo(dashboard?.entradasDetalhadas ?? [], termoNormalizado)
  const saidasDetalhadas = filtrarPorTermo(dashboard?.saidasDetalhadas ?? [], termoNormalizado)

  const saidasResumo = buildSaidasResumo(saidasDetalhadas)
  const diasPeriodo = calcularDiasPeriodo(periodoRange)

  const totalEntradasQuantidade = entradasDetalhadas.reduce(
    (acc: number, item: any) => acc + Number(item.quantidade ?? 0),
    0,
  )
  const totalSaidasQuantidade = saidasDetalhadas.reduce(
    (acc: number, item: any) => acc + Number(item.quantidade ?? 0),
    0,
  )
  const totalEntradasValor = entradasDetalhadas.reduce(
    (acc: number, item: any) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
    0,
  )
  const totalSaidasValor = saidasDetalhadas.reduce(
    (acc: number, item: any) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
    0,
  )
  const totalMovimentacoes = entradasDetalhadas.length + saidasDetalhadas.length

  const p80Quantidade = computePercentile(saidasResumo.map((item: any) => item.quantidade), 0.8)
  const p90Quantidade = computePercentile(saidasResumo.map((item: any) => item.quantidade), 0.9)
  const p80Giro = diasPeriodo
    ? computePercentile(saidasResumo.map((item: any) => item.quantidade / diasPeriodo), 0.8)
    : 0

  const riscoLista = buildRiscoOperacional({
    saidasResumo,
    estoqueAtual: estoqueBase?.itens ?? dashboard?.estoqueAtual?.itens ?? [],
    diasPeriodo,
    p80Quantidade,
    p90Quantidade,
    p80Giro,
  })

  const paretoQuantidade = buildParetoList(saidasResumo, "quantidade")
  const paretoFinanceiro = buildParetoList(saidasResumo, "valorTotal")
  const paretoRisco = buildParetoList(riscoLista.filter((item: any) => item.score > 0), "score")
  const paretoResumo = buildParetoResumo(paretoQuantidade)

  const categorias = buildResumoPorCategoria(saidasResumo)
  const setores = buildResumoPorSetor(saidasDetalhadas)
  const centros = buildResumoPorCentroServico(saidasDetalhadas)
  const centrosCusto = buildResumoPorCentroCusto(saidasDetalhadas)

  const qtdCriticos = riscoLista.filter((item: any) => item.classe === "A").length
  const qtdAtencao = riscoLista.filter((item: any) => item.classe === "B").length
  const qtdControlados = riscoLista.filter((item: any) => item.classe === "C").length

  const criticosLista = riscoLista.filter((item: any) => item.classe === "A")
  const criticosIds = new Set(criticosLista.map((item: any) => item.materialId))

  const hoje = new Date()
  const limiteVencendo = new Date()
  limiteVencendo.setDate(limiteVencendo.getDate() + 30)

  let qtdVencidos = 0
  let qtdVencendo = 0
  saidasDetalhadas.forEach((saida: any) => {
    if (!saida?.dataTroca) return
    const dataTroca = new Date(saida.dataTroca)
    if (Number.isNaN(dataTroca.getTime())) return
    if (dataTroca < hoje) qtdVencidos += 1
    else if (dataTroca <= limiteVencendo) qtdVencendo += 1
  })

  const qtdExcesso = riscoLista.filter(
    (item: any) => item.estoqueAtual > item.pressaoVidaUtil * 1.5 && item.pressaoVidaUtil > 0,
  ).length
  const qtdRiscosImediatos = riscoLista.filter((item: any) => item.flags?.rupturaPressao).length
  const qtdAbaixoMinimo = riscoLista.filter((item: any) => item.flags?.estoqueBaixo).length

  const pessoasAtivas = (pessoas ?? []).filter((pessoa: any) => pessoa?.ativo !== false)
  const consumoPorTrabalhador = pessoasAtivas.length > 0 ? totalSaidasQuantidade / pessoasAtivas.length : null
  const coberturaResumo = buildCoberturaResumo(consumoPorTrabalhador)

  const baseGiro = criticosLista.length ? criticosLista : riscoLista
  const giroMedioCriticos = baseGiro.length
    ? baseGiro.reduce((acc: number, item: any) => acc + Number(item.giroDiario ?? 0), 0) / baseGiro.length
    : 0

  return {
    entradasDetalhadas,
    saidasDetalhadas,
    saidasResumo,
    diasPeriodo,
    totalEntradasQuantidade,
    totalSaidasQuantidade,
    totalEntradasValor,
    totalSaidasValor,
    totalMovimentacoes,
    paretoQuantidade,
    paretoFinanceiro,
    paretoRisco,
    paretoResumo,
    categorias,
    setores,
    centros,
    centrosCusto,
    qtdCriticos,
    qtdAtencao,
    qtdControlados,
    criticosLista,
    criticosIds,
    qtdVencidos,
    qtdVencendo,
    qtdExcesso,
    qtdRiscosImediatos,
    qtdAbaixoMinimo,
    consumoPorTrabalhador,
    coberturaResumo,
    giroMedioCriticos,
    valorTotalMovimentado: totalEntradasValor + totalSaidasValor,
    alertasAtivos: estoqueBase?.alertas?.length ?? dashboard?.estoqueAtual?.alertas?.length ?? 0,
  }
}

const buildMonthlyContext = ({ resumo, periodoRange }: any) => {
  const nivelRisco = buildNivelRiscoResumo(resumo.qtdCriticos, resumo.qtdAtencao)
  const listaParetoQuantidade = buildListaPareto(resumo.paretoQuantidade.lista, "quantidade", formatNumber)
  const listaParetoValor = buildListaFinanceiro(resumo.paretoFinanceiro.lista, resumo.categorias)
  const listaCriticos = buildListaCriticos(resumo.criticosLista)
  const listaConsumoSetor = buildListaConsumo(resumo.setores, resumo.centros)

  return {
    mes_referencia: formatMonthRef(periodoRange?.start),
    periodo_inicio: formatDateBr(periodoRange?.start),
    periodo_fim: formatDateBr(periodoRange?.end),
    data_emissao: formatDateBr(new Date()),
    total_movimentacoes: formatNumber(resumo.totalMovimentacoes),
    total_entradas: formatNumber(resumo.entradasDetalhadas.length),
    total_saidas: formatNumber(resumo.saidasDetalhadas.length),
    valor_total_movimentado: formatCurrency(resumo.valorTotalMovimentado),
    alertas_ativos: formatNumber(resumo.alertasAtivos),
    nivel_risco_geral: nivelRisco,
    status_estoque: nivelRisco,
    percentual_pareto: formatPercent(resumo.paretoResumo.percentualPareto),
    percentual_materiais: formatPercent(resumo.paretoResumo.percentualMateriais),
    lista_pareto_quantidade: listaParetoQuantidade,
    qtd_criticos: formatNumber(resumo.qtdCriticos),
    qtd_atencao: formatNumber(resumo.qtdAtencao),
    qtd_controlados: formatNumber(resumo.qtdControlados),
    lista_materiais_criticos: listaCriticos,
    lista_pareto_valor: listaParetoValor,
    lista_consumo_setor: listaConsumoSetor,
    qtd_vencidos: formatNumber(resumo.qtdVencidos),
    qtd_vencendo: formatNumber(resumo.qtdVencendo),
    qtd_excesso: formatNumber(resumo.qtdExcesso),
    status_cobertura: resumo.coberturaResumo.status,
    interpretacao_cobertura: resumo.coberturaResumo.interpretacao,
    qtd_abaixo_minimo: formatNumber(resumo.qtdAbaixoMinimo),
    qtd_riscos_imediatos: formatNumber(resumo.qtdRiscosImediatos),
    status_final: nivelRisco,
  }
}

const buildReportSummaryPayload = ({ dashboard, pessoas, periodoRange, termo, estoqueBase }: any) => {
  const resumo = buildReportSummary({ dashboard, pessoas, periodoRange, termo, estoqueBase })
  return resumo
}

const buildInventoryReport = async ({
  ownerId,
  createdById,
  periodoInicio,
  periodoFim,
  termo,
  origem,
  periodoRange,
  dadosAtual,
}: any) => {
  const resumoAtual = buildReportSummaryPayload({
    dashboard: dadosAtual.dashboard,
    pessoas: dadosAtual.pessoas,
    periodoRange,
    termo,
    estoqueBase: dadosAtual.estoqueBase,
  })

  const context = buildMonthlyContext({ resumo: resumoAtual, periodoRange })

  const metadados = {
    tipo: REPORT_TYPE_MENSAL,
    origem,
    contexto: context,
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    pesos_risco: DEFAULT_RISK_WEIGHTS,
    limites_risco: DEFAULT_RISK_THRESHOLDS,
    variacao_relevante: DEFAULT_VARIACAO_RELEVANTE,
    totais: {
      entradas: resumoAtual.totalEntradasQuantidade,
      saidas: resumoAtual.totalSaidasQuantidade,
    },
  }

  const registro = await executeSingle(
    supabaseAdmin
      .from("inventory_report")
      .insert({
        account_owner_id: ownerId,
        created_by: createdById,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        termo: termo || "",
        pareto_saida: resumoAtual.paretoQuantidade,
        pareto_risco: resumoAtual.paretoRisco,
        pareto_financeiro: resumoAtual.paretoFinanceiro,
        metadados,
        email_status: "pendente",
        email_enviado_em: null,
        email_erro: null,
        email_tentativas: 0,
      })
      .select("id, created_at"),
    "Falha ao registrar relatorio de estoque.",
  )

  return {
    registro,
    tipo: REPORT_TYPE_MENSAL,
    metadados,
    resumoAtual,
  }
}

const carregarMateriaisPorOwner = async (ownerId: string) => {
  const registrosIds = await execute(
    supabaseAdmin.from("materiais").select("id").eq("account_owner_id", ownerId),
    "Falha ao listar materiais.",
  )
  const ids = (registrosIds ?? []).map((item: any) => item.id).filter(Boolean)
  if (!ids.length) {
    return []
  }
  const materiaisRegistros = await execute(
    supabaseAdmin.from(materiaisView).select("*").in("id", ids).order("nome"),
    "Falha ao listar materiais.",
  )
  return (materiaisRegistros ?? []).map((item: any) => mapMaterialRecord(item))
}

const preencherCentrosEstoque = async (registros: any[] = [], ownerId: string) => {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((entrada) => entrada.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  if (!ids.length) {
    return registros
  }
  try {
    const centros = await execute(
      supabaseAdmin
        .from(CENTRO_ESTOQUE_TABLE)
        .select("id, almox")
        .in("id", ids)
        .eq("account_owner_id", ownerId),
      "Falha ao consultar centros de estoque.",
    )
    const mapa = new Map(
      (centros ?? [])
        .map((centro: any) => [centro.id, trim(centro.almox ?? "")])
        .filter(([, nome]) => Boolean(nome)),
    )
    if (!mapa.size) {
      return registros
    }
    return registros.map((entrada) => {
      if (!entrada.centroCustoId) {
        return entrada
      }
      const nome = mapa.get(entrada.centroCustoId)
      if (!nome) {
        return entrada
      }
      return {
        ...entrada,
        centroCusto: nome,
        centroCustoNome: nome,
      }
    })
  } catch (error) {
    console.warn("Falha ao resolver centros de estoque.", error)
    return registros
  }
}

const preencherNomesSaidas = async (registros: any[] = [], ownerId: string) => {
  const centroCustoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  const centroServicoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.centroServicoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  const setorIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.setorId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )

  const [centrosCusto, centrosServico, setores] = await Promise.all([
    centroCustoIds.length
      ? execute(
          supabaseAdmin.from("centros_custo").select("id, nome").in("id", centroCustoIds).eq("account_owner_id", ownerId),
          "Falha ao consultar centros de custo.",
        )
      : [],
    centroServicoIds.length
      ? execute(
          supabaseAdmin
            .from("centros_servico")
            .select("id, nome")
            .in("id", centroServicoIds)
            .eq("account_owner_id", ownerId),
          "Falha ao consultar centros de servico.",
        )
      : [],
    setorIds.length
      ? execute(
          supabaseAdmin.from("setores").select("id, nome").in("id", setorIds).eq("account_owner_id", ownerId),
          "Falha ao consultar setores.",
        )
      : [],
  ])

  const centroCustoMap = new Map(
    (centrosCusto ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )
  const centroServicoMap = new Map(
    (centrosServico ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )
  const setorMap = new Map(
    (setores ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )

  return registros.map((saida) => ({
    ...saida,
    centroCusto: centroCustoMap.get(saida.centroCustoId) || saida.centroCusto || "",
    centroServico: centroServicoMap.get(saida.centroServicoId) || saida.centroServico || "",
    setor: setorMap.get(saida.setorId) || saida.setor || "",
  }))
}

const carregarMovimentacoesPorOwner = async ({ ownerId, periodoRange }: { ownerId: string; periodoRange?: { start: Date; end: Date } }) => {
  if (!ownerId) {
    return { materiais: [], entradas: [], saidas: [], pessoas: [], periodo: null }
  }
  const entradasQuery = supabaseAdmin.from("entradas").select("*").eq("account_owner_id", ownerId)
  const saidasQuery = supabaseAdmin.from("saidas").select("*").eq("account_owner_id", ownerId)

  let entradasFiltered = entradasQuery
  let saidasFiltered = saidasQuery

  if (periodoRange?.start) {
    const inicioIso = periodoRange.start.toISOString()
    entradasFiltered = entradasFiltered.gte("dataEntrada", inicioIso)
    saidasFiltered = saidasFiltered.gte("dataEntrega", inicioIso)
  }
  if (periodoRange?.end) {
    const fimIso = periodoRange.end.toISOString()
    entradasFiltered = entradasFiltered.lte("dataEntrada", fimIso)
    saidasFiltered = saidasFiltered.lte("dataEntrega", fimIso)
  }

  const [materiais, entradas, saidas, pessoas] = await Promise.all([
    carregarMateriaisPorOwner(ownerId),
    execute(entradasFiltered, "Falha ao listar entradas."),
    execute(saidasFiltered, "Falha ao listar saidas."),
    execute(supabaseAdmin.from("pessoas").select("*").eq("account_owner_id", ownerId), "Falha ao listar pessoas."),
  ])

  const entradasNormalizadas = await preencherCentrosEstoque((entradas ?? []).map(mapEntradaRecord), ownerId)
  const saidasNormalizadas = await preencherNomesSaidas((saidas ?? []).map(mapSaidaRecord), ownerId)

  return {
    materiais,
    entradas: entradasNormalizadas,
    saidas: saidasNormalizadas,
    pessoas: pessoas ?? [],
  }
}

const resolveEarliestMovimentacao = async (ownerId: string) => {
  const [entrada, saida] = await Promise.all([
    executeMaybeSingle(
      supabaseAdmin
        .from("entradas")
        .select("dataEntrada")
        .eq("account_owner_id", ownerId)
        .order("dataEntrada", { ascending: true })
        .limit(1),
      "Falha ao consultar entradas.",
    ),
    executeMaybeSingle(
      supabaseAdmin
        .from("saidas")
        .select("dataEntrega")
        .eq("account_owner_id", ownerId)
        .order("dataEntrega", { ascending: true })
        .limit(1),
      "Falha ao consultar saidas.",
    ),
  ])

  const datas: Date[] = []
  if ((entrada as any)?.dataEntrada) {
    const data = new Date((entrada as any).dataEntrada)
    if (!Number.isNaN(data.getTime())) datas.push(data)
  }
  if ((saida as any)?.dataEntrega) {
    const data = new Date((saida as any).dataEntrega)
    if (!Number.isNaN(data.getTime())) datas.push(data)
  }
  if (!datas.length) {
    return null
  }
  return new Date(Math.min(...datas.map((data) => data.getTime())))
}

const loadReportRegistry = async (ownerId: string, tipo: string) => {
  const registros = await execute(
    supabaseAdmin
      .from("inventory_report")
      .select("periodo_inicio, periodo_fim")
      .eq("account_owner_id", ownerId)
      .eq("metadados->>tipo", tipo),
    "Falha ao consultar relatorios.",
  )
  const set = new Set<string>()
  ;(registros ?? []).forEach((item: any) => {
    const key = `${item?.periodo_inicio || ""}|${item?.periodo_fim || ""}`
    if (key !== "|") {
      set.add(key)
    }
  })
  return set
}

const buildPeriodoParams = (periodoRange: { start: Date; end: Date }) => {
  return parsePeriodo({
    periodoInicio: `${periodoRange.start.getUTCFullYear()}-${String(periodoRange.start.getUTCMonth() + 1).padStart(2, "0")}`,
    periodoFim: `${periodoRange.end.getUTCFullYear()}-${String(periodoRange.end.getUTCMonth() + 1).padStart(2, "0")}`,
  })
}

const fetchOwners = async () => {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, username, display_name, ativo, parent_user_id")
    .is("parent_user_id", null)
  if (error) {
    throw new Error(`Falha ao listar owners: ${error.message}`)
  }
  return (data || []).filter((row) => row?.ativo !== false && row?.id)
}

const buildMonthLimit = (now: Date) => {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return toEndOfMonthUtc(previousMonth)
}

export const assertRelatorioEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
}

export const runRelatorioEstoqueMensal = async () => {
  return runRelatorioAuto()
}

const runRelatorioAuto = async () => {
  assertRelatorioEnv()

  const owners = await fetchOwners()
  const resultados: Array<Record<string, unknown>> = []

  const agora = new Date()
  const monthLimit = buildMonthLimit(agora)

  for (const owner of owners ?? []) {
    if (owner?.ativo === false) {
      continue
    }
    const ownerId = (owner as any).id as string
    if (!ownerId) continue

    const earliestDate = await resolveEarliestMovimentacao(ownerId)
    if (!earliestDate) {
      resultados.push({
        ownerId,
        skipped: true,
        reason: "sem_movimentacoes",
      })
      continue
    }

    const mensalRegistrados = await loadReportRegistry(ownerId, REPORT_TYPE_MENSAL)
    const meses = buildMonthPeriods(earliestDate, monthLimit)
    for (const periodoRange of meses) {
      const chave = `${toDateOnly(periodoRange.start)}|${toDateOnly(periodoRange.end)}`
      if (mensalRegistrados.has(chave)) {
        continue
      }

        const dadosAtual = await carregarMovimentacoesPorOwner({ ownerId, periodoRange })
        const estoqueBaseAtual = montarEstoqueAtual(
          dadosAtual.materiais,
          dadosAtual.entradas,
          dadosAtual.saidas,
          null,
        )
        const dashboardAtual = montarDashboard(
          {
            materiais: dadosAtual.materiais,
            entradas: dadosAtual.entradas,
            saidas: dadosAtual.saidas,
            pessoas: dadosAtual.pessoas,
          },
          buildPeriodoParams(periodoRange),
        )
        const resumoAtual = buildReportSummary({
          dashboard: dashboardAtual,
          pessoas: dadosAtual.pessoas,
          periodoRange,
          termo: "",
          estoqueBase: estoqueBaseAtual,
        })
        if (resumoAtual.totalMovimentacoes === 0) {
          resultados.push({
            ownerId,
            tipo: REPORT_TYPE_MENSAL,
            skipped: true,
            reason: "sem_dados_periodo",
            periodo_inicio: toDateOnly(periodoRange.start),
            periodo_fim: toDateOnly(periodoRange.end),
          })
          continue
        }

      const report = await buildInventoryReport({
        ownerId,
        createdById: ownerId,
        periodoInicio: toDateOnly(periodoRange.start),
        periodoFim: toDateOnly(periodoRange.end),
        termo: "",
        origem: "auto",
        periodoRange,
        dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
      })

      mensalRegistrados.add(chave)
      resultados.push({
        ownerId,
        tipo: REPORT_TYPE_MENSAL,
        periodo_inicio: toDateOnly(periodoRange.start),
        periodo_fim: toDateOnly(periodoRange.end),
        reportId: report.registro?.id ?? null,
        email_status: "pendente",
      })
    }
  }

  return { ok: true, total: resultados.length, resultados }
}
