import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

// Alertas do Controle de Validades.
// Autocontido (sem imports fora da pasta da funcao), no mesmo padrao de relatorio-troca-epi-email/_shared.
// Regras de marco, status e idempotencia ficam no banco (rpc_validades_alertas_reservar/finalizar);
// este modulo apenas consolida os eventos reservados em um e-mail por tenant e registra o resultado.

const REPORT_TYPE = "validades-alertas"
const EMAIL_STATUS_PENDENTE = "pendente"
const EMAIL_STATUS_ENVIADO = "enviado"
const EMAIL_STATUS_ERRO = "erro"
const MAX_RECIPIENTS = 99
const MAX_TENTATIVAS = 3
const CREDENCIAIS_ADMIN = ["admin", "master"]

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

type EventoAlerta = {
  envio_id?: string
  realizacao_id: string
  tipo_alerta: "janela_critica" | "vencimento"
  data_vencimento: string
  dias_restantes: number
  pessoa_nome: string
  matricula: string | null
  requisito_nome: string
  requisito_codigo: string | null
  centro_servico: string | null
  setor: string | null
  cargo: string | null
  janela: number | null
}

type Contato = { name: string; email: string }

const trim = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim())

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatDateKey = (value: string) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value || ""
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

// ---------------------------------------------------------------------------
// Brevo (mesmo contrato e variaveis dos relatorios de estoque)
// ---------------------------------------------------------------------------

const resolveSenderInfo = () => {
  const email = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM"))
  const name =
    trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_FROM_NAME")) ||
    trim(Deno.env.get("TERMO_EPI_EMPRESA_NOME")) ||
    "Sistema"
  const replyTo = trim(Deno.env.get("RELATORIO_ESTOQUE_EMAIL_REPLY_TO"))
  return { email, name, replyTo }
}

