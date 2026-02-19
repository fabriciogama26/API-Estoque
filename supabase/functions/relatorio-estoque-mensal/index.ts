import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { runRelatorioEstoqueMensal, assertRelatorioEnv } from "./_shared/relatorioEstoqueCore.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SERVICE_NAME = "relatorio-estoque-mensal"
const LOG_BUCKET = "cron"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const cronSecret = Deno.env.get("CRON_SECRET") || ""
const canLog = Boolean(supabaseUrl && serviceRoleKey)

const supabaseAdmin = canLog
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      },
    })
  : null

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") || ""
  const match = authHeader.match(/Bearer\s+(.+)/i)
  return match?.[1]?.trim() || ""
}

const isCronAuthorized = (req: Request) => {
  if (!cronSecret) return true
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  const bearerToken = getBearerToken(req)
  return headerToken === cronSecret || bearerToken === cronSecret
}

const saveRunToDb = async (row: Record<string, unknown>) => {
  if (!canLog || !supabaseAdmin) return
  try {
    const { error } = await supabaseAdmin.from("edge_functions_error_report").insert(row)
    if (error) console.log("WARN insert edge_functions_error_report:", error.message)
  } catch (error) {
    console.log("WARN insert edge_functions_error_report:", String((error as Error)?.message ?? error))
  }
}

const getSbRequestId = (req: Request) =>
  req.headers.get("x-sb-request-id") || req.headers.get("sb-request-id") || null

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

  const isCronCall = isCronAuthorized(req)
  const shouldLog = isCronCall

  if (!isCronCall) {
    httpStatus = 401
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    assertRelatorioEnv()
    const result = await runRelatorioEstoqueMensal()
    const resultados = Array.isArray((result as any)?.resultados) ? (result as any).resultados : []
    const skipped = resultados.filter((item: any) => item?.skipped).length
    const gerados = resultados.filter((item: any) => item?.reportId).length
    const detalhes = {
      cron: true,
      total: (result as any)?.total ?? resultados.length,
      gerados,
      skipped,
      sample_skipped: resultados.filter((item: any) => item?.skipped).slice(0, 10),
    }

    if (shouldLog) {
      await finalizeLog({
        errors_count: 0,
        details: detalhes,
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    httpStatus = 500
    const message = String(error?.message ?? error)
    console.error("[relatorio-estoque-mensal] error:", message, error?.stack)
    if (shouldLog) {
      await finalizeLog({
        errors_count: 1,
        error_message: message,
        error_stack: typeof error?.stack === "string" ? error.stack : null,
        details: { cron: true, stage: "unhandled" },
      })
    }
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
