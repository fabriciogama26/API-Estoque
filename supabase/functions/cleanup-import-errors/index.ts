import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
const bucket = Deno.env.get("ERRORS_BUCKET") || "imports"
const cronSecret = Deno.env.get("CRON_SECRET") || ""

const clampInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsed), 3650))
}

const retentionDays = clampInt(Deno.env.get("ERRORS_RETENTION_DAYS"), 1) // o supabase-js tem um limite de 3650, mas na prática provavelmente não faz sentido reter por tanto tempo
const pageSize = clampInt(Deno.env.get("ERRORS_CLEANUP_PAGE_SIZE"), 500) // o supabase-js tem um limite de 1000, mas na prática 500 é mais seguro pra evitar timeouts

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  },
})
const supabaseAuth = supabaseUrl && anonKey
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  : null

const readBearerToken = (req: Request) => {
  const authHeader = req.headers.get("authorization") || ""
  const match = authHeader.match(/Bearer\s+(.+)/i)
  return match?.[1]?.trim() || null
}

const resolveActorUserId = async (req: Request) => {
  if (!supabaseAuth) return null
  const token = readBearerToken(req)
  if (!token) return null
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user?.id) return null
  return data.user.id
}

const isAuthorized = (req: Request) => {
  if (!cronSecret) return true
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  const authHeader = req.headers.get("authorization") || ""
  const match = authHeader.match(/Bearer\s+(.+)/i)
  const bearerToken = match?.[1]?.trim() || ""
  return headerToken === cronSecret || bearerToken === cronSecret
}

const importPrefixes = [
  "desligamento/",
  "cadastro/",
  "entradas/",
  "acidentes/",
  "cadastro-base/",
  "relatorios-semanais/",
]

function isErrorCsv(path: string) {
  const s = path.toLowerCase()
  return s.includes("_erros_") && s.endsWith(".csv")
}

function isImportSource(path: string) {
  const s = path.toLowerCase()
  return importPrefixes.some((prefix) => s.startsWith(prefix)) && s.endsWith(".xlsx")
}

function isWeeklyReportCsv(path: string) {
  const s = path.toLowerCase()
  return s.startsWith("relatorios-semanais/") && s.endsWith(".csv")
}

function extractTs(obj: any): number | null {
  const candidates = [
    obj?.created_at,
    obj?.updated_at,
    obj?.last_modified,
    obj?.metadata?.created_at,
    obj?.metadata?.updated_at,
    obj?.metadata?.lastModified,
    obj?.metadata?.last_modified,
  ].filter(Boolean)

  for (const v of candidates) {
    const t = Date.parse(String(v))
    if (!Number.isNaN(t)) return t
  }
  return null
}

async function listAll(prefix: string) {
  const out: any[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    } as any)

    if (error) throw new Error(`list("${prefix}") failed: ${error.message}`)
    if (!data || data.length === 0) break

    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

async function listImportEntries() {
  const entries: { path: string; ts: number | null }[] = []

  const rootList = await listAll("")
  rootList.forEach((item) => {
    const name = String(item?.name ?? "")
    if (!name) return
    entries.push({ path: name, ts: extractTs(item) })
  })

  for (const prefix of importPrefixes) {
    const topLevel = await listAll(prefix)
    topLevel.forEach((item) => {
      const name = String(item?.name ?? "")
      if (!name) return
      entries.push({ path: `${prefix}${name}`, ts: extractTs(item) })
    })

    if (prefix === "cadastro-base/") {
      for (const item of topLevel) {
        const name = String(item?.name ?? "")
        if (!name) continue
        const nestedPrefix = `${prefix}${name}/`
        const nested = await listAll(nestedPrefix)
        nested.forEach((child) => {
          const childName = String(child?.name ?? "")
          if (!childName) return
          entries.push({ path: `${nestedPrefix}${childName}`, ts: extractTs(child) })
        })
      }
    }

    if (prefix === "relatorios-semanais/") {
      for (const item of topLevel) {
        const ownerName = String(item?.name ?? "")
        if (!ownerName) continue
        const ownerPrefix = `${prefix}${ownerName}/`
        const periods = await listAll(ownerPrefix)
        periods.forEach((periodItem) => {
          const periodName = String(periodItem?.name ?? "")
          if (!periodName) return
          entries.push({ path: `${ownerPrefix}${periodName}`, ts: extractTs(periodItem) })
        })

        for (const period of periods) {
          const periodName = String(period?.name ?? "")
          if (!periodName) continue
          const periodPrefix = `${ownerPrefix}${periodName}/`
          const periodFiles = await listAll(periodPrefix)
          periodFiles.forEach((fileItem) => {
            const fileName = String(fileItem?.name ?? "")
            if (!fileName) return
            entries.push({ path: `${periodPrefix}${fileName}`, ts: extractTs(fileItem) })
          })
        }
      }
    }
  }

  const unique = new Map<string, number | null>()
  entries.forEach((entry) => {
    if (!entry.path) return
    if (!unique.has(entry.path)) unique.set(entry.path, entry.ts ?? null)
  })

  return Array.from(unique.entries()).map(([path, ts]) => ({ path, ts }))
}

async function deleteInBatches(paths: string[], dryRun: boolean) {
  const batchSize = 25
  let deleted = 0
  const errors: { path: string; message: string }[] = []

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize)
    if (dryRun) continue

    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch)
    if (error) errors.push({ path: batch.join(","), message: error.message })
    else deleted += batch.length
  }

  return { deleted, errors }
}

