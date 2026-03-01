import { Readable } from 'node:stream'
import { createHttpError } from './http.js'

const resolveSupabaseUrl = () => {
  const raw =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  const trimmed = String(raw || '').trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw createHttpError(500, 'SUPABASE_URL nao definido para proxy.')
  }
  return trimmed
}

const resolveAnonKey = () => {
  const raw =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    throw createHttpError(500, 'SUPABASE_ANON_KEY nao definido para proxy.')
  }
  return trimmed
}

const buildTargetUrl = (reqUrl) => {
  const base = resolveSupabaseUrl()
  const rawPath = (reqUrl || '').replace(/^\/api\/supabase/, '')
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return `${base}${path}`
}

const filterHeaders = (headers) => {
  const blocked = new Set([
    'host',
    'connection',
    'content-length',
    'cookie',
    'authorization',
    'accept-encoding',
  ])
  const result = {}
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (!key) return
    const lower = key.toLowerCase()
    if (blocked.has(lower)) return
    result[key] = value
  })
  return result
}

const forwardResponseHeaders = (res, response) => {
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === 'set-cookie') return
    if (lower === 'transfer-encoding') return
    res.setHeader(key, value)
  })
}

export async function proxySupabaseRequest(req, res, accessToken) {
  if (!accessToken) {
    throw createHttpError(401, 'Autorizacao requerida.', { code: 'AUTH_REQUIRED' })
  }

  const targetUrl = buildTargetUrl(req?.url || '')
  const anonKey = resolveAnonKey()
  const method = (req?.method || 'GET').toUpperCase()
  const headers = {
    ...filterHeaders(req?.headers || {}),
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  }

  const options = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    options.body = req
    options.duplex = 'half'
  }

  const response = await fetch(targetUrl, options)
  res.statusCode = response.status
  forwardResponseHeaders(res, response)

  if (!response.body) {
    res.end()
    return
  }

  const nodeStream = Readable.fromWeb(response.body)
  nodeStream.on('error', () => {
    res.end()
  })
  nodeStream.pipe(res)
}
