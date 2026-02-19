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

const resolveSenderInfo = () => {
  const empresa = resolveEmpresaInfo()
  const email = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM") || "")
  const name =
    trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM_NAME") || "") ||
    trim(empresa.nome || "") ||
    "Sistema"
  return { email, name }
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
  if (!trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM"))) {
    throw new Error("Missing RELATORIO_ESTOQUE_EMAIL_FROM")
  }
}

export const runRelatorioEstoqueMensalEmail = async ({
  testEmail,
  testOwnerId,
}: {
  testEmail?: string
  testOwnerId?: string
} = {}) => {
  assertRelatorioEmailEnv()
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

    const contexto = (latestReport as any).metadados?.contexto ?? null
    const tentativas = Number((latestReport as any).email_tentativas ?? 0) + 1
    if (!contexto) {
      if (!isTestMode) {
        await updateEmailStatus(ownerId, latestReport.id, {
          email_status: EMAIL_STATUS_ERRO,
          email_erro: "Contexto do relatorio nao encontrado.",
          email_tentativas: tentativas,
        })
      }
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
    const destinatarios = isTestMode
      ? [{ name: normalizedTestEmail, email: normalizedTestEmail }]
      : admins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email }))
    const emailStatus = await sendBrevoEmail({
      sender: { name: senderName, email: senderEmail },
      to: destinatarios,
      subject,
      text: buildReportText(contexto),
      html,
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
