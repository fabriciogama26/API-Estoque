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
const tzOffsetHours = Number(Deno.env.get("ENTRADAS_TZ_OFFSET") ?? "-3")

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
const SERVICE_NAME = "entrada-import"

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
      status: payload.status ?? null,
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

type CentroRow = { id: string; almox?: string | null; ativo?: boolean | null }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

const parseQuantidade = (value?: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  const raw = String(value).trim()
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, "").replace(",", ".")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const buildDateTimeIso = (dateStr: string, time: { hh: number; mm: number; ss: number }) => {
  const [yyyy, mm, dd] = dateStr.split("-").map((val) => Number(val))
  if (!yyyy || !mm || !dd) return null
  const utc = Date.UTC(yyyy, mm - 1, dd, time.hh - tzOffsetHours, time.mm, time.ss)
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders })

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

    stage = "catalog_centros_estoque"
    const { data: centrosRaw, error: centrosErr } = await supabaseAdmin
      .from("centros_estoque")
      .select("id, almox, ativo")
      .eq("account_owner_id", owner)
      .eq("ativo", true)
    if (centrosErr) {
      await logError(500, centrosErr.message, { error: centrosErr.message }, importUserId, centrosErr.code)
      return new Response(centrosErr.message, { status: 500, headers: corsHeaders })
    }

    const centrosMap = new Map<string, CentroRow>()
    ;(centrosRaw as CentroRow[] | null)?.forEach((row) => {
      if (!row?.almox) return
      const key = normalizeLookupKey(row.almox)
      if (!key || centrosMap.has(key)) return
      centrosMap.set(key, row)
    })

    const materialIds = new Set<string>()
    rows.forEach((linha) => {
      const raw = resolveField(linha, ["material_id", "materialid"])
      const materialId = raw === null || raw === undefined ? "" : String(raw).trim()
      if (!UUID_REGEX.test(materialId)) return
      materialIds.add(materialId)
    })

    stage = "catalog_materiais"
    const materialMap = new Set<string>()
    if (materialIds.size > 0) {
      const chunkSize = 100
      const materialArray = Array.from(materialIds)
      for (let i = 0; i < materialArray.length; i += chunkSize) {
        const slice = materialArray.slice(i, i + chunkSize)
        const { data: materiais, error: materiaisErr } = await supabaseAdmin
          .from("materiais")
          .select("id")
          .eq("account_owner_id", owner)
          .in("id", slice)
        if (materiaisErr) {
          await logError(500, materiaisErr.message, { error: materiaisErr.message }, importUserId, materiaisErr.code)
          return new Response(materiaisErr.message, { status: 500, headers: corsHeaders })
        }
        ;(materiais || []).forEach((m) => {
          if (m?.id) materialMap.add(m.id)
        })
      }
    }

    const importNow = new Date()
    const localNow = new Date(importNow.getTime() + tzOffsetHours * 60 * 60 * 1000)
    const timeParts = {
      hh: localNow.getUTCHours(),
      mm: localNow.getUTCMinutes(),
      ss: localNow.getUTCSeconds(),
    }

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,coluna,motivo"]

    const pushError = (line: number, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},${col},"${motivo}"`)
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const centroRaw = resolveField(linha, ["centro_estoque", "centroestoque"])
      const centroNome = normalizeLookupKey(centroRaw)
      if (!centroNome) {
        pushError(idx, "centro_estoque", "obrigatorio")
        continue
      }
      const centro = centrosMap.get(centroNome)
      if (!centro?.id) {
        pushError(idx, "centro_estoque", "inexistente")
        continue
      }

      const materialRaw = resolveField(linha, ["material_id", "materialid"])
      const materialId = materialRaw === null || materialRaw === undefined ? "" : String(materialRaw).trim()
      if (!materialId) {
        pushError(idx, "material_id", "obrigatorio")
        continue
      }
      if (!UUID_REGEX.test(materialId)) {
        pushError(idx, "material_id", "deve ser uuid")
        continue
      }
      if (!materialMap.has(materialId)) {
        pushError(idx, "material_id", "inexistente")
        continue
      }

      const quantidadeRaw = resolveField(linha, ["quantidade", "qtd"])
      const quantidade = parseQuantidade(quantidadeRaw)
      if (quantidade === null || quantidade <= 0) {
        pushError(idx, "quantidade", "invalida")
        continue
      }

      const dataRaw = resolveField(linha, ["data_entrada", "dataentrada", "data"])
      const dataStr = parseDate(dataRaw)
      if (!dataStr) {
        pushError(idx, "data_entrada", "invalida")
        continue
      }
      const dataIso = buildDateTimeIso(dataStr, timeParts)
      if (!dataIso) {
        pushError(idx, "data_entrada", "invalida")
        continue
      }

      stage = "db_insert_entrada"
      const { error: insertErr } = await supabaseUser.rpc("rpc_entradas_create_full", {
        p_material_id: materialId,
        p_quantidade: quantidade,
        p_centro_estoque: centro.id,
        p_data_entrada: dataIso,
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
      const key = `entrada_erros_${crypto.randomUUID()}.csv`
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
            centrosEstoque: centrosMap.size,
            materiais: materialMap.size,
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
          centrosEstoque: centrosMap.size,
          materiais: materialMap.size,
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
    console.error("entrada-import error", stage, e.message, e.stack)
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

