import { request as httpRequest } from '../services/httpClient.js'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'

const DEFAULT_FILENAME = 'relatorio-estoque.pdf'

function buildFunctionsUrl() {
  const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  if (!base) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
  }
  return base.replace(/\/+$/, '')
}

function resolveAnonKey() {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('VITE_SUPABASE_ANON_KEY nao configurada.')
  }
  return key
}

async function resolveAccessToken() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase nao configurado.')
  }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) {
    throw new Error('Sessao expirada. Faca login novamente.')
  }
  return token
}

function formatMonthLabel(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
}

function buildFileName(report = {}) {
  const periodo = report.periodo_inicio || report.periodoInicio
  const label = formatMonthLabel(periodo)
  const slug = ['mensal', label].filter(Boolean).join('_').toLowerCase()
  return slug ? `${slug}.pdf` : DEFAULT_FILENAME
}

export async function downloadRelatorioEstoquePdf({ html, report } = {}) {
  if (!html) {
    throw new Error('Nao ha conteudo HTML para gerar o PDF.')
  }

  const normalizedHtml = normalizeHtmlForRemote(html)
  const endpoint = `${buildFunctionsUrl()}/relatorio-estoque-pdf`
  const anonKey = resolveAnonKey()
  const token = await resolveAccessToken()

  const blob = await httpRequest('POST', endpoint, {
    body: { html: normalizedHtml },
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob',
    skipSessionGuard: true,
  })
  const fileName = buildFileName(report) || DEFAULT_FILENAME
  const url = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function normalizeHtmlForRemote(originalHtml) {
  const assetsBase = import.meta.env.VITE_PUBLIC_ASSETS_ORIGIN
  const apiBase = import.meta.env.VITE_API_URL
  const assetOrigin =
    (assetsBase ? assetsBase.replace(/\/+$/, '') : '') ||
    (apiBase ? apiBase.replace(/\/+$/, '') : '') ||
    window.location.origin

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(originalHtml, 'text/html')

    doc.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return
      }
      try {
        const absolute = new URL(src, assetOrigin + '/').toString()
        img.setAttribute('src', absolute)
      } catch (err) {
        // ignore invalid URLs
      }
    })

    if (!doc.querySelector('base')) {
      const base = doc.createElement('base')
      base.setAttribute('href', assetOrigin + '/')
      if (doc.head) {
        doc.head.prepend(base)
      }
    }

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  } catch (err) {
    if (typeof originalHtml === 'string') {
      let result = originalHtml
      if (!originalHtml.includes('<base')) {
        result = result.replace(/<head([^>]*)>/i, (_match, attrs) => {
          return `<head${attrs}>\n<base href="${assetOrigin}/">`
        })
      }
      const placeholder = '__ASSET_ORIGIN__DOUBLE__SLASH__'
      let normalized = result.replace(/src="\/\//g, `src="${placeholder}`)
      normalized = normalized.replace(/src="\//g, `src="${assetOrigin}/`)
      return normalized.replace(new RegExp(`src="${placeholder}`, 'g'), 'src="//')
    }
    return originalHtml
  }
}
