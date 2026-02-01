// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-deno-execution-id, x-sb-request-id",
}

let stage = "init"
let sourcePath: string | null = null

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
const errorsBucket = Deno.env.get("ERRORS_BUCKET") || "imports"

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

type TableConfig = {
  table: string
  nameColumn: string
  nameTargets: string[]
  uppercase?: boolean
  relation?: {
    field: string
    table: string
    targets: string[]
  }
}

const TABLES: Record<string, TableConfig> = {
  fabricantes: {
    table: "fabricantes",
    nameColumn: "fabricante",
    nameTargets: ["fabricante", "nome"],
  },
  cargos: {
    table: "cargos",
    nameColumn: "nome",
    nameTargets: ["cargo", "nome"],
    uppercase: true,
  },
  centros_custo: {
    table: "centros_custo",
    nameColumn: "nome",
    nameTargets: ["centro_custo", "centro custo", "nome"],
  },
  centros_servico: {
    table: "centros_servico",
    nameColumn: "nome",
    nameTargets: ["centro_servico", "centro servico", "nome"],
    relation: {
      field: "centro_custo_id",
      table: "centros_custo",
      targets: ["centro_custo", "centro custo"],
    },
  },
  centros_estoque: {
    table: "centros_estoque",
    nameColumn: "almox",
    nameTargets: ["centro_estoque", "centro estoque", "almox"],
    relation: {
      field: "centro_custo",
      table: "centros_custo",
      targets: ["centro_custo", "centro custo"],
    },
  },
  setores: {
    table: "setores",
    nameColumn: "nome",
    nameTargets: ["setor", "nome"],
    relation: {
      field: "centro_servico_id",
      table: "centros_servico",
      targets: ["centro_servico", "centro servico"],
    },
  },
}

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

const normalizeText = (value?: unknown, uppercase = false) => {
  if (value === null || value === undefined) return ""
  const raw = String(value).trim()
  if (!raw) return ""
  const cleaned = raw.replace(/\s+/g, " ")
  return uppercase ? cleaned.toUpperCase() : cleaned
}

const parseBoolean = (value?: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  const raw = String(value).trim().toLowerCase()
  if (!raw) return null
  if (["true", "1", "sim", "yes", "ativo"].includes(raw)) return true
  if (["false", "0", "nao", "não", "no", "inativo"].includes(raw)) return false
  return null
}

