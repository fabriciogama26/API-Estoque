import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { runRelatorioEstoqueMensal, assertRelatorioEnv } from "./_shared/relatorioEstoqueCore.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const cronSecret = Deno.env.get("CRON_SECRET") || ""

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  if (!isCronAuthorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    assertRelatorioEnv()
    const result = await runRelatorioEstoqueMensal()
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
