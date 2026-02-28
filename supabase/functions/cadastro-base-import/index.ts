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
const SERVICE_NAME = "cadastro-base-import"
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

type TableConfig = {
  table: string
  nameColumn: string
  nameTargets: string[]
  uppercase?: boolean
  relation?: {
    field: string
    table: string
    targets: string[]
  }
}

const TABLES: Record<string, TableConfig> = {
  fabricantes: {
    table: "fabricantes",
    nameColumn: "fabricante",
    nameTargets: ["fabricante", "nome"],
  },
  cargos: {
    table: "cargos",
    nameColumn: "nome",
    nameTargets: ["cargo", "nome"],
    uppercase: true,
  },
  centros_custo: {
    table: "centros_custo",
    nameColumn: "nome",
    nameTargets: ["centro_custo", "centro custo", "nome"],
  },
  centros_servico: {
    table: "centros_servico",
    nameColumn: "nome",
    nameTargets: ["centro_servico", "centro servico", "nome"],
    relation: {
      field: "centro_custo_id",
      table: "centros_custo",
      targets: ["centro_custo", "centro custo"],
    },
  },
  centros_estoque: {
    table: "centros_estoque",
    nameColumn: "almox",
    nameTargets: ["centro_estoque", "centro estoque", "almox"],
    relation: {
      field: "centro_custo",
      table: "centros_custo",
      targets: ["centro_custo", "centro custo"],
    },
  },
  setores: {
    table: "setores",
    nameColumn: "nome",
    nameTargets: ["setor", "nome"],
    relation: {
      field: "centro_servico_id",
      table: "centros_servico",
      targets: ["centro_servico", "centro servico"],
    },
  },
}

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

const normalizeText = (value?: unknown, uppercase = false) => {
  if (value === null || value === undefined) return ""
  const raw = String(value).trim()
  if (!raw) return ""
  const cleaned = raw.replace(/\s+/g, " ")
  return uppercase ? cleaned.toUpperCase() : cleaned
}

const parseBoolean = (value?: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  const raw = String(value).trim().toLowerCase()
  if (!raw) return null
  if (["true", "1", "sim", "yes", "ativo"].includes(raw)) return true
  if (["false", "0", "nao", "não", "no", "inativo"].includes(raw)) return false
  return null
}

const buildMapByName = (rows: { id: string; nome?: string | null; almox?: string | null }[] | null) => {
  const map = new Map<string, string>()
  ;(rows || []).forEach((row) => {
    const nome = row?.nome ?? row?.almox
    const key = normalizeLookupKey(nome)
    if (!key || map.has(key)) return
    map.set(key, row.id)
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
    const userMeta = userData.user.user_metadata || {}
    const userName =
      (userMeta.username || userMeta.full_name || userMeta.name || userData.user.email || "").toString().trim() || null

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
      await logError(400, "Body precisa ser JSON: { path: string, table: string }", {}, importUserId)
      return respond(
        JSON.stringify({ ok: false, stage, message: "Body precisa ser JSON: { path: string, table: string }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const path = body?.path
    const tableKey = (body?.table || "").toString().trim().toLowerCase()
    if (!path || typeof path !== "string") {
      await logError(400, "path obrigatorio", {}, importUserId)
      return respond("path obrigatorio", { status: 400, headers: corsHeaders })
    }
    if (!path.toLowerCase().endsWith(".xlsx")) {
      await logError(400, "Apenas XLSX", {}, importUserId)
      return respond("Apenas XLSX", { status: 400, headers: corsHeaders })
    }
    const config = TABLES[tableKey]
    if (!config) {
      await logError(400, "Tabela invalida", { table: tableKey }, importUserId)
      return respond("Tabela invalida", { status: 400, headers: corsHeaders })
    }
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

    stage = "catalog_existing"
    const { data: existingRaw, error: existingErr } = await supabaseAdmin
      .from(config.table)
      .select(`id, ${config.nameColumn}`)
      .eq("account_owner_id", owner)
    if (existingErr) {
      await logError(500, existingErr.message, { error: existingErr.message }, importUserId, existingErr.code)
      return respond(existingErr.message, { status: 500, headers: corsHeaders })
    }
    const existingMap = new Map<string, string>()
    ;(existingRaw || []).forEach((row) => {
      const key = normalizeLookupKey((row as Record<string, unknown>)[config.nameColumn])
      if (!key || existingMap.has(key)) return
      existingMap.set(key, row.id)
    })

    let relationMap: Map<string, string> | null = null
    if (config.relation) {
      stage = "catalog_relation"
      const { data: relationRows, error: relationErr } = await supabaseAdmin
        .from(config.relation.table)
        .select(config.relation.table === "centros_estoque" ? "id, almox" : "id, nome")
        .eq("account_owner_id", owner)
      if (relationErr) {
        await logError(500, relationErr.message, { error: relationErr.message }, importUserId, relationErr.code)
        return respond(relationErr.message, { status: 500, headers: corsHeaders })
      }
      relationMap = buildMapByName(relationRows as { id: string; nome?: string | null; almox?: string | null }[])
    }

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,coluna,motivo"]
    const seenNames = new Set<string>()

    const pushError = (line: number, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},${col},"${motivo}"`)
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const nameRaw = resolveField(linha, config.nameTargets)
      let nome = normalizeText(nameRaw, Boolean(config.uppercase))
      if (!nome) {
        pushError(idx, config.nameTargets[0], "obrigatorio")
        continue
      }

      const nameKey = normalizeLookupKey(nome)
      if (seenNames.has(nameKey)) {
        pushError(idx, config.nameTargets[0], "duplicado")
        continue
      }
      seenNames.add(nameKey)

      if (existingMap.has(nameKey)) {
        pushError(idx, config.nameTargets[0], "ja existe")
        continue
      }

      let relationId: string | null = null
      if (config.relation) {
        const relationRaw = resolveField(linha, config.relation.targets)
        const relationText = normalizeText(relationRaw)
        if (!relationText) {
          pushError(idx, config.relation.targets[0], "obrigatorio")
          continue
        }
        const relationKey = normalizeLookupKey(relationText)
        relationId = relationMap?.get(relationKey) || null
        if (!relationId) {
          pushError(idx, config.relation.targets[0], "inexistente")
          continue
        }
      }

      const ativoRaw = resolveField(linha, ["ativo"])
      const ativoParsed = parseBoolean(ativoRaw)
      const ativo = ativoParsed === null ? true : ativoParsed

      stage = "db_insert"
      const payload: Record<string, unknown> = {
        [config.nameColumn]: nome,
        ativo,
        created_by_user_id: importUserId,
        updated_by_user_id: importUserId,
        account_owner_id: owner,
      }
      if (userName) {
        payload.created_by_user_name = userName
        payload.updated_by_user_name = userName
      }
      if (config.relation && relationId) {
        payload[config.relation.field] = relationId
      }

      const { error: insertErr } = await supabaseUser.from(config.table).insert(payload)
      if (insertErr) {
        pushError(idx, "db", insertErr.message || "erro")
        continue
      }
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
      const key = `${owner}/erros/cadastro_base_erros_${crypto.randomUUID()}.csv`
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
          table: config.table,
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
          errorsUrl,
          firstError: errorLines[1],
          errorSamples,
          debug: {
            headerKeys,
            table: config.table,
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
        errorsUrl: null,
        firstError: null,
        errorSamples: [],
        debug: {
          headerKeys,
          table: config.table,
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
    console.error("cadastro-base-import error", stage, e.message, e.stack)
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

