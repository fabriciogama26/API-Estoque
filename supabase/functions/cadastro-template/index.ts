// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { requireAuthUser } from "./_shared/auth.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "x-deno-execution-id, x-sb-request-id",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  const auth = await requireAuthUser(req, corsHeaders)
  if ("response" in auth) {
    return auth.response
  }

  const data = [
    [
      "matricula",
      "nome",
      "centro_servico",
      "setor",
      "cargo",
      "tipo_execucao",
      "data_admissao",
    ],
    [
      "12345",
      "TALITA SANTOS",
      "CENTRO A",
      "SETOR X",
      "TECNICO",
      "PROPRIO",
      "16/01/2026",
    ],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "modelo")
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })

  return new Response(buffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cadastro_template.xlsx"',
    },
  })
})

