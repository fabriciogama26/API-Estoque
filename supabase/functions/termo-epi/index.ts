import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import puppeteer from "puppeteer";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const VIEWPORT = { width: 1240, height: 1754, deviceScaleFactor: 2 } as const;
const PDF_TIMEOUT_MS = 15_000;
const PDF_FILENAME = "termo-epi.pdf";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const key = getBrowserlessKey();
    const input = await resolveInput(req);
    const endpoint = buildBrowserlessEndpoint(key);
    const pdfBytes = await renderPdf({ ...input, endpoint });

    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${PDF_FILENAME}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(pdfBytes.byteLength),
    });

    return new Response(pdfBytes, { status: 200, headers });
  } catch (error) {
    console.error("Erro ao gerar PDF na função termo-epi:", error);

    if (error instanceof HttpError) {
      return jsonError(error.message, error.status, error.headers);
    }

    if (isTimeoutError(error)) {
      return jsonError(
        "A geração do PDF excedeu o tempo limite. Tente novamente.",
        504,
      );
    }

    if (isBrowserlessAuthError(error)) {
      return jsonError(
        "Falha na autenticação com o serviço de renderização. Verifique a chave configurada.",
        502,
      );
    }

    if (isBrowserlessConnectionError(error)) {
      return jsonError(
        "Não foi possível conectar ao serviço de renderização de PDF.",
        502,
      );
    }

    return jsonError("Erro inesperado ao gerar o PDF.", 500);
  }
});

type RenderInput = {
  html?: string;
  url?: string;
};

type RenderOptions = RenderInput & { endpoint: string };

async function renderPdf({ html, url, endpoint }: RenderOptions): Promise<Uint8Array> {
  const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });

  try {
    const page = await browser.newPage();
    try {
      await page.setViewport(VIEWPORT);
      page.setDefaultNavigationTimeout(PDF_TIMEOUT_MS);
      page.setDefaultTimeout(PDF_TIMEOUT_MS);

      if (html) {
        await page.setContent(html, {
          waitUntil: "networkidle0",
          timeout: PDF_TIMEOUT_MS,
        });
      } else if (url) {
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: PDF_TIMEOUT_MS,
        });
      } else {
        throw new HttpError(400, "Nenhum conteúdo recebido para gerar o PDF.");
      }

      await page.emulateMediaType("screen");

      return await page.pdf({
        format: "A4",
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        printBackground: true,
      });
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function resolveInput(req: Request): Promise<RenderInput> {
  const method = req.method.toUpperCase();
  const requestUrl = new URL(req.url);

  if (method === "GET") {
    const targetUrl = requestUrl.searchParams.get("url");
    if (!targetUrl) {
      throw new HttpError(
        400,
        "Informe a URL pública pelo parâmetro `url` para gerar o PDF.",
      );
    }
    return { url: normalizeUrl(targetUrl) };
  }

  if (method === "POST") {
    const body = await readJsonBody(req);
    const rawHtml = body.html;
    const rawUrl = body.url ?? body.link;

    const html = rawHtml === undefined ? undefined : normalizeHtml(rawHtml);
    const url = rawUrl === undefined ? undefined : normalizeUrl(rawUrl);

    if (!html && !url) {
      throw new HttpError(
        400,
        "Informe o HTML ou uma URL para gerar o PDF.",
      );
    }

    return { html, url };
  }

  throw new HttpError(405, "Método não suportado.", {
    Allow: "GET, POST, OPTIONS",
  });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object") {
      throw new HttpError(
        400,
        "Envie um JSON válido com os campos `html` ou `url`.",
      );
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Não foi possível interpretar o corpo da requisição como JSON.");
  }
}

function normalizeHtml(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(400, "O campo `html` deve ser uma string.");
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new HttpError(400, "O HTML fornecido está vazio.");
  }

  if (!/<html[\s>]/i.test(trimmed)) {
    return wrapHtml(trimmed);
  }

  let html = trimmed;

  if (!/<!doctype/i.test(html)) {
    html = `<!DOCTYPE html>\n${html}`;
  }

  if (!/<meta[^>]+charset=/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head([^>]*)>/i,
        (match, attrs) => `<head${attrs}>\n    <meta charset="utf-8" />`,
      );
    } else {
      html = html.replace(
        /<html([^>]*)>/i,
        (match, attrs) => `<html${attrs}>\n<head>\n    <meta charset="utf-8" />\n</head>`,
      );
    }
  }

  return html;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="utf-8" />\n    <meta http-equiv="X-UA-Compatible" content="IE=edge" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Termo de EPI</title>\n  </head>\n  <body>\n${content}\n  </body>\n</html>`;
}

function normalizeUrl(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(400, "O campo `url` deve ser uma string.");
  }

  let value = raw.trim();
  if (!value) {
    throw new HttpError(400, "Informe uma URL válida para gerar o PDF.");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, "Informe uma URL válida para gerar o PDF.");
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new HttpError(400, "Apenas URLs HTTP(s) são suportadas.");
  }

  return parsed.toString();
}

function getBrowserlessKey(): string {
  const key = (Deno.env.get("PUPPETEER_BROWSERLESS_IO_KEY") ?? "").trim();
  if (!key) {
    throw new HttpError(
      500,
      "Variável de ambiente PUPPETEER_BROWSERLESS_IO_KEY não configurada.",
    );
  }
  return key;
}

function buildBrowserlessEndpoint(key: string): string {
  return `wss://chrome.browserless.io?token=${encodeURIComponent(key)}`;
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
  if (error instanceof Deno.errors.ConnectionRefused || error instanceof Deno.errors.NotConnected) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("socket") ||
    message.includes("websocket") ||
    message.includes("connection") ||
    message.includes("closed before")
  );
}
