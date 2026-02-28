// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { resolveImportSizeLimit, resolveStorageObjectSize } from "../_shared/importLimits.ts"

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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
const SERVICE_NAME = "cadastro-import"
const RATE_LIMIT_WINDOW_SECONDS = 60
const DAILY_LIMIT_CATEGORY = "import"
const RATE_LIMIT_WINDOW_CODE = "RATE_LIMIT_WINDOW"
const RATE_LIMIT_WINDOW_MESSAGE = "Limite de 1 requisicao a cada 60 segundos."
const DAILY_LIMIT_CODE = "DAILY_LIMIT_BLOCK"
const DAILY_LIMIT_MESSAGE = "Limite diario do plano bloqueado."

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

type CatalogRow = { id: string; nome: string; centro_custo_id?: string | null }

// Accepts dd/MM/yyyy text, Excel serial or Date.
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

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const resolveField = (row: Record<string, unknown>, target: string) => {
  const targetKey = normalizeHeader(target)
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === targetKey) {
      return value
    }
  }
  return undefined
}

const normalizeTextUpper = (value?: unknown) => {
  if (value === null || value === undefined) return ""
  const raw = String(value).trim()
  if (!raw) return ""
  return raw.replace(/\s+/g, " ").toUpperCase()
}

const normalizeMatricula = (value?: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && isFinite(value)) {
    if (!Number.isInteger(value)) return null
    return String(value)
  }
  const raw = String(value).trim()
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, "")
  if (!/^\d+$/.test(cleaned)) return null
  return cleaned
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

const buildCatalogMap = (rows: CatalogRow[] | null) => {
  const map = new Map<string, CatalogRow>()
  ;(rows || []).forEach((row) => {
    const key = normalizeTextUpper(row.nome)
    if (key && !map.has(key)) {
      map.set(key, row)
    }
  })
  return map
}