const buildMapByName = (rows: { id: string; nome?: string | null; almox?: string | null }[] | null) => {
  const map = new Map<string, string>()
  ;(rows || []).forEach((row) => {
    const nome = row?.nome ?? row?.almox
    const key = normalizeLookupKey(nome)
    if (!key || map.has(key)) return
    map.set(key, row.id)
  })
  return map
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders })

    stage = "auth_header"
    const authHeader = req.headers.get("authorization") || ""
    const tokenMatch = authHeader.match(/Bearer\s+(.+)/i)
    const accessToken = tokenMatch?.[1]?.trim()
    if (!accessToken) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    stage = "auth_getUser"
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(accessToken)
    if (userErr || !userData?.user?.id) return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    const importUserId = userData.user.id
    const userMeta = userData.user.user_metadata || {}
    const userName =
      (userMeta.username || userMeta.full_name || userMeta.name || userData.user.email || "").toString().trim() || null

    stage = "resolve_owner"
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })
    const { data: ownerId, error: ownerErr } = await supabaseUser.rpc("current_account_owner_id")
    const owner =
      typeof ownerId === "string" ? ownerId : (ownerId as { account_owner_id?: string } | null)?.account_owner_id
    if (ownerErr || !owner) {
      return new Response("Owner nao encontrado", { status: 403, headers: corsHeaders })
    }

    stage = "read_body"
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ ok: false, stage, message: "Body precisa ser JSON: { path: string, table: string }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const path = body?.path
    const tableKey = (body?.table || "").toString().trim().toLowerCase()
    if (!path || typeof path !== "string") return new Response("path obrigatorio", { status: 400, headers: corsHeaders })
    if (!path.toLowerCase().endsWith(".xlsx")) return new Response("Apenas XLSX", { status: 400, headers: corsHeaders })
    const config = TABLES[tableKey]
    if (!config) return new Response("Tabela invalida", { status: 400, headers: corsHeaders })
    sourcePath = path

    stage = "storage_download"
    const download = await supabaseAdmin.storage.from(errorsBucket).download(path)
    if (download.error || !download.data) {
      const msg = download.error?.message || "Falha ao baixar arquivo"
      return new Response(msg, { status: 400, headers: corsHeaders })
    }

    stage = "xlsx_read"
    const buffer = new Uint8Array(await download.data.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "array" })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    const headerKeys = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : []

    stage = "catalog_existing"
    const { data: existingRaw, error: existingErr } = await supabaseAdmin
      .from(config.table)
      .select(`id, ${config.nameColumn}`)
      .eq("account_owner_id", owner)
    if (existingErr) return new Response(existingErr.message, { status: 500, headers: corsHeaders })
    const existingMap = new Map<string, string>()
    ;(existingRaw || []).forEach((row) => {
      const key = normalizeLookupKey((row as Record<string, unknown>)[config.nameColumn])
      if (!key || existingMap.has(key)) return
      existingMap.set(key, row.id)
    })

    let relationMap: Map<string, string> | null = null
    if (config.relation) {
      stage = "catalog_relation"
      const { data: relationRows, error: relationErr } = await supabaseAdmin
        .from(config.relation.table)
        .select(config.relation.table === "centros_estoque" ? "id, almox" : "id, nome")
        .eq("account_owner_id", owner)
      if (relationErr) return new Response(relationErr.message, { status: 500, headers: corsHeaders })
      relationMap = buildMapByName(relationRows as { id: string; nome?: string | null; almox?: string | null }[])
    }

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,coluna,motivo"]
    const seenNames = new Set<string>()

    const pushError = (line: number, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},${col},"${motivo}"`)
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2
      const linha = rows[i]

      const nameRaw = resolveField(linha, config.nameTargets)
      let nome = normalizeText(nameRaw, Boolean(config.uppercase))
      if (!nome) {
        pushError(idx, config.nameTargets[0], "obrigatorio")
        continue
      }

      const nameKey = normalizeLookupKey(nome)
      if (seenNames.has(nameKey)) {
        pushError(idx, config.nameTargets[0], "duplicado")
        continue
      }
      seenNames.add(nameKey)

      if (existingMap.has(nameKey)) {
        pushError(idx, config.nameTargets[0], "ja existe")
        continue
      }

      let relationId: string | null = null
      if (config.relation) {
        const relationRaw = resolveField(linha, config.relation.targets)
        const relationText = normalizeText(relationRaw)
        if (!relationText) {
          pushError(idx, config.relation.targets[0], "obrigatorio")
          continue
        }
        const relationKey = normalizeLookupKey(relationText)
        relationId = relationMap?.get(relationKey) || null
        if (!relationId) {
          pushError(idx, config.relation.targets[0], "inexistente")
          continue
        }
      }

      const ativoRaw = resolveField(linha, ["ativo"])
      const ativoParsed = parseBoolean(ativoRaw)
      const ativo = ativoParsed === null ? true : ativoParsed

      stage = "db_insert"
      const payload: Record<string, unknown> = {
        [config.nameColumn]: nome,
        ativo,
        created_by_user_id: importUserId,
        updated_by_user_id: importUserId,
        account_owner_id: owner,
      }
      if (userName) {
        payload.created_by_user_name = userName
        payload.updated_by_user_name = userName
      }
      if (config.relation && relationId) {
        payload[config.relation.field] = relationId
      }

      const { error: insertErr } = await supabaseUser.from(config.table).insert(payload)
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
      const key = `cadastro_base_erros_${crypto.randomUUID()}.csv`
      await supabaseAdmin.storage.from(errorsBucket).upload(key, new TextEncoder().encode(csv), {
        contentType: "text/csv",
      })
      const signed = await supabaseAdmin.storage.from(errorsBucket).createSignedUrl(key, 60 * 60)
      errorsUrl = signed.data?.signedUrl || null

      await deleteSource()

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
            table: config.table,
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
          table: config.table,
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
    console.error("cadastro-base-import error", stage, e.message, e.stack)
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