const sendBrevoEmail = async ({
  sender,
  replyTo,
  to,
  subject,
  text,
  html,
}: {
  sender: Contato
  replyTo?: { name?: string; email: string }
  to: Contato[]
  subject: string
  text?: string
  html?: string
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const apiKey = trim(Deno.env.get("BREVO_API_KEY"))
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY nao configurada." }
  }
  if (!to?.length) {
    return { ok: false, error: "Sem destinatarios para envio." }
  }

  const payload: Record<string, unknown> = { sender, to, subject }
  if (replyTo?.email) payload.replyTo = replyTo
  if (text) payload.textContent = text
  if (html) payload.htmlContent = html

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

// ---------------------------------------------------------------------------
// Destinatarios: admin/master do tenant com e-mail (mesmo criterio do relatorio mensal)
// ---------------------------------------------------------------------------

const carregarCredenciaisAdmin = async () => {
  const { data, error } = await supabaseAdmin.from("app_credentials_catalog").select("id, id_text")
  if (error) {
    throw new Error(`Falha ao listar credenciais. ${error.message}`)
  }
  const uuidIds = Array.from(
    new Set(
      (data ?? [])
        .filter((item: Record<string, unknown>) => CREDENCIAIS_ADMIN.includes(trim(item.id_text).toLowerCase()))
        .map((item: Record<string, unknown>) => trim(item.id))
        .filter(Boolean),
    ),
  ) as string[]
  return [...CREDENCIAIS_ADMIN, ...uuidIds]
}

const listarAdminsOwner = async (ownerId: string, credenciais: string[]): Promise<Contato[]> => {
  if (!ownerId || !credenciais.length) return []
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, username, display_name, email, ativo, credential")
    .in("credential", credenciais)
    .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`)

  if (error) {
    throw new Error(`Falha ao listar administradores do tenant. ${error.message}`)
  }

  const unicos = new Map<string, Contato>()
  for (const row of data ?? []) {
    const email = trim(row?.email)
    if (!row?.id || !email || row?.ativo === false) continue
    unicos.set(email.toLowerCase(), { name: trim(row.display_name ?? row.username ?? email) || email, email })
  }
  return Array.from(unicos.values())
}

// ---------------------------------------------------------------------------
// Montagem do e-mail consolidado
// ---------------------------------------------------------------------------

// "Hoje" do tenant derivado do proprio evento (vencimento - dias restantes), sem recalcular timezone aqui.
const resolveDataReferencia = (evento: EventoAlerta) => {
  const [year, month, day] = String(evento.data_vencimento).slice(0, 10).split("-").map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() - Number(evento.dias_restantes || 0))
  return base.toISOString().slice(0, 10)
}

const situacaoVencimento = (dias: number) => {
  if (dias === 0) return "Vence hoje"
  const atraso = Math.abs(dias)
  return `Venceu ha ${atraso} dia${atraso === 1 ? "" : "s"}`
}

const renderTabela = (titulo: string, descricao: string, itens: EventoAlerta[], colunaFinal: "dias" | "situacao") => {
  if (!itens.length) return ""
  const cellStyle = "padding:8px;border-bottom:1px solid #e2e8f0;"
  const linhas = itens
    .map((item) => {
      const requisito = item.requisito_codigo ? `${item.requisito_nome} (${item.requisito_codigo})` : item.requisito_nome
      const final = colunaFinal === "dias" ? String(item.dias_restantes) : situacaoVencimento(item.dias_restantes)
      return `<tr>
        <td style="${cellStyle}">${escapeHtml(item.pessoa_nome)}</td>
        <td style="${cellStyle}">${escapeHtml(item.matricula || "-")}</td>
        <td style="${cellStyle}">${escapeHtml(requisito)}</td>
        <td style="${cellStyle}">${escapeHtml(item.centro_servico || "-")}</td>
        <td style="${cellStyle}">${escapeHtml(formatDateKey(item.data_vencimento))}</td>
        <td style="${cellStyle}${colunaFinal === "dias" ? "text-align:right;" : ""}">${escapeHtml(final)}</td>
      </tr>`
    })
    .join("")

  return `<div style="margin:16px 0 20px 0;">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(titulo)} (${itens.length})</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escapeHtml(descricao)}</div>
    <div style="overflow:auto;border:1px solid #e2e8f0;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="${cellStyle}">Colaborador</th>
            <th style="${cellStyle}">Matricula</th>
            <th style="${cellStyle}">Requisito</th>
            <th style="${cellStyle}">Centro de servico</th>
            <th style="${cellStyle}">Vencimento</th>
            <th style="${cellStyle}">${colunaFinal === "dias" ? "Dias" : "Situacao"}</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  </div>`
}

// Mais urgente primeiro: janela por dias restantes; vencimento com "vence hoje" antes dos atrasados.
const ordenarEventos = (lista: EventoAlerta[]) =>
  [...lista].sort(
    (a, b) =>
      Math.abs(Number(a.dias_restantes)) - Math.abs(Number(b.dias_restantes)) ||
      a.pessoa_nome.localeCompare(b.pessoa_nome, "pt-BR") ||
      a.requisito_nome.localeCompare(b.requisito_nome, "pt-BR"),
  )

const buildEmail = (eventos: EventoAlerta[], dataReferencia: string, janelaDias: number) => {
  const janela = ordenarEventos(eventos.filter((item) => item.tipo_alerta === "janela_critica"))
  const vencimento = ordenarEventos(eventos.filter((item) => item.tipo_alerta === "vencimento"))
  const dataLabel = formatDateKey(dataReferencia)

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Controle de validades</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:760px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <h1 style="margin:0 0 12px 0;font-size:20px;">Controle de validades</h1>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">
          Alertas de ${escapeHtml(dataLabel)}. Cada item e enviado uma unica vez por marco
          (entrada na janela critica e dia do vencimento).
        </p>
        ${renderTabela(
          "Proximos do vencimento",
          `Entraram na janela critica (1 a ${janelaDias} dias para vencer).`,
          janela,
          "dias",
        )}
        ${renderTabela(
          "Vencimento",
          "Vencem hoje ou venceram recentemente sem alerta enviado no dia.",
          vencimento,
          "situacao",
        )}
        <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;">
          Consulte a tela Controle de Validades para registrar ou renovar. Este e um email automatico. Nao responda.
        </p>
      </div>
    </div>
  </body>
</html>`

  const text = [
    `Controle de validades - ${dataLabel}`,
    `Proximos do vencimento: ${janela.length}`,
    ...janela.map((item) => `- ${item.pessoa_nome} | ${item.requisito_nome} | vence ${formatDateKey(item.data_vencimento)} (${item.dias_restantes} dias)`),
    `Vencimento: ${vencimento.length}`,
    ...vencimento.map((item) => `- ${item.pessoa_nome} | ${item.requisito_nome} | ${situacaoVencimento(item.dias_restantes)}`),
  ].join("\n")

  const subject = `Controle de validades - ${eventos.length} alerta${eventos.length === 1 ? "" : "s"} - ${dataLabel}`
  return { subject, html, text, totalJanela: janela.length, totalVencimento: vencimento.length }
}