Deno.serve(async (req) => {
  let owner: string | null = null
  let importUserId: string | null = null
  let dailyLimitChecked = false
  let dailyResultRegistered = false
  try {
    const requestPath = new URL(req.url).pathname
    const requestMethod = req.method
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
        },
      })
    }

    const registerDailyResult = async (success: boolean) => {
      if (!owner) return
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/edge_rate_limit_daily_register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({ p_owner_id: owner, p_category: DAILY_LIMIT_CATEGORY, p_success: success }),
        })
        if (!response.ok) {
          const errorText = await response.text()
          await logError(
            500,
            "Falha ao registrar consumo diario.",
            { status: response.status, error: errorText },
            importUserId,
            "DAILY_LIMIT_REGISTER_ERROR",
          )
          return
        }
        const data = await response.json()
        const result = Array.isArray(data) ? data[0] : data
        if (!success && result?.error_count === 3 && result?.locked_until) {
          await logError(
            429,
            "Limite diario bloqueado ate meia-noite (America/Sao_Paulo).",
            { lockedUntil: result.locked_until },
            importUserId,
            DAILY_LIMIT_CODE,
            null,
            "warn",
          )
        }
      } catch (error) {
        await logError(
          500,
          "Falha ao registrar consumo diario.",
          { error: error instanceof Error ? error.message : String(error) },
          importUserId,
          "DAILY_LIMIT_REGISTER_ERROR",
        )
      }
    }

    const respond = async (body: BodyInit | null, init?: ResponseInit) => {
      const response = new Response(body, init)
      if (dailyLimitChecked && !dailyResultRegistered && owner) {
        await registerDailyResult(response.ok)
        dailyResultRegistered = true
      }
      return response
    }

    if (req.method === "OPTIONS") return respond("ok", { headers: corsHeaders })
    if (req.method !== "POST") return respond("Method not allowed", { status: 405, headers: corsHeaders })

    stage = "auth_header"
    const authHeader = req.headers.get("authorization") || ""
    const tokenMatch = authHeader.match(/Bearer\s+(.+)/i)
    const accessToken = tokenMatch?.[1]?.trim()
    if (!accessToken) {
      await logError(401, "Unauthorized")
      return respond("Unauthorized", { status: 401, headers: corsHeaders })
    }

    stage = "auth_getUser"
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(accessToken)
    if (userErr || !userData?.user?.id) {
      await logError(401, "Unauthorized", { error: userErr?.message || null })
      return respond("Unauthorized", { status: 401, headers: corsHeaders })
    }
    importUserId = userData.user.id

    stage = "resolve_owner"
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })
    const { data: ownerId, error: ownerErr } = await supabaseUser.rpc("current_account_owner_id")
    owner = typeof ownerId === "string" ? ownerId : (ownerId as { account_owner_id?: string } | null)?.account_owner_id
    if (ownerErr || !owner) {
      await logError(403, "Owner nao encontrado", { error: ownerErr?.message || null }, importUserId)
      return respond("Owner nao encontrado", { status: 403, headers: corsHeaders })
    }

    const enforceRateLimit = async () => {
      const now = new Date()
      const windowStartSeconds =
        Math.floor(now.getTime() / 1000 / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS
      const windowStart = new Date(windowStartSeconds * 1000).toISOString()

      const response = await fetch(`${supabaseUrl}/rest/v1/edge_rate_limits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          account_owner_id: owner,
          function_name: SERVICE_NAME,
          window_start: windowStart,
        }),
      })

      if (response.ok) return null

      const text = await response.text()
      if (response.status === 409 || text.includes("23505")) {
        await logError(
          429,
          RATE_LIMIT_WINDOW_MESSAGE,
          { windowStart, functionName: SERVICE_NAME },
          importUserId,
          RATE_LIMIT_WINDOW_CODE,
          null,
          "warn",
        )
        return respond(RATE_LIMIT_WINDOW_MESSAGE, {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) },
        })
      }

      await logError(
        500,
        "Falha ao validar limite de requisicoes.",
        { status: response.status, error: text },
        importUserId,
        RATE_LIMIT_WINDOW_CODE,
      )
      return respond("Falha ao validar limite de requisicoes.", { status: 500, headers: corsHeaders })
    }

    const enforceDailyLimit = async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/edge_rate_limit_daily_check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({ p_owner_id: owner, p_category: DAILY_LIMIT_CATEGORY }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        await logError(
          500,
          "Falha ao validar limite diario do plano.",
          { status: response.status, error: errorText },
          importUserId,
          "DAILY_LIMIT_CHECK_ERROR",
        )
        return respond("Falha ao validar limite diario do plano.", { status: 500, headers: corsHeaders })
      }

      const data = await response.json()
      const result = Array.isArray(data) ? data[0] : data
      if (!result) {
        await logError(500, "Falha ao validar limite diario do plano.", {}, importUserId, "DAILY_LIMIT_CHECK_ERROR")
        return respond("Falha ao validar limite diario do plano.", { status: 500, headers: corsHeaders })
      }
      if (result.allowed === true) return null

      const reason = String(result.reason || "")
      if (reason === "limit_not_configured") {
        await logError(
          403,
          "Limite diario do plano nao configurado.",
          { category: DAILY_LIMIT_CATEGORY, dayDate: result.day_date },
          importUserId,
          DAILY_LIMIT_CODE,
        )
        return respond("Limite diario do plano nao configurado.", { status: 403, headers: corsHeaders })
      }
      if (reason === "plan_not_found") {
        await logError(403, "Plano nao encontrado.", { category: DAILY_LIMIT_CATEGORY }, importUserId, DAILY_LIMIT_CODE)
        return respond("Plano nao encontrado.", { status: 403, headers: corsHeaders })
      }
      if (reason === "locked") {
        await logError(
          429,
          DAILY_LIMIT_MESSAGE,
          { category: DAILY_LIMIT_CATEGORY, dayDate: result.day_date, lockedUntil: result.locked_until },
          importUserId,
          DAILY_LIMIT_CODE,
          null,
          "warn",
        )
        return respond("Limite diario bloqueado ate meia-noite (America/Sao_Paulo).", {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": "3600" },
        })
      }
      if (reason === "limit_reached") {
        await logError(
          429,
          DAILY_LIMIT_MESSAGE,
          { category: DAILY_LIMIT_CATEGORY, dayDate: result.day_date },
          importUserId,
          DAILY_LIMIT_CODE,
          null,
          "warn",
        )
        return respond("Limite diario do plano atingido.", {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": "3600" },
        })
      }

      await logError(
        429,
        DAILY_LIMIT_MESSAGE,
        { category: DAILY_LIMIT_CATEGORY, reason },
        importUserId,
        DAILY_LIMIT_CODE,
        null,
        "warn",
      )
      return respond("Limite diario do plano nao permitido.", {
        status: 429,
        headers: { ...corsHeaders, "Retry-After": "3600" },
      })
    }

    const rateLimitResponse = await enforceRateLimit()
    if (rateLimitResponse) return rateLimitResponse

    const dailyLimitResponse = await enforceDailyLimit()
    if (dailyLimitResponse) return dailyLimitResponse
    dailyLimitChecked = true

    stage = "read_body"
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      await logError(400, "Body precisa ser JSON: { path: string }", {}, importUserId)
      return respond(
        JSON.stringify({ ok: false, stage, message: "Body precisa ser JSON: { path: string }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const path = body?.path
    if (!path || typeof path !== "string") {
      await logError(400, "path obrigatorio", {}, importUserId)
      return respond("path obrigatorio", { status: 400, headers: corsHeaders })
    }
    if (!path.toLowerCase().endsWith(".xlsx")) {
      await logError(400, "Apenas XLSX", {}, importUserId)
      return respond("Apenas XLSX", { status: 400, headers: corsHeaders })
    }
    const modeRaw = typeof body?.mode === "string" ? body.mode.trim().toLowerCase() : "insert"
    const updateMode = modeRaw === "update"
    const normalizedPath = path.replace(/^\/+/, "")
    if (!normalizedPath.startsWith(`${owner}/`)) {
      await logError(403, "Path fora do owner", { path: normalizedPath }, importUserId)
      return respond("Path fora do owner", { status: 403, headers: corsHeaders })
    }
    sourcePath = normalizedPath

    stage = "import_plan_limit"
    const limitInfo = await resolveImportSizeLimit(supabaseAdmin, owner)
    if (limitInfo.error) {
      await logError(
        500,
        "Falha ao validar limite de tamanho do plano.",
        { error: limitInfo.error, planId: limitInfo.planId },
        importUserId,
        "IMPORT_SIZE_PLAN_ERROR",
      )
      return respond("Falha ao validar limite de tamanho do plano.", {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (!limitInfo.limitBytes || !limitInfo.limitMb) {
      await logError(
        403,
        "Limite de tamanho do plano nao configurado.",
        { planId: limitInfo.planId },
        importUserId,
        "IMPORT_SIZE_PLAN_NOT_CONFIGURED",
      )
      return respond("Limite de tamanho do plano nao configurado.", {
        status: 403,
        headers: corsHeaders,
      })
    }

    stage = "import_size_check"
    const sizeInfo = await resolveStorageObjectSize(supabaseUrl, serviceRoleKey, errorsBucket, normalizedPath)
    if (sizeInfo.sizeBytes === null || sizeInfo.error) {
      await logError(
        500,
        "Falha ao validar tamanho do arquivo.",
        { error: sizeInfo.error, status: sizeInfo.status, path: normalizedPath },
        importUserId,
        "IMPORT_SIZE_CHECK_FAILED",
      )
      return respond("Falha ao validar tamanho do arquivo.", {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (sizeInfo.sizeBytes > limitInfo.limitBytes) {
      await logError(
        413,
        "Arquivo excede limite de tamanho.",
        {
          sizeBytes: sizeInfo.sizeBytes,
          limitBytes: limitInfo.limitBytes,
          limitMb: limitInfo.limitMb,
          path: normalizedPath,
        },
        importUserId,
        "IMPORT_SIZE_LIMIT",
      )
      return respond(`Arquivo excede o limite de ${limitInfo.limitMb}MB.`, {
        status: 413,
        headers: corsHeaders,
      })
    }

    stage = "storage_download"
    const download = await supabaseAdmin.storage.from(errorsBucket).download(sourcePath)
    if (download.error || !download.data) {
      const msg = download.error?.message || "Falha ao baixar arquivo"
      await logError(400, msg, { error: download.error?.message || null }, importUserId)
      return respond(msg, { status: 400, headers: corsHeaders })
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
      .select("id, nome, centro_custo_id")
      .eq("account_owner_id", owner)
    if (centrosErr) {
      await logError(500, centrosErr.message, { error: centrosErr.message }, importUserId, centrosErr.code)
      return respond(centrosErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_setores"
    const { data: setoresRaw, error: setoresErr } = await supabaseAdmin
      .from("setores")
      .select("id, nome")
      .eq("account_owner_id", owner)
    if (setoresErr) {
      await logError(500, setoresErr.message, { error: setoresErr.message }, importUserId, setoresErr.code)
      return respond(setoresErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_cargos"
    const { data: cargosRaw, error: cargosErr } = await supabaseAdmin
      .from("cargos")
      .select("id, nome")
      .eq("account_owner_id", owner)
    if (cargosErr) {
      await logError(500, cargosErr.message, { error: cargosErr.message }, importUserId, cargosErr.code)
      return respond(cargosErr.message, { status: 500, headers: corsHeaders })
    }

    stage = "catalog_tipo_execucao"
    const { data: tiposRaw, error: tiposErr } = await supabaseAdmin.from("tipo_execucao").select("id, nome")
    if (tiposErr) {
      await logError(500, tiposErr.message, { error: tiposErr.message }, importUserId, tiposErr.code)
      return respond(tiposErr.message, { status: 500, headers: corsHeaders })
    }

    const centrosMap = buildCatalogMap(centrosRaw as CatalogRow[] | null)
    const setoresMap = buildCatalogMap(setoresRaw as CatalogRow[] | null)
    const cargosMap = buildCatalogMap(cargosRaw as CatalogRow[] | null)
    const tiposMap = buildCatalogMap(tiposRaw as CatalogRow[] | null)

    const matriculasArquivo = new Set<string>()
    rows.forEach((linha) => {
      const valor = resolveField(linha, "matricula")
      const matricula = normalizeMatricula(valor)
      if (!matricula) return
      buildMatriculaKeys(matricula).forEach((key) => matriculasArquivo.add(key))
    })

    stage = "db_select_existing"
    const existingMap = new Map<string, string>()
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
          return respond(pessoasErr.message, { status: 500, headers: corsHeaders })
        }
        ;(pessoas || []).forEach((p) => {
          buildMatriculaKeys(p.matricula).forEach((key) => existingMap.set(key, p.id))
        })
      }
    }

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,matricula,coluna,motivo"]
    const inserts: { line: number; matricula: string; data: Record<string, unknown> }[] = []
    const updates: { line: number; id: string; matricula: string; data: Record<string, unknown> }[] = []
    const seenMatriculas = new Set<string>()
    const now = new Date().toISOString()

    const pushError = (line: number, matricula: string, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},"${matricula}",${col},"${motivo}"`)
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const matriculaRaw = resolveField(linha, "matricula")
      const matricula = normalizeMatricula(matriculaRaw)
      const matriculaTexto = matricula ?? ""

      const matriculaDisplay = matriculaTexto || (matriculaRaw === null || matriculaRaw === undefined ? "" : String(matriculaRaw).trim())

      if (!matriculaTexto) {
        const rawText = matriculaRaw === null || matriculaRaw === undefined ? "" : String(matriculaRaw).trim()
        pushError(idx, matriculaDisplay, "matricula", rawText ? "deve ser numerica" : "obrigatoria")
        continue
      }

      const baseKey = matriculaTexto.replace(/^0+/, "") || "0"
      if (seenMatriculas.has(baseKey)) {
        pushError(idx, matriculaDisplay, "matricula", "duplicada")
        continue
      }
      seenMatriculas.add(baseKey)

      const matriculaKeys = buildMatriculaKeys(matriculaTexto)
      const existingId = matriculaKeys.map((key) => existingMap.get(key)).find(Boolean) || null
      if (updateMode && !existingId) {
        pushError(idx, matriculaDisplay, "matricula", "nao encontrada")
        continue
      }
      if (!updateMode && existingId) {
        pushError(idx, matriculaDisplay, "matricula", "ja existe")
        continue
      }

      const nome = normalizeTextUpper(resolveField(linha, "nome"))
      if (!nome) {
        pushError(idx, matriculaDisplay, "nome", "obrigatorio")
        continue
      }

      const centroNome = normalizeTextUpper(resolveField(linha, "centro_servico"))
      if (!centroNome) {
        pushError(idx, matriculaDisplay, "centro_servico", "obrigatorio")
        continue
      }
      const centro = centrosMap.get(centroNome)
      if (!centro?.id) {
        pushError(idx, matriculaDisplay, "centro_servico", "inexistente")
        continue
      }
      if (!centro.centro_custo_id) {
        pushError(idx, matriculaDisplay, "centro_servico", "centro_custo nao encontrado")
        continue
      }

      const setorNome = normalizeTextUpper(resolveField(linha, "setor"))
      if (!setorNome) {
        pushError(idx, matriculaDisplay, "setor", "obrigatorio")
        continue
      }
      const setor = setoresMap.get(setorNome)
      if (!setor?.id) {
        pushError(idx, matriculaDisplay, "setor", "inexistente")
        continue
      }

      const cargoNome = normalizeTextUpper(resolveField(linha, "cargo"))
      if (!cargoNome) {
        pushError(idx, matriculaDisplay, "cargo", "obrigatorio")
        continue
      }
      const cargo = cargosMap.get(cargoNome)
      if (!cargo?.id) {
        pushError(idx, matriculaDisplay, "cargo", "inexistente")
        continue
      }

      const tipoNome = normalizeTextUpper(resolveField(linha, "tipo_execucao"))
      if (!tipoNome) {
        pushError(idx, matriculaDisplay, "tipo_execucao", "obrigatorio")
        continue
      }
      const tipo = tiposMap.get(tipoNome)
      if (!tipo?.id) {
        pushError(idx, matriculaDisplay, "tipo_execucao", "inexistente")
        continue
      }

      const dataAdmissaoRaw = resolveField(linha, "data_admissao")
      const dataAdmissaoText = dataAdmissaoRaw === null || dataAdmissaoRaw === undefined
        ? ""
        : String(dataAdmissaoRaw).trim()
      if (!dataAdmissaoText) {
        pushError(idx, matriculaDisplay, "data_admissao", "obrigatoria")
        continue
      }
      const dataAdmissao = parseDate(dataAdmissaoRaw)
      if (!dataAdmissao) {
        pushError(idx, matriculaDisplay, "data_admissao", "invalida")
        continue
      }

      if (updateMode) {
        updates.push({
          line: idx,
          id: existingId as string,
          matricula: matriculaTexto,
          data: {
            nome,
            matricula: matriculaTexto,
            centro_servico_id: centro.id,
            setor_id: setor.id,
            cargo_id: cargo.id,
            centro_custo_id: centro.centro_custo_id,
            tipo_execucao_id: tipo.id,
            dataAdmissao: dataAdmissao,
            usuarioEdicao: importUserId,
            atualizadoEm: now,
          },
        })
      } else {
        inserts.push({
          line: idx,
          matricula: matriculaTexto,
          data: {
            nome,
            matricula: matriculaTexto,
            centro_servico_id: centro.id,
            setor_id: setor.id,
            cargo_id: cargo.id,
            centro_custo_id: centro.centro_custo_id,
            tipo_execucao_id: tipo.id,
            dataAdmissao: dataAdmissao,
            dataDemissao: null,
            ativo: true,
            usuarioCadastro: importUserId,
            account_owner_id: owner,
          },
        })
      }
    }

    if (updateMode && updates.length) {
      stage = "db_update_pessoas"
      for (const row of updates) {
        const { error: updateErr } = await supabaseAdmin
          .from("pessoas")
          .update(row.data)
          .eq("id", row.id)
          .eq("account_owner_id", owner)
        if (updateErr) {
          pushError(row.line, row.matricula, "db", updateErr.message)
          continue
        }
        success += 1
      }
    }

    if (!updateMode && inserts.length) {
      stage = "db_insert_pessoas"
      for (const row of inserts) {
        const { error: insertErr } = await supabaseAdmin.from("pessoas").insert(row.data)
        if (insertErr) {
          pushError(row.line, row.matricula, "db", insertErr.message)
          continue
        }
        success += 1
      }
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
      const key = `${owner}/erros/cadastro_erros_${crypto.randomUUID()}.csv`
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
          mode: updateMode ? "update" : "insert",
        },
        importUserId,
        "IMPORT_PARTIAL",
        null,
        "warn",
      )

      return respond(
        JSON.stringify({
          processed,
          success,
          errors,
          mode: updateMode ? "update" : "insert",
          errorsUrl,
          firstError: errorLines[1],
          errorSamples,
          debug: {
            mode: updateMode ? "update" : "insert",
            headerKeys,
            centrosServico: centrosMap.size,
            setores: setoresMap.size,
            cargos: cargosMap.size,
            tiposExecucao: tiposMap.size,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    stage = "response_success"
    await deleteSource()
    return respond(
      JSON.stringify({
        processed,
        success,
        errors,
        mode: updateMode ? "update" : "insert",
        errorsUrl: null,
        firstError: null,
        errorSamples: [],
        debug: {
          mode: updateMode ? "update" : "insert",
          headerKeys,
          centrosServico: centrosMap.size,
          setores: setoresMap.size,
          cargos: cargosMap.size,
          tiposExecucao: tiposMap.size,
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
    console.error("cadastro-import error", stage, e.message, e.stack)
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
      },
    })
    return respond(
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

