import { supabase } from '../services/supabaseClient.js'

function normalizeBaseUrl() {
  const envBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  if (envBase) {
    return envBase
  }
  const current = window.location.origin
  if (current.includes('localhost:5173')) {
    return 'http://localhost:3000'
  }
  return current.replace(/\/$/, '')
}

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, value)
    }
  })
  return search.toString()
}

export async function downloadTermoEpiPdf({ params = {} } = {}) {
  const base = normalizeBaseUrl()
  const query = buildQuery(params)
  const url = query ? `${base}/api/documentos/termo-epi?${query}` : `${base}/api/documentos/termo-epi`

  const headers = new Headers()
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    } catch (error) {
      console.warn('Nao foi possivel obter token do Supabase.', error)
    }
  }

  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    })
  } catch (error) {
    const hint = 'Falha ao conectar ao gerador de PDF. Certifique-se de que o backend esta em execucao (ex.: DATA_MODE=local npx vercel dev --listen 3000).'
    throw new Error(hint)
  }

  if (!response.ok) {
    let message = 'Nao foi possivel gerar o PDF.'
    try {
      const text = await response.text()
      if (text) {
        try {
          const payload = JSON.parse(text)
          message = payload?.error || payload?.message || message
        } catch {
          message = text
        }
      }
    } catch {
      // ignore parsing errors
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  const blob = await response.blob()
  const identificador = params.matricula || params.nome || 'colaborador'
  const fileName = `termo-epi-${identificador}.pdf`
  const urlObject = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = urlObject
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(urlObject)
}
