const DEFAULT_PDF_OPTIONS = {
  margin: [10, 10, 10, 10],
  filename: "termo-epi.pdf",
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
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
  const identificador =
    context?.colaborador?.matricula ||
    context?.colaborador?.nome ||
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

function waitForAnimationFrame(win = window) {
  if (typeof win.requestAnimationFrame === "function") {
    return new Promise((resolve) => win.requestAnimationFrame(() => resolve()));
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
  if (doc.fonts && typeof doc.fonts.ready?.then === "function") {
    try {
      await doc.fonts.ready;
    } catch (error) {
      // ignore font loading failures and continue rendering
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
  const target = frameDocument?.body;

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

    const scrollWidth = Math.max(
      target.scrollWidth,
      frameDocument.documentElement.scrollWidth,
      frameDocument.body?.scrollWidth ?? 0
    );
    const scrollHeight = Math.max(
      target.scrollHeight,
      frameDocument.documentElement.scrollHeight,
      frameDocument.body?.scrollHeight ?? 0
    );

    frame.style.width = `${scrollWidth}px`;
    frame.style.height = `${scrollHeight}px`;

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

    await html2pdf()
      .set(pdfOptions)
      .from(target)
      .save();
  } finally {
    frame.remove();
  }
}
