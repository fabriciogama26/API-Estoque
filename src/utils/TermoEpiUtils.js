const DEFAULT_FILENAME = "termo-epi.pdf";

function buildFunctionsUrl() {
  const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!base) {
    throw new Error("VITE_SUPABASE_FUNCTIONS_URL nao configurada.");
  }
  return base.replace(/\/+$/, "");
}

function resolveAnonKey() {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("VITE_SUPABASE_ANON_KEY nao configurada.");
  }
  return key;
}

function buildFileName(context = {}) {
  const colaborador = context?.colaborador ?? {};
  const nome = (colaborador.nome || "").trim();
  const matricula = (colaborador.matricula || "").trim();
  const now = new Date();
  const data =
    now.getFullYear().toString().padStart(4, "0") +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  const slugParts = [nome, matricula, data]
    .filter(Boolean)
    .map((part) =>
      String(part)
        .normalize("NFD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase()
    )
    .filter(Boolean);

  return slugParts.length ? `${slugParts.join("_")}.pdf` : DEFAULT_FILENAME;
}

export async function downloadTermoEpiPdf({ html, context } = {}) {
  if (!html) {
    throw new Error("Nao ha conteudo HTML para gerar o PDF.");
  }

  const normalizedHtml = normalizeHtmlForRemote(html);
  const endpoint = `${buildFunctionsUrl()}/termo-epi`;
  const anonKey = resolveAnonKey();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ html: normalizedHtml }),
  });

  if (!response.ok) {
    let message = `Falha ao gerar o PDF (status ${response.status}).`;
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // ignore parse error and keep generic message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName = buildFileName(context) || DEFAULT_FILENAME;
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeHtmlForRemote(originalHtml) {
  const assetOrigin =
    import.meta.env.VITE_PUBLIC_ASSETS_ORIGIN?.replace(/\/+$/, "") ||
    import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
    window.location.origin;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, "text/html");

    doc.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
        return;
      }
      try {
        const absolute = new URL(src, assetOrigin + "/").toString();
        img.setAttribute("src", absolute);
      } catch {
        // ignore invalid URLs
      }
    });

    if (!doc.querySelector("base")) {
      const base = doc.createElement("base");
      base.setAttribute("href", assetOrigin + "/");
      doc.head?.prepend(base);
    }

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  } catch {
    if (typeof originalHtml === "string") {
      let result = originalHtml;
      if (!originalHtml.includes("<base")) {
        result = result.replace(/<head([^>]*)>/i, (_match, attrs) => {
          return `<head${attrs}>\n<base href="${assetOrigin}/">`;
        });
      }
      return result.replace(/src="\/(?!\/)/g, `src="${assetOrigin}/`);
    }
    return originalHtml;
  }
}
