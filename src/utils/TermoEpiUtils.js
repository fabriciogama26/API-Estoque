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

function createRenderContainer(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "794px";
  container.style.minHeight = "1122px";
  container.style.backgroundColor = "#ffffff";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1";
  container.style.overflow = "visible";

  const bodyClass = parsed.body?.getAttribute("class");
  if (bodyClass) {
    container.className = bodyClass;
  }

  const styles = parsed.head?.querySelectorAll("style, link[rel='stylesheet']") || [];
  styles.forEach((styleNode) => {
    container.appendChild(styleNode.cloneNode(true));
  });

  container.insertAdjacentHTML("beforeend", parsed.body?.innerHTML || html);

  container.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("crossorigin")) {
      img.setAttribute("crossorigin", "anonymous");
    }
  });

  return container;
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

async function waitForFonts() {
  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    try {
      await document.fonts.ready;
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

  const container = createRenderContainer(html);

  document.body.appendChild(container);

  try {
    await waitForAnimationFrame();
    await waitForImages(container);
    await waitForFonts();
    await waitForAnimationFrame();

    const filename = options.filename || buildFileName(context);
    const pdfOptions = {
      ...DEFAULT_PDF_OPTIONS,
      ...options,
      filename,
    };

    await html2pdf().set(pdfOptions).from(container).save();
  } finally {
    container.remove();
  }
}
