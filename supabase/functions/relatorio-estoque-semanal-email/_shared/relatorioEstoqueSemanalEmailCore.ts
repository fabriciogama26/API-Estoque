
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const REPORT_TYPE_SEMANAL = "semanal"
const EMAIL_STATUS_PENDENTE = "pendente"
const EMAIL_STATUS_ENVIADO = "enviado"
const EMAIL_STATUS_ERRO = "erro"
const STORAGE_BUCKET = Deno.env.get("RELATORIO_SEMANAL_BUCKET") || "imports"
const REPORT_TIMEZONE = Deno.env.get("RELATORIO_SEMANAL_TIMEZONE") || "America/Sao_Paulo"
const MAX_TOTAL_BYTES = 20 * 1024 * 1024
const MAX_RECIPIENTS = 99

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  },
})

const trim = (value: unknown) => {
  if (value === undefined || value === null) {
    return ""
  }
  return String(value).trim()
}

const nowIso = () => new Date().toISOString()

const formatLocalDateTime = (value: unknown) => {
  if (!value) return ""
  const date = new Date(value as any)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

const formatPeriodoLabel = (inicio: unknown, fim: unknown) => {
  const inicioText = formatLocalDateTime(inicio)
  const fimText = formatLocalDateTime(fim)
  if (inicioText && fimText) return `${inicioText} a ${fimText}`
  return inicioText || fimText || "Periodo nao informado"
}

const resolveEmpresaInfo = () => {
  return {
    nome: Deno.env.get("TERMO_EPI_EMPRESA_NOME") || "",
    documento: Deno.env.get("TERMO_EPI_EMPRESA_DOCUMENTO") || "",
    endereco: Deno.env.get("TERMO_EPI_EMPRESA_ENDERECO") || "",
    contato: Deno.env.get("TERMO_EPI_EMPRESA_CONTATO") || "",
    logoUrl: Deno.env.get("TERMO_EPI_EMPRESA_LOGO_URL") || "",
    logoSecundarioUrl: Deno.env.get("TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL") || "",
  }
}

const resolveSenderInfo = () => {
  const empresa = resolveEmpresaInfo()
  const email = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM") || "")
  const name = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM_NAME") || "") || trim(empresa.nome || "") || "Sistema"
  const replyTo = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_REPLY_TO") || "")
  return { email, name, replyTo }
}

const execute = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const executeSingle = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder.single()
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const carregarCredenciaisAdminIds = async () => {
  const registros = await execute(
    supabaseAdmin.from("app_credentials_catalog").select("id, id_text"),
    "Falha ao listar credenciais.",
  )

  const adminTextIds = Array.from(
    new Set(
      (registros ?? [])
        .map((item: any) => String(item.id_text ?? "").trim().toLowerCase())
        .filter((id) => id && ["admin", "master"].includes(id)),
    ),
  )

  const adminUuidIds = Array.from(
    new Set(
      (registros ?? [])
        .filter((item: any) => {
          const idText = String(item.id_text ?? "").trim().toLowerCase()
          return idText === "admin" || idText === "master"
        })
        .map((item: any) => String(item.id ?? "").trim())
        .filter(Boolean),
    ),
  )

  return {
    adminTextIds: adminTextIds.length ? adminTextIds : ["admin", "master"],
    adminUuidIds,
  }
}

const listarAdminsOwner = async (
  ownerId: string,
  credenciais: { adminTextIds: string[]; adminUuidIds: string[] },
) => {
  if (!ownerId) return []
  const credTextIds = credenciais?.adminTextIds ?? []
  const credUuidIds = credenciais?.adminUuidIds ?? []
  if (!credTextIds.length && !credUuidIds.length) return []

  const { data: dataText } = await supabaseAdmin
    .from("app_users")
    .select("id, username, display_name, email, parent_user_id, credential")
    .in("credential", credTextIds)
    .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`)

  const { data: dataUuid } = credUuidIds.length
    ? await supabaseAdmin
        .from("app_users")
        .select("id, username, display_name, email, parent_user_id, credential")
        .in("credential", credUuidIds)
        .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`)
    : { data: [] }

  const combined = [...(dataText ?? []), ...(dataUuid ?? [])]
  const uniqueById = new Map<string, any>()
  for (const row of combined) {
    if (row?.id) uniqueById.set(String(row.id), row)
  }

  return Array.from(uniqueById.values())
    .filter((item) => item?.email)
    .map((item) => ({
      id: item.id,
      nome: trim(item.display_name ?? item.username ?? item.email ?? ""),
      email: trim(item.email ?? ""),
    }))
    .filter((item) => item.email)
}

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize))
  }
  return btoa(binary)
}

