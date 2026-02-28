import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createUserClient, requireAuthUser } from "./_shared/auth.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const PDF_FILENAME = "termo-epi.pdf";
const FUNCTION_NAME = "termo-epi";
const RATE_LIMIT_WINDOW_SECONDS = 60;
const DAILY_LIMIT_CATEGORY = "pdf";
const SECURITY_EVENT_CODE = "SANITIZE_HTML";
const SECURITY_EVENT_MESSAGE = "HTML sanitize: conteudo suspeito detectado";
const SECURITY_SERVICE = "edge-security";
const DAILY_LOCK_CODE = "DAILY_LIMIT_LOCK";
const DAILY_LOCK_MESSAGE = "Limite diario bloqueado por erros repetidos.";
const RATE_LIMIT_WINDOW_CODE = "RATE_LIMIT_WINDOW";
const RATE_LIMIT_WINDOW_MESSAGE = "Limite de 1 requisicao a cada 60 segundos.";
const DAILY_LIMIT_CODE = "DAILY_LIMIT_BLOCK";
const DAILY_LIMIT_MESSAGE = "Limite diario do plano bloqueado.";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const auth = await requireAuthUser(req, corsHeaders);
  if ("response" in auth) {
    return auth.response;
  }

  let ownerId: string | null = null;
  let dailyLimitChecked = false;
  try {
    ownerId = await resolveOwnerId(auth.token);
    if (!ownerId) {
      return jsonError("Owner nao encontrado.", 403);
    }

    const rateLimitResponse = await enforceRateLimit({
      ownerId,
      functionName: FUNCTION_NAME,
      method: req.method.toUpperCase(),
      path: new URL(req.url).pathname,
      userId: auth.user?.id || null,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const dailyLimitResponse = await enforceDailyLimit({
      ownerId,
      category: DAILY_LIMIT_CATEGORY,
      method: req.method.toUpperCase(),
      path: new URL(req.url).pathname,
      userId: auth.user?.id || null,
    });
    if (dailyLimitResponse) {
      return dailyLimitResponse;
    }
    dailyLimitChecked = true;

    const input = await resolveInput(req);
    if (input.securityTypes?.length) {
      await logSecurityEvent({
        types: input.securityTypes,
        userId: auth.user?.id || null,
        tenantHint: ownerId.slice(0, 8),
        method: req.method.toUpperCase(),
        path: new URL(req.url).pathname,
      });
    }
    const pdfBytes = await renderPdf(input);
    await registerDailyResult({
      ownerId,
      category: DAILY_LIMIT_CATEGORY,
      success: true,
      userId: auth.user?.id || null,
      method: req.method.toUpperCase(),
      path: new URL(req.url).pathname,
    });

    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${PDF_FILENAME}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(pdfBytes.byteLength),
    });

    return new Response(pdfBytes, { status: 200, headers });
  } catch (error) {
    if (ownerId && dailyLimitChecked) {
      await registerDailyResult({
        ownerId,
        category: DAILY_LIMIT_CATEGORY,
        success: false,
        userId: auth.user?.id || null,
        method: req.method.toUpperCase(),
        path: new URL(req.url).pathname,
      });
    }
    console.error("Erro ao gerar PDF na funcao termo-epi:", error);

    if (error instanceof HttpError) {
      return jsonError(error.message, error.status, error.headers);
    }

    if (isTimeoutError(error)) {
      return jsonError("A geracao do PDF excedeu o tempo limite. Tente novamente.", 504);
    }

    if (isBrowserlessAuthError(error)) {
      return jsonError(
        "Falha na autenticacao com o servico de renderizacao. Verifique a chave configurada.",
        502,
      );
    }

    if (isBrowserlessConnectionError(error)) {
      return jsonError("Nao foi possivel conectar ao servico de renderizacao de PDF.", 502);
    }

    let message: string;
    if (typeof ErrorEvent !== "undefined" && error instanceof ErrorEvent) {
      message = `${error.type || "ErrorEvent"}: ${
        error.message ?? "Falha de comunicacao com o servico de PDF."
      }`;
    } else if (error instanceof Error) {
      message = `${error.name}: ${error.message}`;
    } else {
      message = `Erro inesperado: ${String(error)}`;
    }

    return jsonError(message, 500);
  }
});

type RenderInput = {
  html?: string;
  url?: string;
  securityTypes?: string[];
};

