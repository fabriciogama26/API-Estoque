// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { resolveImportSizeLimit, resolveStorageObjectSize } from "./_shared/importLimits.ts"

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
const SERVICE_NAME = "aso-import"
const RATE_LIMIT_WINDOW_SECONDS = 60
const DAILY_LIMIT_CATEGORY = "import"
const RATE_LIMIT_WINDOW_CODE = "RATE_LIMIT_WINDOW"
const RATE_LIMIT_WINDOW_MESSAGE = "Limite de 1 requisicao a cada 60 segundos."
const DAILY_LIMIT_CODE = "DAILY_LIMIT_BLOCK"
const DAILY_LIMIT_MESSAGE = "Limite diario do plano bloqueado."

type PessoaRow = {
  id: string
  matricula: string | null
  ativo: boolean | null
  dataDemissao?: string | null
}

type TipoRow = {
  id: string
  codigo: string | null
  nome: string | null
  ativo?: boolean | null
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

const trimText = (value?: unknown) => {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

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

// Accepts dd/MM/yyyy, Excel serial or Date.
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

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch
    return `${yyyy}-${mm}-${dd}`
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return raw
  }

  return null
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
      if (result?.allowed === true) return null

      const reason = String(result?.reason || "")
      if (reason === "locked" || reason === "limit_reached") {
        await logError(
          429,
          DAILY_LIMIT_MESSAGE,
          { category: DAILY_LIMIT_CATEGORY, dayDate: result?.day_date, lockedUntil: result?.locked_until },
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
    let body: { path?: string } = {}
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

    const matriculas = new Set<string>()
    rows.forEach((linha) => {
      const matricula = trimText(resolveField(linha, ["matricula"]))
      if (matricula) matriculas.add(matricula)
    })

    stage = "catalog_pessoas"
    const pessoasMap = new Map<string, PessoaRow>()
    if (matriculas.size > 0) {
      const chunkSize = 100
      const matriculasArray = Array.from(matriculas)
      for (let i = 0; i < matriculasArray.length; i += chunkSize) {
        const slice = matriculasArray.slice(i, i + chunkSize)
        const { data, error } = await supabaseAdmin
          .from("pessoas")
          .select('id, matricula, ativo, "dataDemissao"')
          .eq("account_owner_id", owner)
          .in("matricula", slice)
        if (error) {
          await logError(500, error.message, { error: error.message }, importUserId, error.code)
          return respond(error.message, { status: 500, headers: corsHeaders })
        }
        ;(data as PessoaRow[] | null)?.forEach((item) => {
          const key = trimText(item?.matricula)
          if (key && !pessoasMap.has(key)) {
            pessoasMap.set(key, item)
          }
        })
      }
    }

    stage = "catalog_tipos"
    const { data: tiposRaw, error: tiposErr } = await supabaseAdmin
      .from("aso_tipos_exame")
      .select("id, codigo, nome, ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
    if (tiposErr) {
      await logError(500, tiposErr.message, { error: tiposErr.message }, importUserId, tiposErr.code)
      return respond(tiposErr.message, { status: 500, headers: corsHeaders })
    }
    const tiposMap = new Map<string, TipoRow>()
    ;(tiposRaw as TipoRow[] | null)?.forEach((item) => {
      const keys = [normalizeLookupKey(item?.codigo), normalizeLookupKey(item?.nome)]
      keys.filter(Boolean).forEach((key) => {
        if (!tiposMap.has(key)) {
          tiposMap.set(key, item)
        }
      })
    })

    let processed = 0
    let success = 0
    let errors = 0
    const seenExactKeys = new Set<string>()
    const errorLines: string[] = ["linha,coluna,motivo"]

    const pushError = (line: number, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},${col},"${motivo.replace(/"/g, '""')}"`)
    }

    for (let i = 0; i < rows.length; i += 1) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const matricula = trimText(resolveField(linha, ["matricula"]))
      if (!matricula) {
        pushError(idx, "matricula", "obrigatoria")
        continue
      }
      const pessoa = pessoasMap.get(matricula)
      if (!pessoa?.id) {
        pushError(idx, "matricula", "nao encontrada")
        continue
      }

      const tipoRaw = resolveField(linha, ["tipo_exame", "tipoexame", "tipo"])
      const tipo = tiposMap.get(normalizeLookupKey(tipoRaw))
      if (!tipo?.id) {
        pushError(idx, "tipo_exame", "invalido")
        continue
      }

      const dataExame = parseDate(resolveField(linha, ["data_exame", "dataexame", "data"]))
      if (!dataExame) {
        pushError(idx, "data_exame", "invalida")
        continue
      }

      const exactKey = `${matricula}|${tipo.id}|${dataExame}`
      if (seenExactKeys.has(exactKey)) {
        pushError(idx, "db", "duplicidade na propria planilha")
        continue
      }
      seenExactKeys.add(exactKey)

      const observacao = trimText(resolveField(linha, ["observacao", "obs"]))

      stage = "db_insert_aso"
      const { error: insertErr } = await supabaseUser.rpc("rpc_aso_create_full", {
        p_pessoa_id: pessoa.id,
        p_tipo_exame_id: tipo.id,
        p_data_exame: dataExame,
        p_observacao: observacao || null,
        p_usuario_id: importUserId,
      })
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
      const key = `${owner}/erros/aso_erros_${crypto.randomUUID()}.csv`
      await supabaseAdmin.storage.from(errorsBucket).upload(key, new TextEncoder().encode(csv), {
        contentType: "text/csv",
      })
      const signed = await supabaseAdmin.storage.from(errorsBucket).createSignedUrl(key, 60 * 60)
      errorsUrl = signed.data?.signedUrl || null

      await deleteSource()

      await logError(
        200,
        "Importacao de ASO concluida com erros",
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
            pessoas: pessoasMap.size,
            tiposExame: tiposMap.size,
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
          pessoas: pessoasMap.size,
          tiposExame: tiposMap.size,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logApiError({
      message,
      status: 500,
      userId: null,
      stage,
      method: req.method,
      path: new URL(req.url).pathname,
      stack: err instanceof Error ? err.stack ?? null : null,
      context: {
        function: SERVICE_NAME,
        bucket: errorsBucket,
        path: sourcePath,
      },
    })
    return new Response(
      JSON.stringify({ ok: false, stage, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
