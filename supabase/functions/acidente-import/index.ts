// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-deno-execution-id, x-sb-request-id",
}

let stage = "init"
let sourcePath: string | null = null

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
const errorsBucket = Deno.env.get("ERRORS_BUCKET") || "imports"
const tzOffsetHours = Number(Deno.env.get("ACIDENTES_TZ_OFFSET") ?? "-3")

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
const SERVICE_NAME = "acidente-import"

const limitText = (value: unknown, max = 500) => {
  if (value === null || value === undefined) return ""
  const text = typeof value === "string" ? value : String(value)
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

const resolveSeverity = (status?: number | null) => (status && status >= 500 ? "error" : "warn")

const buildFingerprint = (service: string, message: string, stageValue?: string | null, status?: number | null) =>
  [service, message, stageValue ? `stage=${stageValue}` : "", status ? `status=${status}` : ""]
    .filter(Boolean)
    .join("|")
    .slice(0, 200)

const logApiError = async (payload: {
  message: string
  status?: number | null
  code?: string | null
  userId?: string | null
  stage?: string | null
  context?: Record<string, unknown> | null
  severity?: string | null
  stack?: string | null
  path?: string | null
  method?: string | null
}) => {
  try {
    const message = limitText(payload.message || "Erro desconhecido")
    const fingerprint = buildFingerprint(SERVICE_NAME, message, payload.stage, payload.status ?? null)
    await supabaseAdmin.from("api_errors").insert({
      environment: "api",
      service: SERVICE_NAME,
      method: payload.method ?? null,
      path: payload.path ?? null,
      status_code: payload.status ?? null,
      code: payload.code ?? null,
      user_id: payload.userId ?? null,
      message,
      stack: payload.stack ? limitText(payload.stack, 2000) : null,
      context: payload.context ?? null,
      severity: payload.severity ?? resolveSeverity(payload.status ?? null),
      fingerprint,
    })
  } catch (_) {
    // nao propaga falha de log
  }
}

type CatalogRow = { id: string; nome: string; ativo?: boolean | null; agente_id?: string | null }

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")

const resolveField = (row: Record<string, unknown>, targets: string[]) => {
  const targetKeys = targets.map(normalizeHeader)
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key)
    if (targetKeys.includes(normalized)) {
      return value
    }
  }
  return undefined
}