async function renderPdf({ html, url }: RenderInput): Promise<Uint8Array> {
  const key = getBrowserlessKey();
  const endpoint = buildBrowserlessPdfEndpoint(key);

  const payload: Record<string, unknown> = {
    options: {
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    },
  };

  if (html) {
    payload.html = html;
  } else if (url) {
    payload.url = url;
  } else {
    throw new HttpError(400, "Nenhum conteudo recebido para gerar o PDF.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 402 || /free accounts come with 1,000 units\/?month/i.test(text)) {
      throw new HttpError(
        402,
        "O limite mensal do servico de PDF foi atingido (planos gratuitos incluem 1.000 unidades/mes). Configure uma chave valida ou aguarde a renovacao do limite.",
      );
    }

    throw new HttpError(
      response.status,
      `Falha ao gerar PDF no Browserless (status ${response.status}). Detalhes: ${text}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function resolveInput(req: Request): Promise<RenderInput> {
  const method = req.method.toUpperCase();
  const requestUrl = new URL(req.url);

  if (method === "GET") {
    const targetUrl = requestUrl.searchParams.get("url");
    if (!targetUrl) {
      throw new HttpError(400, "Informe a URL publica pelo parametro `url` para gerar o PDF.");
    }
    return { url: normalizeUrl(targetUrl) };
  }

  if (method === "POST") {
    const data = await readJsonBody(req);
    const rawHtml = data.html ?? data.content ?? data.body ?? data.markup;
    const rawUrl = data.url ?? data.href ?? data.link;

    const securityTypes =
      typeof rawHtml === "string" ? detectSuspiciousHtml(rawHtml) : [];
    const html = rawHtml === undefined ? undefined : normalizeHtmlDocument(rawHtml);
    const url = rawUrl === undefined ? undefined : normalizeUrl(rawUrl);

    if (!html && !url) {
      throw new HttpError(400, "Informe o HTML ou uma URL para gerar o PDF.");
    }

    return { html, url, securityTypes };
  }

  throw new HttpError(405, "Metodo nao suportado.", {
    Allow: "GET, POST, OPTIONS",
  });
}

async function resolveOwnerId(token: string): Promise<string | null> {
  try {
    const supabaseUser = createUserClient(token);
    const { data, error } = await supabaseUser.rpc("current_account_owner_id");
    if (error) {
      return null;
    }
    const ownerId =
      typeof data === "string"
        ? data
        : (data as { account_owner_id?: string } | null)?.account_owner_id;
    return typeof ownerId === "string" ? ownerId : null;
  } catch {
    return null;
  }
}

async function enforceRateLimit({
  ownerId,
  functionName,
  method,
  path,
  userId,
}: {
  ownerId: string;
  functionName: string;
  method: string;
  path: string;
  userId: string | null;
}): Promise<Response | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY nao configurada.", 500);
  }

  const now = new Date();
  const windowStartSeconds =
    Math.floor(now.getTime() / 1000 / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const windowStart = new Date(windowStartSeconds * 1000).toISOString();

  const payload = {
    account_owner_id: ownerId,
    function_name: functionName,
    window_start: windowStart,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/edge_rate_limits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return null;
  }

  const text = await response.text();
  if (response.status === 409 || text.includes("23505")) {
    await logLimitBlock({
      code: RATE_LIMIT_WINDOW_CODE,
      message: RATE_LIMIT_WINDOW_MESSAGE,
      ownerId,
      userId,
      method,
      path,
      context: {
        functionName,
        windowStart,
        type: "window",
      },
      fingerprint: `rate_limit_window|${functionName}|${ownerId}|${windowStart}`,
    });
    return jsonError("Limite de 1 requisicao a cada 60 segundos.", 429, {
      "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS),
    });
  }

  return jsonError("Falha ao validar limite de requisicoes.", 500);
}

async function enforceDailyLimit({
  ownerId,
  category,
  method,
  path,
  userId,
}: {
  ownerId: string;
  category: string;
  method: string;
  path: string;
  userId: string | null;
}): Promise<Response | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY nao configurada.", 500);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/edge_rate_limit_daily_check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ p_owner_id: ownerId, p_category: category }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logLimitBlock({
      code: DAILY_LIMIT_CODE,
      message: "Falha ao validar limite diario do plano.",
      ownerId,
      userId,
      method,
      path,
      context: {
        category,
        status: response.status,
        body: errorText,
      },
      fingerprint: `daily_limit_check_error|${category}|${ownerId}|${response.status}`,
    });
    return jsonError("Falha ao validar limite diario do plano.", 500);
  }

  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return jsonError("Falha ao validar limite diario do plano.", 500);
  }

  if (result.allowed === true) {
    return null;
  }

  const reason = String(result.reason || "");
  if (reason === "limit_not_configured") {
    await logLimitBlock({
      code: DAILY_LIMIT_CODE,
      message: DAILY_LIMIT_MESSAGE,
      ownerId,
      userId,
      method,
      path,
      context: {
        category,
        reason,
        dayDate: result.day_date,
        limitValue: result.limit_value,
        successCount: result.success_count,
        errorCount: result.error_count,
        lockedUntil: result.locked_until,
      },
      fingerprint: `daily_limit|${category}|${ownerId}|${result.day_date}|${reason}`,
    });
    return jsonError("Limite diario do plano nao configurado.", 403);
  }
  if (reason === "plan_not_found") {
    await logLimitBlock({
      code: DAILY_LIMIT_CODE,
      message: DAILY_LIMIT_MESSAGE,
      ownerId,
      userId,
      method,
      path,
      context: {
        category,
        reason,
        dayDate: result.day_date,
      },
      fingerprint: `daily_limit|${category}|${ownerId}|${result.day_date}|${reason}`,
    });
    return jsonError("Plano nao encontrado.", 403);
  }
  if (reason === "locked") {
    await logLimitBlock({
      code: DAILY_LIMIT_CODE,
      message: DAILY_LIMIT_MESSAGE,
      ownerId,
      userId,
      method,
      path,
      context: {
        category,
        reason,
        dayDate: result.day_date,
        limitValue: result.limit_value,
        successCount: result.success_count,
        errorCount: result.error_count,
        lockedUntil: result.locked_until,
      },
      fingerprint: `daily_limit|${category}|${ownerId}|${result.day_date}|${reason}`,
    });
    return jsonError("Limite diario bloqueado ate meia-noite (America/Sao_Paulo).", 429, {
      "Retry-After": "3600",
    });
  }
  if (reason === "limit_reached") {
    await logLimitBlock({
      code: DAILY_LIMIT_CODE,
      message: DAILY_LIMIT_MESSAGE,
      ownerId,
      userId,
      method,
      path,
      context: {
        category,
        reason,
        dayDate: result.day_date,
        limitValue: result.limit_value,
        successCount: result.success_count,
        errorCount: result.error_count,
        lockedUntil: result.locked_until,
      },
      fingerprint: `daily_limit|${category}|${ownerId}|${result.day_date}|${reason}`,
    });
    return jsonError("Limite diario do plano atingido.", 429, {
      "Retry-After": "3600",
    });
  }

  return jsonError("Limite diario do plano nao permitido.", 429);
}

async function registerDailyResult({
  ownerId,
  category,
  success,
  userId,
  method,
  path,
}: {
  ownerId: string;
  category: string;
  success: boolean;
  userId: string | null;
  method: string;
  path: string;
}): Promise<void> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/edge_rate_limit_daily_register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ p_owner_id: ownerId, p_category: category, p_success: success }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      await logLimitBlock({
        code: "DAILY_LIMIT_REGISTER_ERROR",
        message: "Falha ao registrar consumo diario.",
        ownerId,
        userId,
        method,
        path,
        context: {
          category,
          success,
          status: response.status,
          body: errorText,
        },
        fingerprint: `daily_limit_register_error|${category}|${ownerId}|${response.status}`,
      });
      return;
    }
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!success && result?.error_count === 3 && result?.locked_until) {
      await logDailyLock({
        ownerId,
        userId,
        category,
        method,
        path,
      });
    }
  } catch (error) {
    console.warn("Falha ao registrar consumo diario", error);
  }
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object") {
      throw new HttpError(400, "Envie um JSON valido com os campos `html` ou `url`.");
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Nao foi possivel interpretar o corpo da requisicao como JSON.");
  }
}

function normalizeHtmlDocument(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(400, "O campo `html` deve ser uma string.");
  }

  let html = raw.trim();
  if (!html) {
    throw new HttpError(400, "O HTML enviado esta vazio.");
  }

  if (!/^<!DOCTYPE/i.test(html)) {
    html = "<!DOCTYPE html>\n" + html;
  }

  if (!/<html[\s>]/i.test(html)) {
    html = wrapHtml(html);
  } else {
    html = ensureMetaCharset(html);
  }

  return html;
}

function detectSuspiciousHtml(html: string): string[] {
  const types = new Set<string>();
  if (/<\s*script\b/i.test(html)) {
    types.add("script");
  }
  if (/<\s*iframe\b/i.test(html)) {
    types.add("iframe");
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    types.add("event_handler");
  }
  if (/(href|src)\s*=\s*['"]?\s*javascript:/i.test(html)) {
    types.add("javascript_url");
  }
  return Array.from(types);
}

async function logSecurityEvent({
  types,
  userId,
  tenantHint,
  method,
  path,
}: {
  types: string[];
  userId: string | null;
  tenantHint: string | null;
  method: string;
  path: string;
}): Promise<void> {
  if (!types.length) {
    return;
  }
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  const fingerprint = `sanitize_html|${path}|${types.sort().join(",")}`;
  const payload = {
    environment: "api",
    service: SECURITY_SERVICE,
    method,
    path,
    status: 200,
    code: SECURITY_EVENT_CODE,
    user_id: userId,
    message: SECURITY_EVENT_MESSAGE,
    context: {
      source: "edge",
      eventTypes: types,
      tenantHint,
    },
    severity: "warn",
    fingerprint,
  };

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Falha ao registrar evento de seguranca", error);
  }
}

async function logDailyLock({
  ownerId,
  userId,
  category,
  method,
  path,
}: {
  ownerId: string;
  userId: string | null;
  category: string;
  method: string;
  path: string;
}): Promise<void> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  const payload = {
    environment: "api",
    service: SECURITY_SERVICE,
    method,
    path,
    status: 429,
    code: DAILY_LOCK_CODE,
    user_id: userId,
    message: DAILY_LOCK_MESSAGE,
    context: {
      source: "edge",
      category,
      tenantHint: ownerId.slice(0, 8),
    },
    severity: "warn",
    fingerprint: `daily_lock|${path}|${category}`,
  };

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Falha ao registrar bloqueio diario", error);
  }
}

async function logLimitBlock({
  code,
  message,
  ownerId,
  userId,
  method,
  path,
  context,
  fingerprint,
}: {
  code: string;
  message: string;
  ownerId: string;
  userId: string | null;
  method: string;
  path: string;
  context: Record<string, unknown>;
  fingerprint: string;
}): Promise<void> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  const payload = {
    environment: "api",
    service: SECURITY_SERVICE,
    method,
    path,
    status: 429,
    code,
    user_id: userId,
    message,
    context: {
      source: "edge",
      tenantHint: ownerId.slice(0, 8),
      ...context,
    },
    severity: "warn",
    fingerprint,
  };

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Falha ao registrar bloqueio de limite", error);
  }
}

function ensureMetaCharset(html: string): string {
  if (/<head[\s\S]*?<\/head>/i.test(html)) {
    if (!/<meta[^>]+charset=/i.test(html)) {
      return html.replace(
        /<head([^>]*)>/i,
        (match, attrs) => `<head${attrs}>\n    <meta charset="utf-8" />`,
      );
    }
    return html;
  }

  return html.replace(
    /<html([^>]*)>/i,
    (match, attrs) =>
      `<html${attrs}>\n<head>\n    <meta charset="utf-8" />\n</head>`,
  );
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Termo de EPI</title>
  </head>
  <body>
${content}
  </body>
</html>`;
}

function normalizeUrl(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(400, "O campo `url` deve ser uma string.");
  }

  let value = raw.trim();
  if (!value) {
    throw new HttpError(400, "Informe uma URL valida para gerar o PDF.");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, "Informe uma URL valida para gerar o PDF.");
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new HttpError(400, "Apenas URLs HTTP(s) sao suportadas.");
  }

  return parsed.toString();
}

function getBrowserlessKey(): string {
  const key = (Deno.env.get("PUPPETEER_BROWSERLESS_IO_KEY") ?? "").trim();
  if (!key) {
    throw new HttpError(
      500,
      "Variavel de ambiente PUPPETEER_BROWSERLESS_IO_KEY nao configurada.",
    );
  }
  return key;
}

function buildBrowserlessPdfEndpoint(key: string): string {
  return `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(key)}`;
}

class HttpError extends Error {
  status: number;
  headers?: Record<string, string>;

  constructor(status: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function jsonError(
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("timeout") || message.includes("timed out");
}

function isBrowserlessAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("403") ||
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("authentication") ||
    message.includes("invalid token")
  );
}

function isBrowserlessConnectionError(error: unknown): boolean {
  if (
    error instanceof Deno.errors.ConnectionRefused ||
    error instanceof Deno.errors.NotConnected ||
    error instanceof Deno.errors.BrokenPipe
  ) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("socket") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("closed before")
  );
}



