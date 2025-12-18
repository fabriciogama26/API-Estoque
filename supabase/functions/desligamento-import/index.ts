// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import * as XLSX from "npm:xlsx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

let stage = "init"
let sourcePath: string | null = null

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
const errorsBucket = Deno.env.get("ERRORS_BUCKET") || "imports"

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

type Linha = { matricula?: string; data_demissao?: string; ativo?: string }

// Aceita texto dd/MM/yyyy, serial do Excel ou objeto Date.
const parseDate = (valor?: unknown) => {
  if (valor === null || valor === undefined) return null

  // Date
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const yyyy = valor.getFullYear()
    const mm = String(valor.getMonth() + 1).padStart(2, "0")
    const dd = String(valor.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  // Serial do Excel (número) - converte usando epoch 1899-12-30
  if (typeof valor === "number" && isFinite(valor)) {
    const excelEpoch = Date.UTC(1899, 11, 30) // Excel epoch in UTC
    const ms = excelEpoch + valor * 24 * 60 * 60 * 1000
    const date = new Date(ms)
    if (isNaN(date.getTime())) return null
    const yyyy = String(date.getUTCFullYear()).padStart(4, "0")
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(date.getUTCDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  // Texto dd/MM/yyyy
  const raw = String(valor).trim()
  if (!raw) return null
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

const buildMatriculaKeys = (valor?: string | number | null) => {
  const base = (valor ?? "").toString().trim()
  if (!base) return []
  const noZeros = base.replace(/^0+/, "") || "0"
  const keys = new Set<string>()
  keys.add(base)
  keys.add(noZeros)
  return Array.from(keys)
}

const resolveField = (row: Record<string, unknown>, target: string) => {
  const targetKey = target.trim().toLowerCase()
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === targetKey) {
      return value
    }
  }
  return undefined
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

    stage = "read_body"
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ ok: false, stage, message: "Body precisa ser JSON: { path: string }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const path = body?.path
    if (!path || typeof path !== "string") return new Response("path obrigatório", { status: 400, headers: corsHeaders })
    if (!path.toLowerCase().endsWith(".xlsx")) return new Response("Apenas XLSX", { status: 400, headers: corsHeaders })
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
    const rows = XLSX.utils.sheet_to_json<Linha>(sheet, { defval: "" })
    const headerKeys = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : []

    let processed = 0
    let success = 0
    let errors = 0
    const errorLines: string[] = ["linha,coluna,motivo"]

    // Coleta matriculas únicas do arquivo e gera variantes (com/sem zeros à esquerda)
    const matriculasArquivo = new Set<string>()
    rows.forEach((linha) => {
      const valor = resolveField(linha as Record<string, unknown>, "matricula")
      buildMatriculaKeys(valor as string | number | null).forEach((k) => {
        if (k) matriculasArquivo.add(k)
      })
    })

    // Busca apenas as matrículas presentes no arquivo (em blocos para evitar limites de IN)
    stage = "db_select_pessoas"
    let pessoasCount = 0
    const matriculaMap = new Map<string, string>()
    if (matriculasArquivo.size > 0) {
      const chunkSize = 100
      const matriculasArray = Array.from(matriculasArquivo)
      for (let i = 0; i < matriculasArray.length; i += chunkSize) {
        const slice = matriculasArray.slice(i, i + chunkSize)
        const { data: pessoas, error: pessoasErr, count } = await supabaseAdmin
          .from("pessoas")
          .select("id, matricula", { count: "exact" })
          .in("matricula", slice)
        if (pessoasErr) return new Response(pessoasErr.message, { status: 500, headers: corsHeaders })
        if (count && count > pessoasCount) pessoasCount = count
        ;(pessoas || []).forEach((p) => {
          buildMatriculaKeys(p.matricula).forEach((key) => matriculaMap.set(key, p.id))
        })
      }
    }
    const sampleMatriculas = Array.from(matriculaMap.keys()).slice(0, 5)

    const updates: { id: string; ativo: boolean; dataDemissao: string | null; matricula: string }[] = []
    const pushError = (line: number, col: string, motivo: string) => {
      errors += 1
      errorLines.push(`${line},${col},"${motivo}"`)
    }

    for (let i = 0; i < rows.length; i++) {
      processed += 1
      const idx = i + 2 // +1 cabeçalho
      const linha = rows[i]

      const matriculaValor = resolveField(linha as Record<string, unknown>, "matricula")
      const ativoValor = resolveField(linha as Record<string, unknown>, "ativo")
      const dataDemissaoValor = resolveField(linha as Record<string, unknown>, "data_demissao")

      const matriculaKeys = buildMatriculaKeys(matriculaValor as string | number | null)
      if (!matriculaKeys.length) {
        pushError(idx, "matricula", "obrigatoria")
        continue
      }
      const pessoaId = matriculaKeys.map((k) => matriculaMap.get(k)).find(Boolean)
      if (!pessoaId) {
        pushError(idx, "matricula", `inexistente (${matriculaKeys.join("/") || "vazio"})`)
        continue
      }

      const ativoTexto = (ativoValor ?? "").toString().trim().toLowerCase()
      if (!["true", "false"].includes(ativoTexto)) {
        pushError(idx, "ativo", "deve ser true/false")
        continue
      }

      const dataDemissaoIso = parseDate(dataDemissaoValor)
      if (dataDemissaoValor && !dataDemissaoIso) {
        pushError(idx, "data_demissao", "invalida")
        continue
      }

      updates.push({
        id: pessoaId,
        ativo: ativoTexto === "true",
        dataDemissao: dataDemissaoIso,
        matricula: (matriculaValor ?? "").toString().trim(),
      })
    }

    if (updates.length) {
      stage = "db_upsert_pessoas"
      const now = new Date().toISOString()
      const { error: updErr } = await supabaseAdmin
        .from("pessoas")
        .upsert(
          updates.map((u) => ({
            id: u.id,
            ativo: u.ativo,
            dataDemissao: u.dataDemissao,
            atualizadoEm: now,
            usuarioEdicao: importUserId,
          })),
          { onConflict: "id" },
        )
      if (updErr) return new Response(updErr.message, { status: 500, headers: corsHeaders })

      stage = "db_insert_historico"
      const historicoRows = updates.map((u) => ({
        pessoa_id: u.id,
        data_edicao: now,
        usuario_responsavel: importUserId,
        campos_alterados: [
          { campo: "matricula", para: u.matricula, de: "" },
          { campo: "ativo", para: u.ativo ? "Ativo" : "Inativo", de: "" },
          { campo: "dataDemissao", para: u.dataDemissao || "", de: "" },
        ],
      }))
      await supabaseAdmin.from("pessoas_historico").insert(historicoRows).catch(() => {})
      success = updates.length
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
        // best-effort, ignora falha ao remover
      }
    }

    if (errorLines.length > 1) {
      stage = "storage_upload_erros"
      errorSamples.push(...errorLines.slice(1, Math.min(errorLines.length, 6)))
      errorSamples.push(
        `debug_matriculas: total=${matriculaMap.size} samples=${sampleMatriculas.join("|") || "nenhuma"}`,
      )
      const csv = errorLines.join("\n")
      const key = `desligamento_erros_${crypto.randomUUID()}.csv`
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
            matriculasEncontradas: matriculaMap.size,
            pessoasCount,
            sampleMatriculas,
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
          matriculasEncontradas: matriculaMap.size,
          pessoasCount,
          sampleMatriculas,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    // Tenta limpar o arquivo mesmo em erro, se já tivermos o path
    if (sourcePath) {
      try {
        stage = "storage_delete_source"
        await supabaseAdmin.storage.from(errorsBucket).remove([sourcePath])
      } catch (_) {
        // ignore
      }
    }
    const e = err instanceof Error ? err : new Error(String(err))
    console.error("desligamento-import error", stage, e.message, e.stack)
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
