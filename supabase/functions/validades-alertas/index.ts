import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { assertValidadesAlertasEnv, runValidadesAlertas } from "./_shared/validadesAlertasCore.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SERVICE_NAME = "validades-alertas"
const LOG_BUCKET = "cron"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const cronSecret = (Deno.env.get("CRON_SECRET") || "").trim()
const canLog = Boolean(supabaseUrl && serviceRoleKey)

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  },
})

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") || ""
  const match = authHeader.match(/Bearer\s+(.+)/i)
  return match?.[1]?.trim() || ""
}

const isCronAuthorized = (req: Request) => {
  if (!cronSecret) return false
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  const bearerToken = getBearerToken(req)
  return headerToken === cronSecret || bearerToken === cronSecret
}

const saveRunToDb = async (row: Record<string, unknown>) => {
  if (!canLog) return
  try {
    const { error } = await supabaseAdmin.from("edge_functions_error_report").insert(row)
    if (error) console.log("WARN insert edge_functions_error_report:", error.message)
  } catch (error) {
    console.log("WARN insert edge_functions_error_report:", String((error as Error)?.message ?? error))
  }
}

const getSbRequestId = (req: Request) =>
  req.headers.get("x-sb-request-id") || req.headers.get("sb-request-id") || null

const trim = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim())

const parseRequestBody = async (req: Request) => {
  const contentType = req.headers.get("content-type") || ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return {}
  }
  try {
    return await req.json()
  } catch {
    return {}
  }
}

const parseTestParams = async (req: Request) => {
  const url = new URL(req.url)
  const body = (await parseRequestBody(req)) as Record<string, unknown>
  const testEmail =
    trim(body?.test_email) ||
    trim(body?.testEmail) ||
    trim(url.searchParams.get("test_email")) ||
    trim(url.searchParams.get("testEmail")) ||
    trim(req.headers.get("x-test-email"))
  const testOwnerId =
    trim(body?.test_owner_id) ||
    trim(body?.owner_id) ||
    trim(body?.testOwnerId) ||
    trim(body?.ownerId) ||
    trim(url.searchParams.get("test_owner_id")) ||
    trim(url.searchParams.get("owner_id")) ||
    trim(url.searchParams.get("testOwnerId")) ||
    trim(url.searchParams.get("ownerId")) ||
    trim(req.headers.get("x-test-owner-id"))

  return { testEmail, testOwnerId }
}

Deno.serve(async (req) => {
  const t0 = Date.now()
  let httpStatus = 200
  const baseRow: Record<string, unknown> = {
    function_name: SERVICE_NAME,
    bucket: LOG_BUCKET,
    retention_days: 0,
    cutoff: new Date().toISOString(),
    dry_run: false,
    total_listed: 0,
    candidates: 0,
    deleted: 0,
    errors_count: 0,
    duration_ms: null,
    http_status: null,
    error_message: null,
    error_stack: null,
    sb_request_id: getSbRequestId(req),
    details: null,
    user_id: null,
  }
  const finalizeLog = async (updates: Record<string, unknown>) => {
    await saveRunToDb({
      ...baseRow,
      ...updates,
      http_status: httpStatus,
      duration_ms: Date.now() - t0,
    })
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    httpStatus = 405
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  if (!cronSecret) {
    httpStatus = 500
    return new Response(JSON.stringify({ ok: false, error: "Missing CRON_SECRET" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!isCronAuthorized(req)) {
    httpStatus = 401
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const { testEmail, testOwnerId } = await parseTestParams(req)
    assertValidadesAlertasEnv()
    const result = await runValidadesAlertas({ testEmail, testOwnerId })

    await finalizeLog({
      total_listed: result.total,
      candidates: result.enviados,
      errors_count: result.erros,
      details: {
        cron: !testEmail,
        test: Boolean(testEmail),
        test_owner_id: testOwnerId || null,
        total: result.total,
        enviados: result.enviados,
        erros: result.erros,
      },
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    httpStatus = 500
    const message = String((error as Error)?.message ?? error)
    await finalizeLog({
      errors_count: 1,
      error_message: message,
      error_stack: typeof (error as Error)?.stack === "string" ? (error as Error).stack : null,
      details: { cron: true, stage: "unhandled" },
    })
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