const normalizeLookupKey = (value?: unknown) => {
  if (value === null || value === undefined) return ""
  const raw = String(value).trim()
  if (!raw) return ""
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

const splitList = (value?: unknown) => {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean)
  }
  const raw = String(value).trim()
  if (!raw) return []
  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const parseDate = (value?: unknown) => {
  if (value === null || value === undefined) return null

  if (value instanceof Date && !isNaN(value.getTime())) {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, "0")
    const dd = String(value.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  if (typeof value === "number" && isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const ms = excelEpoch + value * 24 * 60 * 60 * 1000
    const date = new Date(ms)
    if (isNaN(date.getTime())) return null
    const yyyy = String(date.getUTCFullYear()).padStart(4, "0")
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(date.getUTCDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

const parseTime = (value?: unknown) => {
  if (value === null || value === undefined) return null

  if (value instanceof Date && !isNaN(value.getTime())) {
    const hh = String(value.getHours()).padStart(2, "0")
    const mm = String(value.getMinutes()).padStart(2, "0")
    return `${hh}:${mm}`
  }

  if (typeof value === "number" && isFinite(value)) {
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60)
      const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")
      const mm = String(totalMinutes % 60).padStart(2, "0")
      return `${hh}:${mm}`
    }
    if (value >= 1 && value < 24) {
      const hh = String(Math.floor(value)).padStart(2, "0")
      const mm = String(Math.round((value - Math.floor(value)) * 60)).padStart(2, "0")
      return `${hh}:${mm}`
    }
  }

  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hh = String(match[1]).padStart(2, "0")
  const mm = String(match[2]).padStart(2, "0")
  return `${hh}:${mm}`
}

const buildDateTimeIso = (dateStr: string, timeStr: string) => {
  const [yyyy, mm, dd] = dateStr.split("-").map((val) => Number(val))
  const [hh, min] = timeStr.split(":").map((val) => Number(val))
  if (!yyyy || !mm || !dd || Number.isNaN(hh) || Number.isNaN(min)) return null
  const utc = Date.UTC(yyyy, mm - 1, dd, hh - tzOffsetHours, min, 0)
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const buildDateKeyFromIso = (iso: string) => {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const local = new Date(ms + tzOffsetHours * 60 * 60 * 1000)
  const yyyy = local.getUTCFullYear()
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(local.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const buildUtcBoundaryFromDateKey = (dateKey: string, addDays = 0) => {
  const [yyyy, mm, dd] = dateKey.split("-").map((val) => Number(val))
  if (!yyyy || !mm || !dd) return null
  const utc = Date.UTC(yyyy, mm - 1, dd + addDays, 0 - tzOffsetHours, 0, 0)
  return new Date(utc).toISOString()
}

const integerOrNull = (value?: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Math.round(value)
  }
  const raw = String(value).trim()
  if (!raw) return null
  if (!/^-?\d+$/.test(raw)) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const hashText = async (value: string) => {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

const buildMatriculaKeys = (value?: string | number | null) => {
  const base = (value ?? "").toString().trim()
  if (!base) return []
  const noZeros = base.replace(/^0+/, "") || "0"
  const keys = new Set<string>()
  keys.add(base)
  keys.add(noZeros)
  return Array.from(keys)
}

const buildNameMap = (rows: CatalogRow[] | null) => {
  const map = new Map<string, CatalogRow>()
  ;(rows || []).forEach((row) => {
    const nome = normalizeLookupKey(row.nome)
    if (!nome || map.has(nome)) return
    map.set(nome, row)
  })
  return map
}

const normalizeError = (message: string) => message.toLowerCase()

const mapRpcError = (message: string) => {
  const normalized = normalizeError(message)
  if (normalized.includes("acidente_import_duplicate")) {
    return { column: "duplicado", reason: "registro ja importado" }
  }
  if (normalized.includes("acidente_cat_duplicate") || normalized.includes("cat")) {
    return { column: "cat", reason: "ja cadastrado" }
  }
  if (normalized.includes("acidente_agente_required")) {
    return { column: "agentes", reason: "obrigatorio" }
  }
  if (normalized.includes("acidente_tipos_lesoes_required")) {
    return { column: "tipos/lesoes", reason: "obrigatorio" }
  }
  if (normalized.includes("acidente_agentes_mismatch")) {
    return { column: "agentes", reason: "quantidade invalida" }
  }
  if (normalized.includes("acidente_tipos_invalidos")) {
    return { column: "tipos", reason: "inexistente" }
  }
  if (normalized.includes("acidente_lesoes_invalidas")) {
    return { column: "lesoes", reason: "inexistente" }
  }
  if (normalized.includes("acidente_partes_invalidas")) {
    return { column: "partes", reason: "inexistente" }
  }
  if (
    normalized.includes("does not exist") ||
    normalized.includes("column") ||
    normalized.includes("operator does not exist") ||
    normalized.includes("syntax error")
  ) {
    return { column: "db", reason: "erro interno" }
  }
  if (normalized.includes("local")) {
    return { column: "local", reason: "invalido" }
  }
  if (normalized.includes("centro")) {
    return { column: "centro_servico", reason: "invalido" }
  }
  if (normalized.includes("data")) {
    return { column: "data", reason: "invalida" }
  }
  return { column: "db", reason: message }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders })

    const requestPath = new URL(req.url).pathname
    const requestMethod = req.method
    const requestId =
      req.headers.get("x-sb-request-id") ||
      req.headers.get("x-request-id") ||
      req.headers.get("x-deno-execution-id") ||
      null
    const sessionId = req.headers.get("x-session-id") || null
    const logError = async (
      status: number,
      message: string,
      extraContext: Record<string, unknown> = {},
      userId: string | null = null,
      code: string | null = null,
      stack: string | null = null,
      severity?: string,
    ) => {
      await logApiError({
        message,
        status,
        code,
        userId,
        stage,
        stack,
        severity,
        method: requestMethod,
        path: requestPath,
        context: {
          ...extraContext,
          stage,
          function: SERVICE_NAME,
          bucket: errorsBucket,
          path: sourcePath,
          requestId,
          sessionId,
        },
      })
    }

    stage = "auth_header"
    const authHeader = req.headers.get("authorization") || ""
    const tokenMatch = authHeader.match(/Bearer\s+(.+)/i)
    const accessToken = tokenMatch?.[1]?.trim()
    if (!accessToken) {
      await logError(401, "Unauthorized")
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }

    stage = "auth_getUser"
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(accessToken)
    if (userErr || !userData?.user?.id) {
      await logError(401, "Unauthorized", { error: userErr?.message || null })
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }
    const importUserId = userData.user.id

    stage = "resolve_owner"
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })
    const { data: ownerId, error: ownerErr } = await supabaseUser.rpc("current_account_owner_id")
    const owner =
      typeof ownerId === "string" ? ownerId : (ownerId as { account_owner_id?: string } | null)?.account_owner_id
    if (ownerErr || !owner) {
      await logError(403, "Owner nao encontrado", { error: ownerErr?.message || null }, importUserId)
      return new Response("Owner nao encontrado", { status: 403, headers: corsHeaders })
    }

    stage = "read_body"
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      await logError(400, "Body precisa ser JSON: { path: string }", {}, importUserId)
      return new Response(
        JSON.stringify({ ok: false, stage, message: "Body precisa ser JSON: { path: string }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const path = body?.path
    if (!path || typeof path !== "string") {
      await logError(400, "path obrigatorio", {}, importUserId)
      return new Response("path obrigatorio", { status: 400, headers: corsHeaders })
    }
    if (!path.toLowerCase().endsWith(".xlsx")) {
      await logError(400, "Apenas XLSX", {}, importUserId)
      return new Response("Apenas XLSX", { status: 400, headers: corsHeaders })
    }
    sourcePath = path

    stage = "storage_download"
    const download = await supabaseAdmin.storage.from(errorsBucket).download(path)
    if (download.error || !download.data) {
      const msg = download.error?.message || "Falha ao baixar arquivo"
      await logError(400, msg, { error: download.error?.message || null }, importUserId)
      return new Response(msg, { status: 400, headers: corsHeaders })
    }

    stage = "xlsx_read"
    const buffer = new Uint8Array(await download.data.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "array" })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    const headerKeys = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : []

    stage = "catalog_centros_servico"
    const { data: centrosRaw, error: centrosErr } = await supabaseAdmin
      .from("centros_servico")
      .select("id, nome")
      .eq("account_owner_id", owner)
    if (centrosErr) {
      await logError(500, centrosErr.message, { error: centrosErr.message }, importUserId, centrosErr.code)
      return new Response(centrosErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_locais"
    const { data: locaisRaw, error: locaisErr } = await supabaseAdmin
      .from("acidente_locais")
      .select("id, nome, ativo")
    if (locaisErr) {
      await logError(500, locaisErr.message, { error: locaisErr.message }, importUserId, locaisErr.code)
      return new Response(locaisErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_agentes"
    const { data: agentesRaw, error: agentesErr } = await supabaseAdmin
      .from("acidente_agentes")
      .select("id, nome, ativo")
    if (agentesErr) {
      await logError(500, agentesErr.message, { error: agentesErr.message }, importUserId, agentesErr.code)
      return new Response(agentesErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_tipos"
    const { data: tiposRaw, error: tiposErr } = await supabaseAdmin
      .from("acidente_tipos")
      .select("id, nome, agente_id, ativo")
    if (tiposErr) {
      await logError(500, tiposErr.message, { error: tiposErr.message }, importUserId, tiposErr.code)
      return new Response(tiposErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_lesoes"
    const { data: lesoesRaw, error: lesoesErr } = await supabaseAdmin
      .from("acidente_lesoes")
      .select("id, nome, agente_id, ativo")
    if (lesoesErr) {
      await logError(500, lesoesErr.message, { error: lesoesErr.message }, importUserId, lesoesErr.code)
      return new Response(lesoesErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_partes"
    const { data: partesRaw, error: partesErr } = await supabaseAdmin
      .from("acidente_partes")
      .select("id, nome, ativo")
    if (partesErr) {
      await logError(500, partesErr.message, { error: partesErr.message }, importUserId, partesErr.code)
      return new Response(partesErr.message, { status: 500, headers: corsHeaders })
    }

    const centrosMap = buildNameMap(centrosRaw as CatalogRow[] | null)
    const locaisMap = buildNameMap(
      (locaisRaw as CatalogRow[] | null)?.filter((item) => item?.ativo !== false) ?? null,
    )
    const agentesAtivos = (agentesRaw as CatalogRow[] | null)?.filter((item) => item?.ativo !== false) ?? null
    const agentesMap = buildNameMap(agentesAtivos)
    const partesMap = buildNameMap(
      (partesRaw as CatalogRow[] | null)?.filter((item) => item?.ativo !== false) ?? null,
    )

    const tiposMap = new Map<string, string>()
    const tiposByName = new Map<string, Set<string>>()
    ;(tiposRaw as CatalogRow[] | null)?.forEach((row) => {
      if (row?.ativo === false) return
      if (!row?.agente_id) return
      const nome = normalizeLookupKey(row.nome)
      if (!nome) return
      tiposMap.set(`${row.agente_id}::${nome}`, row.id)
      if (!tiposByName.has(nome)) {
        tiposByName.set(nome, new Set())
      }
      tiposByName.get(nome)?.add(row.agente_id)
    })

    const lesoesMap = new Map<string, string>()
    const lesoesByName = new Map<string, Set<string>>()
    ;(lesoesRaw as CatalogRow[] | null)?.forEach((row) => {
      if (row?.ativo === false) return
      if (!row?.agente_id) return
      const nome = normalizeLookupKey(row.nome)
      if (!nome) return
      lesoesMap.set(`${row.agente_id}::${nome}`, row.id)
      if (!lesoesByName.has(nome)) {
        lesoesByName.set(nome, new Set())
      }
      lesoesByName.get(nome)?.add(row.agente_id)
    })

    const formatMismatch = (agenteLabel: string, valor: string) =>
      `nao pertence ao agente (${agenteLabel}): ${valor}`

    const matriculasArquivo = new Set<string>()
    rows.forEach((linha) => {
      const valor = resolveField(linha, ["matricula"])
      const matricula = valor === null || valor === undefined ? "" : String(valor).trim()
      buildMatriculaKeys(matricula).forEach((k) => matriculasArquivo.add(k))
    })

    stage = "db_select_pessoas"
    const matriculaMap = new Map<string, string>()
    if (matriculasArquivo.size > 0) {
      const chunkSize = 100
      const matriculasArray = Array.from(matriculasArquivo)
      for (let i = 0; i < matriculasArray.length; i += chunkSize) {
        const slice = matriculasArray.slice(i, i + chunkSize)
        const { data: pessoas, error: pessoasErr } = await supabaseAdmin
          .from("pessoas")
          .select("id, matricula")
          .eq("account_owner_id", owner)
          .in("matricula", slice)
        if (pessoasErr) {
          await logError(500, pessoasErr.message, { error: pessoasErr.message }, importUserId, pessoasErr.code)
          return new Response(pessoasErr.message, { status: 500, headers: corsHeaders })
        }
        ;(pessoas || []).forEach((p) => {
          buildMatriculaKeys(p.matricula).forEach((key) => matriculaMap.set(key, p.id))
        })
      }
    }

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,matricula,coluna,motivo"]
    const duplicateKeys = new Set<string>()
    const existingAccidentes = new Map<string, string>()

    const pushError = (line: number, matricula: string, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},"${matricula}",${col},"${motivo}"`)
    }

    if (matriculaMap.size && rows.length) {
      const pessoasSet = new Set<string>()
      const dateKeys: string[] = []
      rows.forEach((linha) => {
        const matriculaRaw = resolveField(linha, ["matricula"])
        const matricula = matriculaRaw === null || matriculaRaw === undefined ? "" : String(matriculaRaw).trim()
        if (!matricula) return
        const pessoaId = buildMatriculaKeys(matricula).map((k) => matriculaMap.get(k)).find(Boolean)
        if (!pessoaId) return
        const dataRaw = resolveField(linha, ["data", "data_acidente", "data_do_acidente"])
        const dataStr = parseDate(dataRaw)
        if (!dataStr) return
        pessoasSet.add(pessoaId)
        dateKeys.push(dataStr)
      })

      if (pessoasSet.size && dateKeys.length) {
        const minDate = dateKeys.reduce((min, val) => (val < min ? val : min), dateKeys[0])
        const maxDate = dateKeys.reduce((max, val) => (val > max ? val : max), dateKeys[0])
        const rangeStart = buildUtcBoundaryFromDateKey(minDate)
        const rangeEnd = buildUtcBoundaryFromDateKey(maxDate, 1)
        if (rangeStart && rangeEnd) {
          const pessoasArray = Array.from(pessoasSet)
          const chunkSize = 100
          for (let i = 0; i < pessoasArray.length; i += chunkSize) {
            const slice = pessoasArray.slice(i, i + chunkSize)
            const { data: acidentesRaw, error: acidentesErr } = await supabaseAdmin
              .from("accidents")
              .select("id, people_id, accident_date")
              .eq("account_owner_id", owner)
              .in("people_id", slice)
              .gte("accident_date", rangeStart)
              .lt("accident_date", rangeEnd)
            if (acidentesErr) {
              await logError(500, acidentesErr.message, { error: acidentesErr.message }, importUserId, acidentesErr.code)
              return new Response(acidentesErr.message, { status: 500, headers: corsHeaders })
            }
            ;(acidentesRaw || []).forEach((acidente) => {
              const dateKey = acidente?.accident_date ? buildDateKeyFromIso(acidente.accident_date) : null
              if (!dateKey || !acidente?.people_id || !acidente?.id) return
              existingAccidentes.set(`${acidente.people_id}::${dateKey}`, acidente.id)
            })
          }
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const matriculaRaw = resolveField(linha, ["matricula"])
      const matricula = matriculaRaw === null || matriculaRaw === undefined ? "" : String(matriculaRaw).trim()
      if (!matricula) {
        pushError(idx, matricula, "matricula", "obrigatoria")
        continue
      }
      const pessoaId = buildMatriculaKeys(matricula).map((k) => matriculaMap.get(k)).find(Boolean)
      if (!pessoaId) {
        pushError(idx, matricula, "matricula", "nao encontrada")
        continue
      }

      const dataRaw = resolveField(linha, ["data", "data_acidente", "data_do_acidente"])
      const dataStr = parseDate(dataRaw)
      if (!dataStr) {
        pushError(idx, matricula, "data", "invalida")
        continue
      }

      const horaRaw = resolveField(linha, ["hora", "hora_acidente"])
      const horaStr = parseTime(horaRaw)
      if (!horaStr) {
        pushError(idx, matricula, "hora", "invalida")
        continue
      }

      const dataIso = buildDateTimeIso(dataStr, horaStr)
      if (!dataIso) {
        pushError(idx, matricula, "data", "invalida")
        continue
      }

      const duplicateKey = `${pessoaId}::${dataStr}`
      if (existingAccidentes.has(duplicateKey)) {
        pushError(
          idx,
          matricula,
          "data",
          `ja existe acidente nessa data (id=${existingAccidentes.get(duplicateKey)})`,
        )
        continue
      }
      if (duplicateKeys.has(duplicateKey)) {
        pushError(idx, matricula, "data", "duplicado na planilha")
        continue
      }

      const diasDebitadosRaw = resolveField(linha, ["dias_debitados", "diasdebitados"])
      const diasPerdidosRaw = resolveField(linha, ["dias_perdidos", "diasperdidos"])
      const diasDebitados = integerOrNull(diasDebitadosRaw)
      const diasPerdidos = integerOrNull(diasPerdidosRaw)
      if (diasDebitados === null) {
        pushError(idx, matricula, "dias_debitados", "invalido")
        continue
      }
      if (diasPerdidos === null) {
        pushError(idx, matricula, "dias_perdidos", "invalido")
        continue
      }

      const centroRaw = resolveField(linha, ["centro_servico", "centroservico"])
      const centroNome = normalizeLookupKey(centroRaw)
      if (!centroNome) {
        pushError(idx, matricula, "centro_servico", "obrigatorio")
        continue
      }
      const centro = centrosMap.get(centroNome)
      if (!centro?.id) {
        pushError(idx, matricula, "centro_servico", "inexistente")
        continue
      }

      const localRaw = resolveField(linha, ["local"])
      const localNome = normalizeLookupKey(localRaw)
      if (!localNome) {
        pushError(idx, matricula, "local", "obrigatorio")
        continue
      }
      const local = locaisMap.get(localNome)
      if (!local?.id) {
        pushError(idx, matricula, "local", "inexistente")
        continue
      }

      const agentesRaw = resolveField(linha, ["agentes", "agente"])
      const tiposRaw = resolveField(linha, ["tipos", "tipo"])
      const lesoesRaw = resolveField(linha, ["lesoes", "lesao"])
      const partesRaw = resolveField(linha, ["partes", "partes_lesionadas"])

      const agentes = splitList(agentesRaw)
      if (!agentes.length) {
        pushError(idx, matricula, "agentes", "obrigatorio")
        continue
      }

      const tipos = splitList(tiposRaw)
      const lesoes = splitList(lesoesRaw)
      if (!tipos.length && !lesoes.length) {
        pushError(idx, matricula, "tipos/lesoes", "obrigatorio")
        continue
      }
      if (tipos.length > agentes.length) {
        pushError(idx, matricula, "tipos", "quantidade maior que agentes")
        continue
      }
      if (lesoes.length > agentes.length) {
        pushError(idx, matricula, "lesoes", "quantidade maior que agentes")
        continue
      }

      const partes = splitList(partesRaw)
      if (!partes.length) {
        pushError(idx, matricula, "partes", "obrigatorio")
        continue
      }

      const agentesIds: (string | null)[] = []
      const tiposIds: (string | null)[] = []
      const lesoesIds: (string | null)[] = []

      for (let a = 0; a < agentes.length; a += 1) {
        const agenteNome = normalizeLookupKey(agentes[a])
        const agente = agentesMap.get(agenteNome)
        if (!agente?.id) {
          pushError(idx, matricula, "agentes", `inexistente (${agentes[a]})`)
          agentesIds.length = 0
          break
        }
        agentesIds.push(agente.id)

        const tipoNome = tipos[a] ? normalizeLookupKey(tipos[a]) : ""
        if (tipoNome) {
          const tipoId = tiposMap.get(`${agente.id}::${tipoNome}`)
          if (!tipoId) {
            if (tiposByName.get(tipoNome)?.size) {
              pushError(idx, matricula, "tipos", formatMismatch(agentes[a] || agente.nome || "agente", tipos[a]))
            } else {
              pushError(idx, matricula, "tipos", `inexistente (${tipos[a]})`)
            }
            agentesIds.length = 0
            break
          }
          tiposIds.push(tipoId)
        } else {
          tiposIds.push(null)
        }

        const lesaoNome = lesoes[a] ? normalizeLookupKey(lesoes[a]) : ""
        if (lesaoNome) {
          const lesaoId = lesoesMap.get(`${agente.id}::${lesaoNome}`)
          if (!lesaoId) {
            if (lesoesByName.get(lesaoNome)?.size) {
              pushError(idx, matricula, "lesoes", formatMismatch(agentes[a] || agente.nome || "agente", lesoes[a]))
            } else {
              pushError(idx, matricula, "lesoes", `inexistente (${lesoes[a]})`)
            }
            agentesIds.length = 0
            break
          }
          lesoesIds.push(lesaoId)
        } else {
          lesoesIds.push(null)
        }
      }

      if (!agentesIds.length) {
        continue
      }

      const partesIds: string[] = []
      let partesInvalidas = false
      for (const parte of partes) {
        const parteNome = normalizeLookupKey(parte)
        const parteRow = partesMap.get(parteNome)
        if (!parteRow?.id) {
          pushError(idx, matricula, "partes", `inexistente (${parte})`)
          partesInvalidas = true
          break
        }
        partesIds.push(parteRow.id)
      }
      if (partesInvalidas) {
        continue
      }

      const catRaw = resolveField(linha, ["cat"])
      const cidRaw = resolveField(linha, ["cid"])
      const observacaoRaw = resolveField(linha, ["observacao", "obs"])

      const cat = catRaw === null || catRaw === undefined ? "" : String(catRaw).trim()
      if (cat && !/^\d+$/.test(cat)) {
        pushError(idx, matricula, "cat", "apenas numeros")
        continue
      }

      const cid = cidRaw === null || cidRaw === undefined ? "" : String(cidRaw).trim()
      const observacao = observacaoRaw === null || observacaoRaw === undefined
        ? ""
        : String(observacaoRaw).trim()

      const importHash = await hashText(
        [
          pessoaId,
          dataIso,
          String(diasPerdidos),
          String(diasDebitados),
          centro.id,
          local.id,
          agentesIds.join(","),
          tiposIds.map((v) => v ?? "").join(","),
          lesoesIds.map((v) => v ?? "").join(","),
          partesIds.join(","),
          cat,
          cid,
          observacao,
        ].join("|"),
      )

      stage = "db_insert_acidente"
      const { error: insertErr } = await supabaseUser.rpc("rpc_acidentes_create_full", {
        p_pessoa_id: pessoaId,
        p_data: dataIso,
        p_dias_perdidos: diasPerdidos,
        p_dias_debitados: diasDebitados,
        p_cid: cid,
        p_centro_servico_id: centro.id,
        p_local_id: local.id,
        p_cat: cat,
        p_observacao: observacao,
        p_agentes_ids: agentesIds,
        p_tipos_ids: tiposIds,
        p_lesoes_ids: lesoesIds,
        p_partes_ids: partesIds,
        p_registrado_por: importUserId,
        p_import_hash: importHash,
      })
      if (insertErr) {
        const mapped = mapRpcError(insertErr.message || "erro")
        pushError(idx, matricula, mapped.column, mapped.reason)
        continue
      }
      duplicateKeys.add(duplicateKey)
      success += 1
    }

    let errorsUrl: string | null = null
    const errorSamples: string[] = []
    const deleteSource = async () => {
      try {
        stage = "storage_delete_source"
        if (sourcePath) {
          await supabaseAdmin.storage.from(errorsBucket).remove([sourcePath])
        }
      } catch (_) {
        // best-effort cleanup
      }
    }

    if (errorLines.length > 1) {
      stage = "storage_upload_erros"
      errorSamples.push(...errorLines.slice(1, Math.min(errorLines.length, 6)))
      const csv = errorLines.join("\n")
      const key = `acidente_erros_${crypto.randomUUID()}.csv`
      await supabaseAdmin.storage.from(errorsBucket).upload(key, new TextEncoder().encode(csv), {
        contentType: "text/csv",
      })
      const signed = await supabaseAdmin.storage.from(errorsBucket).createSignedUrl(key, 60 * 60)
      errorsUrl = signed.data?.signedUrl || null

      await deleteSource()

      await logError(
        200,
        "Importacao concluida com erros",
        {
          processed,
          success,
          errors,
          errorsUrl,
          firstError: errorLines[1],
          errorSamples,
        },
        importUserId,
        "IMPORT_PARTIAL",
        null,
        "warn",
      )

      return new Response(
        JSON.stringify({
          processed,
          success,
          errors,
          errorsUrl,
          firstError: errorLines[1],
          errorSamples,
          debug: {
            headerKeys,
            agentes: agentesMap.size,
            tipos: tiposMap.size,
            lesoes: lesoesMap.size,
            partes: partesMap.size,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    stage = "response_success"
    await deleteSource()
    return new Response(
      JSON.stringify({
        processed,
        success,
        errors,
        errorsUrl: null,
        firstError: null,
        errorSamples: [],
        debug: {
          headerKeys,
          agentes: agentesMap.size,
          tipos: tiposMap.size,
          lesoes: lesoesMap.size,
          partes: partesMap.size,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    if (sourcePath) {
      try {
        stage = "storage_delete_source"
        await supabaseAdmin.storage.from(errorsBucket).remove([sourcePath])
      } catch (_) {
        // ignore
      }
    }
    const e = err instanceof Error ? err : new Error(String(err))
    console.error("acidente-import error", stage, e.message, e.stack)
    await logApiError({
      message: e.message,
      status: 500,
      userId: null,
      stage,
      stack: e.stack ?? null,
      severity: "error",
      method: req.method,
      path: new URL(req.url).pathname,
      context: {
        stage,
        function: SERVICE_NAME,
        bucket: errorsBucket,
        path: sourcePath,
        requestId: req.headers.get("x-sb-request-id") ||
          req.headers.get("x-request-id") ||
          req.headers.get("x-deno-execution-id") ||
          null,
        sessionId: req.headers.get("x-session-id") || null,
      },
    })
    return new Response(
      JSON.stringify({
        ok: false,
        stage,
        message: e.message,
        stack: e.stack,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})

