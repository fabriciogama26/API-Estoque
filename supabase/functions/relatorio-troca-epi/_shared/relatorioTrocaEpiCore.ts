import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const REPORT_TYPE_TROCA = "troca-epi-alertas"
const EMAIL_STATUS_PENDENTE = "pendente"
const DEFAULT_MATERIAIS_VIEW = "materiais_view"
const REPORT_TIMEZONE = Deno.env.get("RELATORIO_TROCA_EPI_TIMEZONE") || "America/Sao_Paulo"
const DAY_MS = 24 * 60 * 60 * 1000

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

const trim = (value: unknown) => {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

const pad2 = (value: number) => String(value).padStart(2, "0")

const getDatePartsInTimezone = (value: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(value)
  const map = new Map(parts.map((part) => [part.type, part.value]))
  const year = Number(map.get("year") || "")
  const month = Number(map.get("month") || "")
  const day = Number(map.get("day") || "")
  if (!year || !month || !day) return null
  return { year, month, day }
}

const buildDateKey = (parts: { year: number; month: number; day: number }) =>
  `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`

const toUtcDateValue = (parts: { year: number; month: number; day: number }) =>
  Date.UTC(parts.year, parts.month - 1, parts.day)

const resolveTodayContext = () => {
  const todayParts = getDatePartsInTimezone(new Date(), REPORT_TIMEZONE)
  if (!todayParts) {
    throw new Error("Falha ao resolver data base do relatorio.")
  }
  const todayUtcMs = toUtcDateValue(todayParts)
  const periodo = buildDateKey(todayParts)
  const rangeStartIso = new Date(todayUtcMs - DAY_MS).toISOString()
  const rangeEndIso = new Date(todayUtcMs + 8 * DAY_MS).toISOString()
  return { todayUtcMs, periodo, rangeStartIso, rangeEndIso }
}

const classifyTrocaPrazo = (dataTroca: unknown, todayUtcMs: number) => {
  if (!dataTroca) return null
  let parts: { year: number; month: number; day: number } | null = null
  if (typeof dataTroca === "string") {
    const match = dataTroca.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      parts = {
        year: Number(year),
        month: Number(month),
        day: Number(day),
      }
    }
  }
  if (!parts) {
    const date = new Date(dataTroca as any)
    if (Number.isNaN(date.getTime())) return null
    parts = getDatePartsInTimezone(date, REPORT_TIMEZONE)
  }
  if (!parts) return null
  const dataUtc = toUtcDateValue(parts)
  const diffDays = Math.floor((dataUtc - todayUtcMs) / DAY_MS)
  if (diffDays === 0) return "limite"
  if (diffDays >= 1 && diffDays <= 7) return "alerta"
  return null
}

