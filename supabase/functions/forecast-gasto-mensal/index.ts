import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const cronSecret = Deno.env.get("CRON_SECRET") || ""

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
  if (!cronSecret) return true
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  const bearerToken = getBearerToken(req)
  return headerToken === cronSecret || bearerToken === cronSecret
}

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

async function resolveOwnerId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, parent_user_id, ativo")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Falha ao resolver owner: ${error.message}`)
  }

  if (data?.ativo === false) {
    throw new Error("Usuario inativo.")
  }

  return data?.parent_user_id || data?.id || userId
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const isCronCall = isCronAuthorized(req)
  let userId: string | null = null

  if (!isCronCall) {
    const bearerToken = getBearerToken(req)
    if (!bearerToken) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken)
    if (error || !data?.user?.id) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    userId = data.user.id
  }

  const body = await req.json().catch(() => ({}))
  const forceRun = Boolean((body as any)?.force ?? (body as any)?.forceRun ?? false)

  const now = new Date()
  if (isCronCall && !forceRun && !isLastDayOfMonthUtc(now)) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "nao_e_ultimo_dia_do_mes",
        date: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  if (!isCronCall) {
    const ownerId = await resolveOwnerId(userId as string)
    const { data, error } = await supabaseAdmin.rpc("rpc_previsao_gasto_mensal_calcular", {
      p_owner_id: ownerId,
      p_fator_tendencia: null,
    })
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  return new Response(JSON.stringify({ ok: true, total: resultados.length, resultados }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