// ---------------------------------------------------------------------------
// Banco: reserva/finalizacao de eventos e lote em inventory_report
// ---------------------------------------------------------------------------

const rpc = async (name: string, params: Record<string, unknown> = {}) => {
  const { data, error } = await supabaseAdmin.rpc(name, params)
  if (error) {
    throw new Error(`Falha em ${name}: ${error.message}`)
  }
  return data
}

const finalizarEventos = async (
  ownerId: string,
  eventos: EventoAlerta[],
  sucesso: boolean,
  erro: string | null,
  loteId: string | null,
  destinatarios: number | null,
) => {
  const ids = eventos.map((item) => item.envio_id).filter(Boolean)
  if (!ids.length) return 0
  return await rpc("rpc_validades_alertas_finalizar", {
    p_owner_id: ownerId,
    p_envio_ids: ids,
    p_sucesso: sucesso,
    p_erro: erro,
    p_lote_id: loteId,
    p_destinatarios: destinatarios,
  })
}

const criarLote = async (ownerId: string, dataReferencia: string, email: ReturnType<typeof buildEmail>, total: number) => {
  const { data, error } = await supabaseAdmin
    .from("inventory_report")
    .insert({
      account_owner_id: ownerId,
      periodo_inicio: dataReferencia,
      periodo_fim: dataReferencia,
      termo: "",
      metadados: {
        tipo: REPORT_TYPE,
        origem: "cron",
        data_referencia: dataReferencia,
        total,
        total_janela: email.totalJanela,
        total_vencimento: email.totalVencimento,
      },
      email_status: EMAIL_STATUS_PENDENTE,
      email_tentativas: 0,
    })
    .select("id")
    .single()
  if (error) {
    throw new Error(`Falha ao registrar lote de alertas: ${error.message}`)
  }
  return String(data.id)
}

const atualizarLote = async (ownerId: string, loteId: string, payload: Record<string, unknown>) => {
  const { error } = await supabaseAdmin
    .from("inventory_report")
    .update(payload)
    .eq("account_owner_id", ownerId)
    .eq("id", loteId)
  if (error) {
    throw new Error(`Falha ao atualizar lote de alertas: ${error.message}`)
  }
}

