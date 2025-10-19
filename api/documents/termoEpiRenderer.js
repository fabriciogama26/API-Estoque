import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildEpiTermHtml } from '../../shared/documents/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OUTPUT_CACHE_DIR = path.join(os.tmpdir(), 'termo-epi-cache')
const DEFAULT_PUPPETEER_TIMEOUT = 30_000

async function ensureCacheDir() {
  try {
    await fs.mkdir(OUTPUT_CACHE_DIR, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

async function launchBrowser() {
  const isServerless = Boolean(
    process.env.AWS_REGION ||
      process.env.AWS_LAMBDA_FUNCTION_VERSION ||
      process.env.VERCEL,
  )

  if (isServerless) {
    const { default: chromium } = await import('@sparticuz/chromium')
    const { default: puppeteer } = await import('puppeteer-core')

    const executablePath = await chromium.executablePath()

    return puppeteer.launch({
      headless: chromium.headless ?? true,
      args: chromium.args,
      executablePath,
      defaultViewport: chromium.defaultViewport ?? {
        width: 1240,
        height: 1754,
        deviceScaleFactor: 2,
      },
    })
  }

  const { default: puppeteer } = await import('puppeteer')

  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1240,
      height: 1754,
      deviceScaleFactor: 2,
    },
  })
}

function resolveEmpresaInfo(context) {
  const fallback = context?.empresa || {}
  return {
    nome: fallback.nome || process.env.TERMO_EPI_EMPRESA_NOME || '',
    documento: fallback.documento || process.env.TERMO_EPI_EMPRESA_DOCUMENTO || '',
    endereco: fallback.endereco || process.env.TERMO_EPI_EMPRESA_ENDERECO || '',
    contato: fallback.contato || process.env.TERMO_EPI_EMPRESA_CONTATO || '',
  }
}

export async function gerarTermoEpiPdf(contexto) {
  await ensureCacheDir()

  const empresa = resolveEmpresaInfo(contexto)
  const html = buildEpiTermHtml({ ...contexto, empresa })

  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.setDefaultTimeout(DEFAULT_PUPPETEER_TIMEOUT)

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
    })

    return buffer
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}
