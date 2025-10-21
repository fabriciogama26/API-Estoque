import { isSupabaseConfigured, supabase } from '../services/supabaseClient.js'

const DEFAULT_PDF_OPTIONS = {
  margin: [10, 10, 10, 10],
  filename: "termo-epi.pdf",
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: "#ffffff",
  },
  jsPDF: {
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  },
};

const HTML2PDF_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

let html2pdfPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Falha ao carregar ${src}`));
    };

    document.body.appendChild(script);
  });
}

async function ensureHtml2Pdf() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("html2pdf so pode ser carregado no navegador.");
  }

  if (!html2pdfPromise) {
    html2pdfPromise = (async () => {
      if (window.html2pdf) {
        return window.html2pdf;
      }

      await loadScript(HTML2PDF_CDN);

      if (!window.html2pdf) {
        throw new Error("Nao foi possivel inicializar o html2pdf.");
      }

      return window.html2pdf;
    })();
  }

  return html2pdfPromise;
}

function buildFileName(context) {
  const colaborador = context && context.colaborador ? context.colaborador : null;
  const identificador =
    (colaborador && colaborador.matricula) ||
    (colaborador && colaborador.nome) ||
    "colaborador";

  return `termo-epi-${String(identificador)
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "colaborador"}.pdf`;
}

function createRenderFrame(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "-10000px";
    iframe.style.width = "794px";
    iframe.style.height = "1123px";
    iframe.style.border = "0";
    iframe.style.opacity = "0.01";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");

    const cleanup = () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      cleanup();
      resolve(iframe);
    };

    const handleError = () => {
      cleanup();
      iframe.remove();
      reject(new Error("Falha ao preparar o documento para PDF."));
    };

    iframe.addEventListener("load", handleLoad, { once: true });
    iframe.addEventListener("error", handleError, { once: true });

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

function isSupabaseStorageUrl(src) {
  if (!src) {
    return false;
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      const base = new URL(supabaseUrl);
      const target = new URL(src, window.location?.origin || base.origin);
      return target.origin === base.origin && target.pathname.startsWith("/storage/");
    }
    return src.includes(".supabase.co/storage/");
  } catch (_error) {
    
    console.warn("Erro ao verificar URL do Supabase Storage", _error);
    return false;
  }
}

async function getSupabaseAccessToken() {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (error.name !== "AuthSessionMissingError") {
        console.warn("Falha ao obter sessao do Supabase", error);
      }
      return null;
    }
    return data?.session?.access_token ?? null;
  } catch (error) {
    console.warn("Erro inesperado ao obter sessao do Supabase", error);
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (event) => reject(event?.target?.error || new Error("Falha ao ler blob"));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(src) {
  const headers = new Headers();
  headers.set("Accept", "image/*");

  const request = { mode: "cors", headers };

  if (isSupabaseStorageUrl(src)) {
    const token = await getSupabaseAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(src, request);
  if (!response.ok) {
    throw new Error(`Falha ao carregar imagem: ${response.status}`);
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

async function inlineImages(container) {
  await waitForAnimationFrame();
  const images = Array.from(container.querySelectorAll("img[src]"));
  if (!images.length) {
    return;
  }

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) {
        return;
      }

      try {
        const dataUrl = await fetchImageAsDataUrl(src);
        if (dataUrl) {
          img.setAttribute("src", dataUrl);
          img.removeAttribute("crossorigin");
        }
      } catch (error) {
        console.warn(`Falha ao embutir imagem no PDF (${src})`, error);
        img.removeAttribute("src");
        if (img.alt) {
          const placeholder = document.createElement("div");
          placeholder.textContent = img.alt;
          img.replaceWith(placeholder);
        } else {
          img.remove();
        }
      }
    })
  );
}

function waitForAnimationFrame() {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForImages(scope) {
  const images = Array.from(scope.querySelectorAll("img"));
  if (!images.length) {
    return;
  }

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const clear = () => {
          img.removeEventListener("load", clear);
          img.removeEventListener("error", clear);
          resolve();
        };

        img.addEventListener("load", clear, { once: true });
        img.addEventListener("error", clear, { once: true });
      });
    })
  );
}

async function waitForFonts(doc = document) {
  const fonts = doc && doc.fonts ? doc.fonts : null;
  const fontsReady = fonts && fonts.ready ? fonts.ready : null;
  if (fontsReady && typeof fontsReady.then === "function") {
    try {
      await fontsReady;
    } catch (error) {
      // ignore font loading failures and continue rendering
      console.warn("Erro ao carregar fontes", error);
    }
  }
}

export async function downloadTermoEpiPdf({ html, context, options = {} } = {}) {
  if (!html) {
    throw new Error("Nao ha conteudo para gerar o PDF.");
  }

  const html2pdf = await ensureHtml2Pdf();

  const frame = await createRenderFrame(html);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  const target = frameDocument && frameDocument.body ? frameDocument.body : null;

  if (!frameWindow || !frameDocument || !target) {
    frame.remove();
    throw new Error("Nao foi possivel montar o documento para PDF.");
  }

  try {
    target.querySelectorAll("img[src]").forEach((img) => {
      if (!img.getAttribute("crossorigin")) {
        img.setAttribute("crossorigin", "anonymous");
      }
    });

    await waitForAnimationFrame(frameWindow);
    await waitForImages(target);
    await waitForFonts(frameDocument);
    await waitForAnimationFrame(frameWindow);

    const fallbackWidth = 794;
    const fallbackHeight = 1123;
    const bodyScrollWidth =
      frameDocument.body && typeof frameDocument.body.scrollWidth === "number"
        ? frameDocument.body.scrollWidth
        : 0;
    const bodyScrollHeight =
      frameDocument.body && typeof frameDocument.body.scrollHeight === "number"
        ? frameDocument.body.scrollHeight
        : 0;
    const scrollWidth = Math.max(
      target.scrollWidth || 0,
      frameDocument.documentElement ? frameDocument.documentElement.scrollWidth || 0 : 0,
      bodyScrollWidth,
      fallbackWidth
    );
    const scrollHeight = Math.max(
      target.scrollHeight || 0,
      frameDocument.documentElement ? frameDocument.documentElement.scrollHeight || 0 : 0,
      bodyScrollHeight,
      fallbackHeight
    );

    frame.style.width = `${scrollWidth}px`;
    frame.style.height = `${scrollHeight}px`;
    if (frameDocument.documentElement) {
      frameDocument.documentElement.style.width = `${scrollWidth}px`;
      frameDocument.documentElement.style.height = `${scrollHeight}px`;
      frameDocument.documentElement.style.backgroundColor =
        frameDocument.documentElement.style.backgroundColor || "#ffffff";
    }
    target.style.width = `${scrollWidth}px`;
    target.style.minWidth = `${scrollWidth}px`;
    target.style.height = `${scrollHeight}px`;
    target.style.minHeight = `${scrollHeight}px`;
    target.style.backgroundColor = target.style.backgroundColor || "#ffffff";

    const filename = options.filename || buildFileName(context);
    const pdfOptions = {
      ...DEFAULT_PDF_OPTIONS,
      ...options,
      html2canvas: {
        ...DEFAULT_PDF_OPTIONS.html2canvas,
        ...(options.html2canvas || {}),
        windowWidth: scrollWidth,
        windowHeight: scrollHeight,
      },
      filename,
    };

    const pdfBuilder = html2pdf();
    await pdfBuilder.set(pdfOptions).from(target).save();
  } finally {
    frame.remove();
  }
}
