import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { createUserClient, getBearerToken } from "./_shared/auth.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SERVICE_NAME = "forecast-gasto-mensal"
const LOG_BUCKET = "cron"
const MANUAL_RATE_LIMIT_SECONDS = 300

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim()
const cronSecret = (Deno.env.get("CRON_SECRET") || "").trim()
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

const isCronAuthorized = (req: Request) => {
  if (!cronSecret) return false
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

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function isLastDayOfMonthUtc(date: Date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const nextDay = new Date(Date.UTC(year, month, date.getUTCDate() + 1))
  return nextDay.getUTCMonth() !== month
}

async function checkManualRateLimit(userId: string) {
  if (!supabaseAdmin) return { ok: true, retryAfter: 0 }
  const { data, error } = await supabaseAdmin
    .from("edge_functions_error_report")
    .select("created_at")
    .eq("function_name", SERVICE_NAME)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error || !Array.isArray(data) || !data.length) {
    return { ok: true, retryAfter: 0 }
  }

  const lastCreated = data[0]?.created_at
  if (!lastCreated) return { ok: true, retryAfter: 0 }
  const lastMs = Date.parse(String(lastCreated))
  if (Number.isNaN(lastMs)) return { ok: true, retryAfter: 0 }

  const elapsed = (Date.now() - lastMs) / 1000
  if (elapsed >= MANUAL_RATE_LIMIT_SECONDS) {
    return { ok: true, retryAfter: 0 }
  }
  const retryAfter = Math.max(1, Math.ceil(MANUAL_RATE_LIMIT_SECONDS - elapsed))
  return { ok: false, retryAfter }
}

async function fetchOwners() {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, ativo, parent_user_id")
    .is("parent_user_id", null)
  if (error) {
    throw new Error(`Falha ao listar owners: ${error.message}`)
  }
  return (data || []).filter((row) => row?.ativo !== false && row?.id)
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

  let shouldLog = false
  let details: Record<string, unknown> | null = null

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !supabaseAdmin) {
      httpStatus = 500
      return new Response(
        JSON.stringify({ ok: false, error: "Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const isCronCall = isCronAuthorized(req)
    let userId: string | null = null
    let ownerId: string | null = null
    let supabaseUser: ReturnType<typeof createUserClient> | null = null

    if (isCronCall) {
      shouldLog = true
    } else {
      const bearerToken = getBearerToken(req)
      if (!bearerToken) {
        httpStatus = 401
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      supabaseUser = createUserClient(bearerToken)
      const { data: userData, error: userError } = await supabaseUser.auth.getUser(bearerToken)
      if (userError || !userData?.user?.id) {
        httpStatus = 401
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      userId = userData.user.id
      baseRow.user_id = userId
      shouldLog = canLog

      const { data: permissionOk, error: permissionError } = await supabaseUser.rpc("has_permission", {
        p_key: "estoque.reprocessar",
      })
      if (permissionError || permissionOk !== true) {
        httpStatus = 403
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data: ownerData, error: ownerError } = await supabaseUser.rpc("current_account_owner_id")
      const resolvedOwner =
        typeof ownerData === "string"
          ? ownerData
          : (ownerData as { account_owner_id?: string } | null)?.account_owner_id
      if (ownerError || !resolvedOwner) {
        httpStatus = 403
        return new Response(JSON.stringify({ ok: false, error: "Owner nao encontrado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      ownerId = resolvedOwner

      const rateLimit = await checkManualRateLimit(userId)
      if (!rateLimit.ok) {
        httpStatus = 429
        const headers = {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter || MANUAL_RATE_LIMIT_SECONDS),
        }
        if (shouldLog) {
          await finalizeLog({
            errors_count: 1,
            error_message: "rate_limit",
            details: {
              mode: "manual",
              owner_id: ownerId,
              retry_after: rateLimit.retryAfter,
            },
          })
        }
        return new Response(JSON.stringify({ ok: false, error: "Rate limit" }), {
          status: 429,
          headers,
        })
      }
    }

    const body = isCronCall ? await req.json().catch(() => ({})) : {}
    const forceRun = Boolean((body as any)?.force ?? (body as any)?.forceRun ?? false)

    const now = new Date()
    if (isCronCall && !forceRun && !isLastDayOfMonthUtc(now)) {
      details = {
        cron: true,
        forceRun,
        skipped: true,
        reason: "nao_e_ultimo_dia_do_mes",
        date: now.toISOString(),
      }
      if (shouldLog) {
        await finalizeLog({
          errors_count: 0,
          details,
        })
      }
      return new Response(JSON.stringify({ ok: true, ...details }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!isCronCall) {
      if (!supabaseUser || !ownerId || !userId) {
        httpStatus = 401
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { data, error } = await supabaseUser.rpc("rpc_previsao_gasto_mensal_calcular", {
        p_owner_id: ownerId,
        p_fator_tendencia: null,
      })
      if (error) {
        httpStatus = 500
        if (shouldLog) {
          await finalizeLog({
            errors_count: 1,
            error_message: error.message,
            details: {
              mode: "manual",
              owner_id: ownerId,
            },
          })
        }
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      details = { mode: "manual", owner_id: ownerId }
      if (shouldLog) {
        await finalizeLog({
          errors_count: 0,
          details,
        })
      }

      return new Response(JSON.stringify({ ok: true, ownerId, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const owners = await fetchOwners()
    const resultados: Array<Record<string, unknown>> = []

    for (const owner of owners) {
      const { data, error } = await supabaseAdmin.rpc("rpc_previsao_gasto_mensal_calcular", {
        p_owner_id: owner.id,
        p_fator_tendencia: null,
      })

      if (error) {
        resultados.push({ ownerId: owner.id, ok: false, error: error.message })
        continue
      }

      resultados.push({ ownerId: owner.id, ok: true, status: data?.status || null })
    }

    const errorSamples = resultados.filter((item) => item?.ok === false).slice(0, 10)
    details = {
      cron: true,
      forceRun,
      total_owners: owners.length,
      total_results: resultados.length,
      error_count: errorSamples.length,
      error_samples: errorSamples,
    }

    if (shouldLog) {
      await finalizeLog({
        errors_count: errorSamples.length,
        details,
      })
    }

    return new Response(JSON.stringify({ ok: true, total: resultados.length, resultados }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    httpStatus = 500
    const message = String((error as Error)?.message ?? error)
    if (shouldLog) {
      await finalizeLog({
        errors_count: 1,
        error_message: message,
        error_stack: typeof (error as Error)?.stack === "string" ? (error as Error).stack : null,
        details: {
          ...(details ?? {}),
          cron: shouldLog,
          stage: "unhandled",
        },
      })
    }
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

