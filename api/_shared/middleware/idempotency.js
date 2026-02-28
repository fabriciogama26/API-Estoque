import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../supabaseClient.js'
import { readJson, sendError } from '../http.js'

const IDEMPOTENCY_ROUTES = new Set([
  'create.pessoa',
  'create.material',
  'create.acidente',
  'create.entrada',
  'create.saida',
])

const IDEMPOTENCY_HEADERS = ['idempotency-key', 'x-idempotency-key']

const hashValue = (value) =>
  createHash('sha256')
    .update(value)
    .digest('hex')

const stableStringify = (value) => {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

const readBodyOnce = async (req) => {
  if (req.body) {
    return req.body
  }
  const body = await readJson(req)
  req.body = body
  return body
}

const readHeader = (headers, name) => {
  if (!headers) return null
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase())
  }
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (direct) {
    return Array.isArray(direct) ? direct[0] : direct
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : null
}

const resolveIdempotencyKey = (headers) => {
  for (const name of IDEMPOTENCY_HEADERS) {
    const value = readHeader(headers, name)
    if (value && String(value).trim()) {
      return String(value).trim()
    }
  }
  return null
}

const toJsonBody = (chunk) => {
  if (chunk === undefined || chunk === null) return null
  const raw = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const storeResponse = async (ctx, key, payload) => {
  const { statusCode, body, headers } = payload
  await supabaseAdmin
    .from('idempotency_keys')
    .update({
      status_code: statusCode,
      response_body: body,
      response_headers: headers,
      completed_at: new Date().toISOString(),
    })
    .eq('account_owner_id', ctx.tenantId)
    .eq('user_id', ctx.user.id)
    .eq('route', ctx.route)
    .eq('idempotency_key', key)
}

export async function idempotency(ctx) {
  if (!IDEMPOTENCY_ROUTES.has(ctx.route)) {
    return undefined
  }

  const { req, res } = ctx.raw || {}
  if (!req || !res || !ctx.user || !ctx.tenantId) {
    return undefined
  }

  const key = resolveIdempotencyKey(req.headers)
  if (!key) {
    return undefined
  }

  const body = await readBodyOnce(req)
  const requestHash = hashValue(stableStringify(body))

  supabaseAdmin
    .from('idempotency_keys')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .then(() => {})
    .catch(() => {})

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('idempotency_keys')
    .select('status_code, response_body, response_headers, request_hash, completed_at')
    .eq('account_owner_id', ctx.tenantId)
    .eq('user_id', ctx.user.id)
    .eq('route', ctx.route)
    .eq('idempotency_key', key)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    if (existing.request_hash !== requestHash) {
      sendError(res, 422, 'Idempotency-Key reutilizada com payload diferente.', {
        code: 'VALIDATION_ERROR',
        req,
      })
      return { done: true }
    }

    if (existing.response_body) {
      res.statusCode = existing.status_code || 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Idempotency-Replay', 'true')
      res.end(JSON.stringify(existing.response_body))
      return { done: true }
    }

    sendError(res, 409, 'Requisicao em processamento. Tente novamente.', {
      code: 'CONFLICT',
      req,
    })
    return { done: true }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error: insertError } = await supabaseAdmin.from('idempotency_keys').insert({
    account_owner_id: ctx.tenantId,
    user_id: ctx.user.id,
    route: ctx.route,
    idempotency_key: key,
    request_hash: requestHash,
    expires_at: expiresAt,
  })

  if (insertError && insertError.code === '23505') {
    const { data: recheck } = await supabaseAdmin
      .from('idempotency_keys')
      .select('status_code, response_body, request_hash')
      .eq('account_owner_id', ctx.tenantId)
      .eq('user_id', ctx.user.id)
      .eq('route', ctx.route)
      .eq('idempotency_key', key)
      .maybeSingle()

    if (recheck?.request_hash && recheck.request_hash !== requestHash) {
      sendError(res, 422, 'Idempotency-Key reutilizada com payload diferente.', {
        code: 'VALIDATION_ERROR',
        req,
      })
      return { done: true }
    }

    if (recheck?.response_body) {
      res.statusCode = recheck.status_code || 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Idempotency-Replay', 'true')
      res.end(JSON.stringify(recheck.response_body))
      return { done: true }
    }
  } else if (insertError) {
    throw insertError
  }

  const originalEnd = res.end.bind(res)
  res.end = (chunk, encoding, callback) => {
    const finalize = async () => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseBody = toJsonBody(chunk)
          const responseHeaders = res.getHeaders ? res.getHeaders() : null
          await storeResponse(ctx, key, {
            statusCode: res.statusCode,
            body: responseBody,
            headers: responseHeaders,
          })
        }
      } catch (error) {
        console.warn('[IDEMPOTENCY] Falha ao registrar resposta.', { message: error?.message })
      }

      originalEnd(chunk, encoding, callback)
    }

    void finalize()
  }

  return undefined
}