// tenta salvar e NUNCA derruba a funÃ§Ã£o por causa disso
async function saveRunToDb(row: Record<string, any>) {
  const { error } = await supabaseAdmin.from("edge_functions_error_report").insert(row)
  if (error) console.log("WARN insert edge_functions_error_report:", error.message)
}

function getSbRequestId(req: Request) {
  // quando a chamada vem via gateway, esse header normalmente existe
  return req.headers.get("x-sb-request-id") || req.headers.get("sb-request-id") || null
}

Deno.serve(async (req) => {
  const t0 = Date.now()
  let httpStatus = 200

  // valores que a gente quer salvar independentemente do resultado
  const baseRow: any = {
    function_name: "cleanup-import-errors",
    bucket,
    retention_days: retentionDays,
    cutoff: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    dry_run: true,
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

  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    baseRow.user_id = await resolveActorUserId(req)
    if (req.method !== "POST") {
      httpStatus = 405
      baseRow.http_status = httpStatus
      baseRow.error_message = "Method not allowed"
      baseRow.duration_ms = Date.now() - t0
      await saveRunToDb(baseRow)
      return new Response("Method not allowed", { status: 405, headers: corsHeaders })
    }

    if (!supabaseUrl || !serviceRoleKey) {
      httpStatus = 500
      baseRow.http_status = httpStatus
      baseRow.error_message = "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      baseRow.duration_ms = Date.now() - t0
      await saveRunToDb(baseRow)
      return new Response(JSON.stringify({ ok: false, message: baseRow.error_message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!isAuthorized(req)) {
      httpStatus = 401
      baseRow.http_status = httpStatus
      baseRow.error_message = "Unauthorized"
      baseRow.duration_ms = Date.now() - t0
      await saveRunToDb(baseRow)
      return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = Boolean((body as any)?.dryRun ?? (body as any)?.dry_run ?? false)
    const maxDeletesRaw = (body as any)?.maxDeletes ?? (body as any)?.max_deletes ?? null
    const maxDeletes = maxDeletesRaw == null ? null : clampInt(String(maxDeletesRaw), 200)

    baseRow.dry_run = dryRun

    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const cutoffIso = new Date(cutoffMs).toISOString()
    baseRow.cutoff = cutoffIso

    const allEntries = await listImportEntries()
    const allPaths = allEntries.map((entry) => entry.path)
    baseRow.total_listed = allPaths.length

    const tsMap = new Map<string, number | null>()
    allEntries.forEach((entry) => tsMap.set(entry.path, entry.ts ?? null))

    const hasAnyTs = allEntries.some((entry) => entry.ts != null)
    if (!hasAnyTs) {
  const durationMs = Date.now() - t0

  // grava no histÃ³rico como execuÃ§Ã£o OK (sem deleÃ§Ã£o)
  await saveRunToDb({
    ...baseRow,
    http_status: 200,
    error_message: null,
    error_stack: null,
    errors_count: 0,
    duration_ms: durationMs,
    details: {
      note: "Sem timestamps no storage.list(); tratando como pasta vazia/sem metadados. Nenhum arquivo deletado.",
      hint: "Verifique prefixo. Ã€s vezes 'desligamento' vs 'desligamento/' muda a resposta.",
      sample_list_item: allEntries?.[0] ?? null,
    },
  })

  return new Response(
    JSON.stringify({
      ok: true,
      dryRun,
      bucket,
      retentionDays,
      cutoff: cutoffIso,
      totalListed: allPaths.length,
      candidates: 0,
      deleted: 0,
      errors: [],
      note: "Sem timestamps retornados. Tratado como pasta vazia/sem metadados. Nada foi deletado.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
}


    const candidatesAll = allPaths.filter((p) => {
      const ts = tsMap.get(p)
      if (ts == null) return false
      if (!(isErrorCsv(p) || isImportSource(p) || isWeeklyReportCsv(p))) return false
      return ts <= cutoffMs
    })

    const candidates = maxDeletes ? candidatesAll.slice(0, maxDeletes) : candidatesAll
    baseRow.candidates = candidates.length

    const { deleted, errors } = await deleteInBatches(candidates, dryRun)

    baseRow.deleted = deleted
    baseRow.errors_count = errors.length
    baseRow.http_status = 200
    baseRow.duration_ms = Date.now() - t0
    baseRow.details = {
      max_deletes: maxDeletes,
      prefixes: importPrefixes,
      sample_candidates: candidates.slice(0, 10),
      sample_errors: errors.slice(0, 10),
    }

    await saveRunToDb(baseRow)

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        bucket,
        retentionDays,
        cutoff: cutoffIso,
        totalListed: allPaths.length,
        candidates: candidates.length,
        deleted,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e: any) {
    httpStatus = 500
    baseRow.http_status = httpStatus
    baseRow.error_message = String(e?.message ?? e)
    baseRow.error_stack = typeof e?.stack === "string" ? e.stack : null
    baseRow.errors_count = 1
    baseRow.duration_ms = Date.now() - t0
    baseRow.details = { stage: "unhandled" }

    await saveRunToDb(baseRow)

    return new Response(JSON.stringify({ ok: false, error: baseRow.error_message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
