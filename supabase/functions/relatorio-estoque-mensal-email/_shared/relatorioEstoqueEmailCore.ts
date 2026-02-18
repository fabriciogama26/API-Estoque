import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { buildRelatorioEstoqueHtml } from "./relatorioEstoqueTemplate.ts"

const REPORT_TYPE_MENSAL = "mensal"
const EMAIL_STATUS_PENDENTE = "pendente"
const EMAIL_STATUS_ENVIADO = "enviado"
const EMAIL_STATUS_ERRO = "erro"

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

const formatMonthRef = (date: Date | string | null | undefined) => {
  if (!date) return ""
  const d = new Date(date)
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0")
  const ano = d.getUTCFullYear()
  return `${mes}/${ano}`
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
    supabaseAdmin.from("app_credentials_catalog").select("id_text"),
    "Falha ao listar credenciais.",
  )
  const credenciais = Array.from(
    new Set(
      (registros ?? [])
        .map((item: any) => String(item.id_text ?? "").trim().toLowerCase())
        .filter((id) => id && ["admin", "master"].includes(id)),
    ),
  )

  return credenciais.length ? credenciais : ["admin", "master"]
}

const listarAdminsOwner = async (ownerId: string, credenciaisAdminIds: string[]) => {
  if (!ownerId) return []
  const credIds = credenciaisAdminIds ?? []
  if (!credIds.length) return []

  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id, username, display_name, email, parent_user_id, credential")
    .in("credential", credIds)
    .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`)

  return (data ?? [])
    .filter((item) => item?.email)
    .map((item) => ({
      id: item.id,
      nome: trim(item.display_name ?? item.username ?? item.email ?? ""),
      email: trim(item.email ?? ""),
    }))
    .filter((item) => item.email)
}

const sendBrevoEmail = async ({
  sender,
  to,
  subject,
  text,
  html,
}: {
  sender: { name: string; email: string }
  to: Array<{ name: string; email: string }>
  subject: string
  text?: string
  html?: string
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
  if (text) {
    payload.textContent = text
  }
  if (html) {
    payload.htmlContent = html
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

const buildReportText = (contexto: Record<string, unknown>) => {
  const periodoInicio = (contexto as any).periodo_inicio ?? ""
  const periodoFim = (contexto as any).periodo_fim ?? ""
  const periodo =
    periodoInicio && periodoFim ? `${periodoInicio} a ${periodoFim}` : "Periodo nao informado"
  return `Relatorio mensal de estoque\nPeriodo: ${periodo}`
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
      .eq("metadados->>tipo", REPORT_TYPE_MENSAL)
      .order("periodo_inicio", { ascending: false })
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

export const assertRelatorioEmailEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  if (!trim(Deno.env.get("BREVO_API_KEY"))) {
    throw new Error("Missing BREVO_API_KEY")
  }
}

export const runRelatorioEstoqueMensalEmail = async () => {
  assertRelatorioEmailEnv()
  const credenciaisAdminIds = await carregarCredenciaisAdminIds()
  const owners = await fetchOwners()
  const resultados: Array<Record<string, unknown>> = []

  for (const owner of owners ?? []) {
    const ownerId = (owner as any).id as string
    if (!ownerId) continue

    const latestReport = await loadLatestReport(ownerId)
    if (!latestReport) {
      continue
    }

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

    const admins = await listarAdminsOwner(ownerId, credenciaisAdminIds)
    const senderEmail = trim((owner as any).email ?? "") || admins[0]?.email || ""
    const senderName = trim((owner as any).display_name ?? (owner as any).username ?? (owner as any).email ?? "Sistema")

    if (!senderEmail || !admins.length) {
      const tentativas = Number((latestReport as any).email_tentativas ?? 0) + 1
      await updateEmailStatus(ownerId, latestReport.id, {
        email_status: EMAIL_STATUS_ERRO,
        email_erro: "Sem destinatarios para envio.",
        email_tentativas: tentativas,
      })
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: "Sem destinatarios para envio.",
      })
      continue
    }

    const contexto = (latestReport as any).metadados?.contexto ?? null
    const tentativas = Number((latestReport as any).email_tentativas ?? 0) + 1
    if (!contexto) {
      await updateEmailStatus(ownerId, latestReport.id, {
        email_status: EMAIL_STATUS_ERRO,
        email_erro: "Contexto do relatorio nao encontrado.",
        email_tentativas: tentativas,
      })
      resultados.push({
        ownerId,
        reportId: latestReport.id,
        status: EMAIL_STATUS_ERRO,
        error: "Contexto do relatorio nao encontrado.",
      })
      continue
    }

    const html = buildRelatorioEstoqueHtml({ contexto, empresa: resolveEmpresaInfo() })
    const subject = `Relatorio mensal de estoque - ${formatMonthRef((latestReport as any).periodo_inicio)}`
    const emailStatus = await sendBrevoEmail({
      sender: { name: senderName, email: senderEmail },
      to: admins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email })),
      subject,
      text: buildReportText(contexto),
      html,
    })

    await updateEmailStatus(ownerId, latestReport.id, {
      email_status: emailStatus.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
      email_enviado_em: emailStatus.ok ? nowIso() : (latestReport as any).email_enviado_em ?? null,
      email_erro: emailStatus.ok ? null : (emailStatus as any).error,
      email_tentativas: tentativas,
    })

    resultados.push({
      ownerId,
      reportId: latestReport.id,
      status: emailStatus.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
      error: emailStatus.ok ? null : (emailStatus as any).error,
    })
  }

  return { ok: true, total: resultados.length, resultados }
}
