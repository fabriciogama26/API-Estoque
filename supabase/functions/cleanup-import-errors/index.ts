// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const errorsBucket = Deno.env.get("ERRORS_BUCKET") || "imports"
const cronSecret = Deno.env.get("CRON_SECRET") || ""

const clampInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsed), 3650))
}

const retentionDays = clampInt(Deno.env.get("ERRORS_RETENTION_DAYS"), 7)
const pageSize = clampInt(Deno.env.get("ERRORS_CLEANUP_PAGE_SIZE"), 1000)

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

const isAuthorized = (req: Request) => {
  if (!cronSecret) return true
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  const authHeader = req.headers.get("authorization") || ""
  const match = authHeader.match(/Bearer\s+(.+)/i)
  const bearerToken = match?.[1]?.trim() || ""
  return headerToken === cronSecret || bearerToken === cronSecret
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", {
      status: 500,
      headers: corsHeaders,
    })
  }
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders })
  }

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = Boolean(body?.dryRun || body?.dry_run)
  } catch (_) {
    dryRun = false
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  let totalCandidates = 0
  let deleted = 0
  let pages = 0
  const deleteErrors: string[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("storage.objects")
      .select("name, created_at")
      .eq("bucket_id", errorsBucket)
      .ilike("name", "%_erros_%.csv")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: error.message,
          bucket: errorsBucket,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const batch = (data || []).map((item) => item?.name).filter(Boolean) as string[]
    if (batch.length === 0) break

    totalCandidates += batch.length
    pages += 1

    if (!dryRun) {
      const { error: deleteError } = await supabaseAdmin.storage.from(errorsBucket).remove(batch)
      if (deleteError) {
        deleteErrors.push(deleteError.message)
      } else {
        deleted += batch.length
      }
    }

    if (batch.length < pageSize) break
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dryRun,
      bucket: errorsBucket,
      retentionDays,
      cutoff,
      totalCandidates,
      deleted,
      pages,
      errors: deleteErrors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
})