export const assertValidadesAlertasEnv = () => {
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

export const runValidadesAlertas = async ({
  testEmail,
  testOwnerId,
}: {
  testEmail?: string
  testOwnerId?: string
} = {}) => {
  assertValidadesAlertasEnv()
  const normalizedTestEmail = trim(testEmail).toLowerCase()
  const normalizedTestOwnerId = trim(testOwnerId)
  if (normalizedTestEmail && !normalizedTestEmail.includes("@")) {
    throw new Error("test_email invalido.")
  }
  const isTestMode = Boolean(normalizedTestEmail)
  const sender = resolveSenderInfo()
  if (!sender.email) {
    throw new Error("Remetente de email nao configurado.")
  }

  let owners = ((await rpc("rpc_validades_alertas_owners")) ?? []) as string[]
  if (normalizedTestOwnerId) {
    owners = owners.filter((id) => id === normalizedTestOwnerId)
  }

  const credenciais = isTestMode ? [] : await carregarCredenciaisAdmin()
  const resultados: Array<Record<string, unknown>> = []
  let testSent = false

  for (const ownerId of owners) {
    if (isTestMode && testSent) break
    let lista: EventoAlerta[] = []
    let finalizado = false

    try {
      // Modo teste: apenas le os eventos do dia, sem reservar nem gravar status.
      const eventos = (isTestMode
        ? await rpc("_validades_alertas_candidatos", { p_owner_id: ownerId })
        : await rpc("rpc_validades_alertas_reservar", { p_owner_id: ownerId, p_max_tentativas: MAX_TENTATIVAS })) as
        EventoAlerta[] | null

      lista = Array.isArray(eventos) ? eventos : []
      if (!lista.length) {
        resultados.push({ ownerId, skipped: true, reason: "sem_eventos" })
        continue
      }

      const destinatarios = isTestMode
        ? [{ name: normalizedTestEmail, email: normalizedTestEmail }]
        : await listarAdminsOwner(ownerId, credenciais)

      if (!isTestMode && (!destinatarios.length || destinatarios.length > MAX_RECIPIENTS)) {
        const erro = !destinatarios.length
          ? "Sem destinatarios para envio."
          : `Destinatarios excedem limite (${destinatarios.length}/${MAX_RECIPIENTS}).`
        await finalizarEventos(ownerId, lista, false, erro, null, destinatarios.length)
        finalizado = true
        resultados.push({ ownerId, status: EMAIL_STATUS_ERRO, error: erro, eventos: lista.length })
        continue
      }

      const dataReferencia = resolveDataReferencia(lista[0])
      const janelaDias = Number(lista[0].janela) || 7
      const email = buildEmail(lista, dataReferencia, janelaDias)
      const loteId = isTestMode ? null : await criarLote(ownerId, dataReferencia, email, lista.length)

      const envio = await sendBrevoEmail({
        sender: { name: sender.name, email: sender.email },
        replyTo: sender.replyTo ? { name: sender.name, email: sender.replyTo } : undefined,
        to: destinatarios,
        subject: isTestMode ? `[TESTE] ${email.subject}` : email.subject,
        text: email.text,
        html: email.html,
      })

      if (!isTestMode && loteId) {
        await atualizarLote(ownerId, loteId, {
          email_status: envio.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
          email_enviado_em: envio.ok ? new Date().toISOString() : null,
          email_erro: envio.ok ? null : envio.error,
          email_tentativas: 1,
        })
        await finalizarEventos(ownerId, lista, envio.ok, envio.ok ? null : envio.error, loteId, destinatarios.length)
        finalizado = true
      }

      resultados.push({
        ownerId,
        loteId,
        status: envio.ok ? EMAIL_STATUS_ENVIADO : EMAIL_STATUS_ERRO,
        error: envio.ok ? null : envio.error,
        eventos: lista.length,
        janela: email.totalJanela,
        vencimento: email.totalVencimento,
        destinatarios: destinatarios.length,
      })
      if (isTestMode) testSent = true
    } catch (error) {
      const message = String((error as Error)?.message ?? error)
      // Eventos ja reservados voltam como erro para a proxima execucao tentar de novo.
      if (!isTestMode && lista.length && !finalizado) {
        await finalizarEventos(ownerId, lista, false, message, null, null).catch(() => 0)
      }
      resultados.push({ ownerId, status: EMAIL_STATUS_ERRO, error: message })
    }
  }

  const warnings: string[] = []
  if (isTestMode && !normalizedTestOwnerId) {
    warnings.push("test_email usado sem test_owner_id; envio limitado a 1 owner.")
  }

  return {
    ok: true,
    total: resultados.length,
    enviados: resultados.filter((item) => item.status === EMAIL_STATUS_ENVIADO).length,
    erros: resultados.filter((item) => item.status === EMAIL_STATUS_ERRO).length,
    resultados,
    test: isTestMode,
    warnings: warnings.length ? warnings : undefined,
  }
}
