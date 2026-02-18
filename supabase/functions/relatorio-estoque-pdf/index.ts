import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const PDF_FILENAME = "relatorio-estoque.pdf";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const input = await resolveInput(req);
    const pdfBytes = await renderPdf(input);

    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${PDF_FILENAME}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(pdfBytes.byteLength),
    });

    return new Response(pdfBytes, { status: 200, headers });
  } catch (error) {
    console.error("Erro ao gerar PDF na funcao relatorio-estoque-pdf:", error);

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

    const html = rawHtml === undefined ? undefined : normalizeHtmlDocument(rawHtml);
    const url = rawUrl === undefined ? undefined : normalizeUrl(rawUrl);

    if (!html && !url) {
      throw new HttpError(400, "Informe o HTML ou uma URL para gerar o PDF.");
    }

    return { html, url };
  }

  throw new HttpError(405, "Metodo nao suportado.", {
    Allow: "GET, POST, OPTIONS",
  });
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
    <title>Relatorio de Estoque</title>
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