const sendBrevoEmail = async ({
  sender,
  replyTo,
  to,
  subject,
  text,
  html,
  attachments,
}: {
  sender: { name: string; email: string }
  replyTo?: { name?: string; email: string }
  to: Array<{ name: string; email: string }>
  subject: string
  text?: string
  html?: string
  attachments?: Array<{ name: string; content: string }>
}) => {
  const apiKey = (Deno.env.get("BREVO_API_KEY") || "").trim()
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY nao configurada." }
  }
  if (!to?.length) {
    return { ok: false, error: "Sem destinatarios para envio." }
  }

  const payload: Record<string, unknown> = {
    sender,
    to,
    subject,
  }
  if (replyTo?.email) {
    payload.replyTo = replyTo
  }
  if (text) {
    payload.textContent = text
  }
  if (html) {
    payload.htmlContent = html
  }
  if (attachments && attachments.length) {
    payload.attachment = attachments
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    return { ok: false, error: errorText || `Erro ao enviar email (${response.status}).` }
  }

  return { ok: true }
}

const buildReportText = (periodo: string) => {
  return `Relatorio semanal de movimentacao\nPeriodo: ${periodo}`
}

const buildEmailHtml = ({
  empresa,
  periodo,
  arquivos,
}: {
  empresa: Record<string, string>
  periodo: string
  arquivos: Array<{ name: string }>
}) => {
  const logoPrincipal = empresa?.logoUrl
    ? `<img src="${empresa.logoUrl}" alt="logo" style="height:56px;max-width:260px;object-fit:contain;display:block;" />`
    : ""
  const logoSecundario = empresa?.logoSecundarioUrl
    ? `<img src="${empresa.logoSecundarioUrl}" alt="logo" style="height:44px;max-width:180px;object-fit:contain;display:block;" />`
    : ""
  const arquivosList = (arquivos ?? [])
    .map((item) => `<li style="margin:4px 0;">${item.name}</li>`)
    .join("")

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Relatorio semanal de movimentacao</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:20px;width:100%;">
          <div style="flex:1;display:flex;align-items:center;">
            ${logoPrincipal}
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;">
            ${logoSecundario}
          </div>
        </div>
        <h1 style="margin:0 0 12px 0;font-size:20px;">Relatorio semanal de movimentacao</h1>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">
          Segue o relatorio semanal com os arquivos CSV anexados.
        </p>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">
          <strong>Periodo:</strong> ${periodo}
        </p>
        <div style="margin:16px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Arquivos anexados</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;">${arquivosList}</ul>
        </div>
        <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;">
          Este e um email automatico. Nao responda.
        </p>
      </div>
    </div>
  </body>
</html>`
}

const fetchOwners = async () => {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, username, display_name, ativo, parent_user_id")
    .is("parent_user_id", null)
  if (error) {
    throw new Error(`Falha ao listar owners: ${error.message}`)
  }
  return (data || []).filter((row) => row?.ativo !== false && row?.id)
}

const loadLatestReport = async (ownerId: string) => {
  const data = await execute(
    supabaseAdmin
      .from("inventory_report")
      .select("id, periodo_inicio, periodo_fim, metadados, email_tentativas, email_enviado_em, email_status")
      .eq("account_owner_id", ownerId)
      .eq("metadados->>tipo", REPORT_TYPE_SEMANAL)
      .order("periodo_inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    "Falha ao consultar relatorios.",
  )
  return (data ?? [])[0] ?? null
}

const updateEmailStatus = async (
  ownerId: string,
  reportId: string,
  payload: Record<string, unknown>,
) => {
  return executeSingle(
    supabaseAdmin
      .from("inventory_report")
      .update(payload)
      .eq("account_owner_id", ownerId)
      .eq("id", reportId)
      .select("id"),
    "Falha ao atualizar status de email.",
  )
}

const loadAttachments = async (arquivos: any[]) => {
  const attachments: Array<{ name: string; content: string; size: number }> = []
  for (const arquivo of arquivos ?? []) {
    const path = trim(arquivo?.path)
    const name = trim(arquivo?.filename || arquivo?.name || path.split("/").pop() || "arquivo.csv")
    if (!path) continue

    const { data, error } = await supabaseAdmin.storage.from(arquivo?.bucket || STORAGE_BUCKET).download(path)
    if (error || !data) {
      throw new Error(`Falha ao baixar anexo ${name}: ${error?.message || "arquivo nao encontrado"}`)
    }
    const buffer = await data.arrayBuffer()
    const content = toBase64(buffer)
    attachments.push({ name, content, size: buffer.byteLength })
  }
  return attachments
}

export const assertRelatorioSemanalEmailEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  if (!trim(Deno.env.get("BREVO_API_KEY"))) {
    throw new Error("Missing BREVO_API_KEY")
  }
  if (!trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM"))) {
    throw new Error("Missing RELATORIO_ESTOQUE_EMAIL_FROM")
  }
}

export const runRelatorioEstoqueSemanalEmail = async ({
  testEmail,
  testOwnerId,
}: {
  testEmail?: string
  testOwnerId?: string
} = {}) => {
  assertRelatorioSemanalEmailEnv()
  const normalizedTestEmail = trim(testEmail).toLowerCase()
  const normalizedTestOwnerId = trim(testOwnerId)
  if (normalizedTestEmail && !normalizedTestEmail.includes("@")) {
    throw new Error("test_email invalido.")
  }
  const isTestMode = Boolean(normalizedTestEmail)
  const credenciaisAdminIds = await carregarCredenciaisAdminIds()
  let owners = await fetchOwners()
  if (normalizedTestOwnerId) {
    owners = owners.filter((row: any) => String(row?.id ?? "") === normalizedTestOwnerId)
  }
  const resultados: Array<Record<string, unknown>> = []
  let testSent = false
  const senderInfo = resolveSenderInfo()
  if (!senderInfo.email) {
    throw new Error("Remetente de email nao configurado.")
  }

  for (const owner of owners ?? []) {
    if (isTestMode && testSent) break
    const ownerId = (owner as any).id as string
    if (!ownerId) continue

    const latestReport = await loadLatestReport(ownerId)
    if (!latestReport) {
      continue
    }

    if (!isTestMode) {
      const rawStatus = trim((latestReport as any).email_status ?? "")
      const normalizedStatus = rawStatus || EMAIL_STATUS_PENDENTE
      if (![EMAIL_STATUS_PENDENTE, EMAIL_STATUS_ERRO].includes(normalizedStatus)) {
        resultados.push({
          ownerId,
          reportId: latestReport.id,
          status: normalizedStatus,
          skipped: true,
          reason: "ultimo_relatorio_ja_enviado",
        })
        continue
      }
    }

    const admins = await listarAdminsOwner(ownerId, credenciaisAdminIds)
    const senderEmail = senderInfo.email
    const senderName = senderInfo.name

    if (!senderEmail || (!admins.length && !isTestMode)) {
      if (!isTestMode) {
        const tentativas = Number((latestReport as any).email_tentativas ?? 0) + 1
        await updateEmailStatus(ownerId, latestReport.id, {
          email_status: EMAIL_STATUS_ERRO,
          email_erro: "Sem destinatarios para envio.",
          email_tentativas: tentativas,
        })
      }
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: "Sem destinatarios para envio.",
      })
      continue
    }

    const metadados = (latestReport as any).metadados ?? null
    const tentativas = Number((latestReport as any).email_tentativas ?? 0) + 1
    const arquivos = Array.isArray(metadados?.arquivos) ? metadados.arquivos : []
    if (!arquivos.length) {
      if (!isTestMode) {
        await updateEmailStatus(ownerId, latestReport.id, {
          email_status: EMAIL_STATUS_ERRO,
          email_erro: "Arquivos do relatorio nao encontrados.",
          email_tentativas: tentativas,
        })
      }
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: "Arquivos do relatorio nao encontrados.",
      })
      continue
    }

    const periodoInicioRef =
      metadados?.periodo_inicio_ts || (latestReport as any).periodo_inicio
    const periodoFimRef =
      metadados?.periodo_fim_ts || (latestReport as any).periodo_fim
    const periodoLabel = formatPeriodoLabel(periodoInicioRef, periodoFimRef)
    let attachments: Array<{ name: string; content: string; size: number }> = []
    try {
      attachments = await loadAttachments(arquivos)
    } catch (error: any) {
      if (!isTestMode) {
        await updateEmailStatus(ownerId, latestReport.id, {
          email_status: EMAIL_STATUS_ERRO,
          email_erro: String(error?.message ?? error),
          email_tentativas: tentativas,
        })
      }
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: String(error?.message ?? error),
      })
      continue
    }

    const totalBytes = attachments.reduce((acc, item) => acc + Number(item.size || 0), 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      const errorMessage = `Anexos excedem limite (${Math.round(totalBytes / 1024 / 1024)}MB).`
      if (!isTestMode) {
        await updateEmailStatus(ownerId, latestReport.id, {
          email_status: EMAIL_STATUS_ERRO,
          email_erro: errorMessage,
          email_tentativas: tentativas,
        })
      }
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: errorMessage,
      })
      continue
    }

    const destinatarios = isTestMode
      ? [{ name: normalizedTestEmail, email: normalizedTestEmail }]
      : admins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email }))

    if (!isTestMode && destinatarios.length > MAX_RECIPIENTS) {
      const errorMessage = `Destinatarios excedem limite (${destinatarios.length}/${MAX_RECIPIENTS}).`
      await updateEmailStatus(ownerId, latestReport.id, {
        email_status: EMAIL_STATUS_ERRO,
        email_erro: errorMessage,
        email_tentativas: tentativas,
      })
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: errorMessage,
      })
      continue
    }

    const replyTo = senderInfo.replyTo ? { name: senderName, email: senderInfo.replyTo } : undefined
    const emailStatus = await sendBrevoEmail({
      sender: { name: senderName, email: senderEmail },
      replyTo,
      to: destinatarios,
      subject: `Relatorio semanal de movimentacao - ${periodoLabel}`,
      text: buildReportText(periodoLabel),
      html: buildEmailHtml({ empresa: resolveEmpresaInfo(), periodo: periodoLabel, arquivos: attachments }),
      attachments: attachments.map((item) => ({ name: item.name, content: item.content })),
    })

    if (!isTestMode) {
      await updateEmailStatus(ownerId, latestReport.id, {
        email_status: emailStatus.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
        email_enviado_em: emailStatus.ok ? nowIso() : (latestReport as any).email_enviado_em ?? null,
        email_erro: emailStatus.ok ? null : (emailStatus as any).error,
        email_tentativas: tentativas,
      })
    }

    resultados.push({
      ownerId,
      reportId: latestReport.id,
      status: emailStatus.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
      error: emailStatus.ok ? null : (emailStatus as any).error,
    })
    if (isTestMode) {
      testSent = true
    }
  }

  const warnings: string[] = []
  if (isTestMode && !normalizedTestOwnerId) {
    warnings.push("test_email usado sem test_owner_id; envio limitado a 1 owner.")
  }

  return {
    ok: true,
    total: resultados.length,
    resultados,
    test: isTestMode,
    warnings: warnings.length ? warnings : undefined,
  }
}