const normalizeSearchValue = (value: unknown) => {
  if (value === undefined || value === null) return ""
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

const formatMaterialSummary = (material: any) => {
  if (!material) return ""
  const isLikelyUuid = (value: unknown) => UUID_REGEX.test(String(value || "").trim())
  const nome =
    [material.materialItemNome, material.nome, material.nomeId, material.id].find(
      (valor) => valor && !isLikelyUuid(valor),
    ) || ""
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ""
  const detalheCandidates = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes[0] : "",
  ]
  const detalhe = detalheCandidates.find((valor) => valor && !isLikelyUuid(valor)) || ""
  const corDescricao =
    material.coresTexto ||
    material.corMaterial ||
    (Array.isArray(material.coresNomes) ? material.coresNomes.join(", ") : "")
  const caracteristicaDescricao =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes) ? material.caracteristicasNomes.join(", ") : "")
  const fabricante =
    material.fabricanteNome ||
    (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : "") ||
    ""
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set<string>()
  const partes = resumo.filter((parte) => {
    const texto = (parte || "").toString().trim()
    if (!texto) return false
    const chave = texto.toLowerCase()
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
  return partes.join(" | ")
}

const execute = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const executeSingle = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder.single()
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const loadStatusSaidaMap = async () => {
  const registros = await execute(
    supabaseAdmin.from("status_saida").select("id, status"),
    "Falha ao consultar status de saida.",
  )
  const mapa = new Map<string, string>()
  ;(registros ?? []).forEach((registro: any) => {
    if (!registro?.id) return
    const nome = trim(registro.status ?? "")
    if (nome) mapa.set(registro.id, nome)
  })
  return mapa
}

const isSaidaCancelada = (statusLabel: string) => normalizeSearchValue(statusLabel) === "cancelado"

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

const loadLatestReport = async (ownerId: string) => {
  const data = await execute(
    supabaseAdmin
      .from("inventory_report")
      .select("id, periodo_inicio, periodo_fim, metadados")
      .eq("account_owner_id", ownerId)
      .eq("metadados->>tipo", REPORT_TYPE_TROCA)
      .order("periodo_inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    "Falha ao consultar relatorio anterior.",
  )
  return (data ?? [])[0] ?? null
}

const loadSaidasBase = async (ownerId: string, range: { start: string; end: string }) => {
  return await execute(
    supabaseAdmin
      .from("saidas")
      .select(
        "id, materialId, pessoaId, quantidade, dataEntrega, dataTroca, status, usuarioResponsavel, centro_custo, centro_servico, centro_estoque, criadoEm",
      )
      .eq("account_owner_id", ownerId)
      .not("dataTroca", "is", null)
      .gte("dataTroca", range.start)
      .lte("dataTroca", range.end),
    "Falha ao listar saidas para troca.",
  )
}

const loadPessoasMap = async (ownerId: string, ids: string[]) => {
  if (!ids.length) return new Map()
  const pessoas = await execute(
    supabaseAdmin
      .from("pessoas")
      .select("id, nome, matricula")
      .in("id", ids)
      .eq("account_owner_id", ownerId),
    "Falha ao listar pessoas.",
  )
  return new Map((pessoas ?? []).map((item: any) => [item.id, item]))
}

const loadMateriaisMap = async (ids: string[]) => {
  if (!ids.length) return new Map()
  const materiais = await execute(
    supabaseAdmin
      .from(materiaisView)
      .select("*")
      .in("id", ids),
    "Falha ao listar materiais.",
  )
  return new Map((materiais ?? []).map((item: any) => [item.id, item]))
}

const loadCentrosMap = async (ownerId: string, table: string, ids: string[], field: string) => {
  if (!ids.length) return new Map()
  const registros = await execute(
    supabaseAdmin.from(table).select(`id, ${field}`).in("id", ids).eq("account_owner_id", ownerId),
    `Falha ao listar ${table}.`,
  )
  return new Map(
    (registros ?? [])
      .map((item: any) => [item.id, trim(item[field] ?? "")])
      .filter(([, nome]) => Boolean(nome)),
  )
}

const loadUsuariosMap = async (ownerId: string, ids: string[]) => {
  if (!ids.length) return new Map()
  const usuarios = await execute(
    supabaseAdmin
      .from("app_users")
      .select("id, display_name, username, email, parent_user_id")
      .in("id", ids)
      .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`),
    "Falha ao listar usuarios.",
  )
  return new Map(
    (usuarios ?? []).map((item: any) => [
      item.id,
      trim(item.display_name ?? item.username ?? item.email ?? ""),
    ]),
  )
}

const buildCentroLabel = (saida: any, maps: any) => {
  const centroEstoque = maps.centrosEstoque.get(saida?.centro_estoque) || ""
  const centroCusto = maps.centrosCusto.get(saida?.centro_custo) || ""
  const centroServico = maps.centrosServico.get(saida?.centro_servico) || ""
  return [centroEstoque, centroCusto, centroServico].filter(Boolean).join(" / ")
}

const mapSaidaRecord = (saida: any, maps: any, statusMap: Map<string, string>) => {
  const pessoa = maps.pessoas.get(saida?.pessoaId) || null
  const material = maps.materiais.get(saida?.materialId) || null
  const usuario = maps.usuarios.get(saida?.usuarioResponsavel) || ""
  const statusNome = statusMap.get(saida?.status) || ""
  return {
    saida_id: saida?.id ?? "",
    pessoa_nome: trim(pessoa?.nome ?? ""),
    pessoa_matricula: trim(pessoa?.matricula ?? ""),
    material_resumo: formatMaterialSummary(material) || material?.nome || saida?.materialId || "",
    quantidade: saida?.quantidade ?? "",
    centro_label: buildCentroLabel(saida, maps),
    data_entrega: saida?.dataEntrega ?? null,
    data_troca: saida?.dataTroca ?? null,
    status: statusNome || "",
    registrado_por: usuario || "",
  }
}

const buildSignature = async (limite: any[], alerta: any[]) => {
  const sorter = (a: any, b: any) => {
    const aKey = `${a?.data_troca || ""}|${a?.saida_id || ""}|${a?.material_resumo || ""}`
    const bKey = `${b?.data_troca || ""}|${b?.saida_id || ""}|${b?.material_resumo || ""}`
    return aKey.localeCompare(bKey, "pt-BR")
  }
  const payload = JSON.stringify({
    limite: [...(limite ?? [])].sort(sorter),
    alerta: [...(alerta ?? [])].sort(sorter),
  })
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const assertRelatorioTrocaEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
}

export const runRelatorioTrocaEpi = async () => {
  assertRelatorioTrocaEnv()
  const { todayUtcMs, periodo, rangeStartIso, rangeEndIso } = resolveTodayContext()
  const owners = await fetchOwners()
  const statusMap = await loadStatusSaidaMap()

  const resultados: any[] = []
  for (const owner of owners ?? []) {
    const ownerId = owner?.id as string
    if (!ownerId) continue

    const ultimo = await loadLatestReport(ownerId)
    if (ultimo?.periodo_inicio === periodo && ultimo?.periodo_fim === periodo) {
      resultados.push({ ownerId, skipped: true, reason: "periodo_ja_registrado" })
      continue
    }

    const saidasRaw = await loadSaidasBase(ownerId, { start: rangeStartIso, end: rangeEndIso })
    if (!saidasRaw?.length) {
      resultados.push({ ownerId, skipped: true, reason: "sem_dados" })
      continue
    }

    const saidasComPrazo = (saidasRaw ?? [])
      .map((saida: any) => {
        const statusNome = statusMap.get(saida?.status) || ""
        const prazo = classifyTrocaPrazo(saida?.dataTroca, todayUtcMs)
        return {
          ...saida,
          statusNome,
          prazo,
        }
      })
      .filter((saida: any) => saida?.prazo && !isSaidaCancelada(saida?.statusNome || ""))

    if (!saidasComPrazo.length) {
      resultados.push({ ownerId, skipped: true, reason: "sem_alertas" })
      continue
    }

    const pessoasIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.pessoaId).filter(Boolean)),
    )
    const materiaisIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.materialId).filter(Boolean)),
    )
    const usuariosIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.usuarioResponsavel).filter(Boolean)),
    )
    const centrosEstoqueIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.centro_estoque).filter(Boolean)),
    )
    const centrosCustoIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.centro_custo).filter(Boolean)),
    )
    const centrosServicoIds = Array.from(
      new Set(saidasComPrazo.map((item: any) => item?.centro_servico).filter(Boolean)),
    )

    const [pessoas, materiais, usuarios, centrosEstoque, centrosCusto, centrosServico] = await Promise.all([
      loadPessoasMap(ownerId, pessoasIds),
      loadMateriaisMap(materiaisIds),
      loadUsuariosMap(ownerId, usuariosIds),
      loadCentrosMap(ownerId, "centros_estoque", centrosEstoqueIds, "almox"),
      loadCentrosMap(ownerId, "centros_custo", centrosCustoIds, "nome"),
      loadCentrosMap(ownerId, "centros_servico", centrosServicoIds, "nome"),
    ])

    const maps = {
      pessoas,
      materiais,
      usuarios,
      centrosEstoque,
      centrosCusto,
      centrosServico,
    }

    const limite: any[] = []
    const alerta: any[] = []
    for (const saida of saidasComPrazo ?? []) {
      const record = mapSaidaRecord(saida, maps, statusMap)
      if (saida?.prazo === "limite") {
        limite.push(record)
      } else if (saida?.prazo === "alerta") {
        alerta.push(record)
      }
    }

    const total = limite.length + alerta.length
    if (!total) {
      resultados.push({ ownerId, skipped: true, reason: "sem_alertas" })
      continue
    }

    const signature = await buildSignature(limite, alerta)
    const assinaturaAnterior = trim(ultimo?.metadados?.signature ?? "")
    if (assinaturaAnterior && assinaturaAnterior === signature) {
      resultados.push({ ownerId, skipped: true, reason: "sem_alteracoes" })
      continue
    }

    const metadados = {
      tipo: REPORT_TYPE_TROCA,
      origem: "auto",
      timezone: REPORT_TIMEZONE,
      periodo_ref: periodo,
      limite_total: limite.length,
      alerta_total: alerta.length,
      total,
      signature,
      gerado_em: new Date().toISOString(),
      limite,
      alerta,
    }

    const registro = await executeSingle(
      supabaseAdmin
        .from("inventory_report")
        .insert({
          account_owner_id: ownerId,
          created_by: ownerId,
          periodo_inicio: periodo,
          periodo_fim: periodo,
          termo: "",
          pareto_saida: {},
          pareto_risco: {},
          pareto_financeiro: {},
          metadados,
          arquivos_total: 0,
          email_status: EMAIL_STATUS_PENDENTE,
          email_enviado_em: null,
          email_erro: null,
          email_tentativas: 0,
        })
        .select("id, created_at"),
      "Falha ao registrar relatorio de troca.",
    )

    resultados.push({
      ownerId,
      reportId: registro?.id ?? null,
      periodo,
      limite: limite.length,
      alerta: alerta.length,
      total,
      email_status: EMAIL_STATUS_PENDENTE,
    })
  }

  return { ok: true, total: resultados.length, resultados }
}
