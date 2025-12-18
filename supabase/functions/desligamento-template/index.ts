// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  // Opcional: exigir login
  if (!req.headers.get("authorization")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders })
  }

  const data = [
    ["matricula", "data_demissao", "ativo"],
    ["12345", "31/12/2025", "false"],
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
      "Content-Disposition": 'attachment; filename="desligamento_template.xlsx"',
    },
  })
})
