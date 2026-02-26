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

const TABLES: Record<
  string,
  {
    headers: string[]
    example: (string | number)[]
  }
> = {
  fabricantes: {
    headers: ["fabricante", "ativo"],
    example: ["ACME", "true"],
  },
  cargos: {
    headers: ["cargo", "ativo"],
    example: ["TECNICO", "true"],
  },
  centros_custo: {
    headers: ["centro_custo", "ativo"],
    example: ["CENTRO A", "true"],
  },
  centros_servico: {
    headers: ["centro_servico", "centro_custo", "ativo"],
    example: ["SERVICO A", "CENTRO A", "true"],
  },
  centros_estoque: {
    headers: ["centro_estoque", "centro_custo", "ativo"],
    example: ["ALMOXARIFADO A", "CENTRO A", "true"],
  },
  setores: {
    headers: ["setor", "centro_servico", "ativo"],
    example: ["SETOR A", "SERVICO A", "true"],
  },
}

Deno.serve((req) => {
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

  const url = new URL(req.url)
  const table = (url.searchParams.get("table") || "").trim().toLowerCase()
  const config = TABLES[table]
  if (!config) {
    return new Response("Tabela invalida", { status: 400, headers: corsHeaders })
  }

  const data = [config.headers, config.example]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "modelo")
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })

  return new Response(buffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${table}_template.xlsx"`,
    },
  })
})

