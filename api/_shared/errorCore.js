import { logApiError } from './logger.js'

const DEFAULT_MESSAGE = 'Erro interno do servidor.'

const KNOWN_CODES = new Set([
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'AUTH_EXPIRED',
  'RLS_DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMIT',
  'UPSTREAM_ERROR',
  'INTERNAL',
])

const CODE_STATUS = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  AUTH_EXPIRED: 401,
  RLS_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
}

const SUPABASE_CODE_MAP = {
  '23505': 'CONFLICT',
  '42501': 'RLS_DENIED',
  PGRST116: 'NOT_FOUND',
  PGRST301: 'RLS_DENIED',
}

const SESSION_CODE_MAP = {
  SESSION_EXPIRED: 'AUTH_EXPIRED',
  REAUTH_REQUIRED: 'AUTH_EXPIRED',
  INTERACTION_REQUIRED: 'VALIDATION_ERROR',
}

const REQUEST_ID_HEADERS = ['x-request-id', 'x-requestid']

const coerceStatus = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const readHeader = (headers, name) => {
  if (!headers) {
    return null
  }
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

const resolveRequestIdFromHeaders = (headers) => {
  if (!headers) {
    return null
  }
  for (const key of REQUEST_ID_HEADERS) {
    const value = readHeader(headers, key)
    if (value && String(value).trim()) {
      return String(value).trim()
    }
  }
  return null
}

const generateRequestId = () =>
  `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`

export const ensureRequestId = (reqOrHeaders, res = null) => {
  if (!reqOrHeaders) {
    const generated = generateRequestId()
    if (res?.setHeader && !res.headersSent) {
      res.setHeader('x-request-id', generated)
    }
    return generated
  }

  if (reqOrHeaders.requestId && String(reqOrHeaders.requestId).trim()) {
    const existing = String(reqOrHeaders.requestId).trim()
    if (res?.setHeader && !res.headersSent) {
      res.setHeader('x-request-id', existing)
    }
    return existing
  }

  const headers = reqOrHeaders.headers || reqOrHeaders
  const headerId = resolveRequestIdFromHeaders(headers)
  const requestId = headerId || generateRequestId()

  if (typeof reqOrHeaders === 'object') {
    reqOrHeaders.requestId = requestId
  }

  if (res?.setHeader && !res.headersSent) {
    res.setHeader('x-request-id', requestId)
  }

  return requestId
}

const normalizeCode = (value) => {
  if (!value) {
    return null
  }
  const raw = String(value).trim().toUpperCase()
  return raw || null
}

const mapStatusToCode = (status) => {
  if (status === 400) return 'VALIDATION_ERROR'
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'RLS_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 502 || status === 503) return 'UPSTREAM_ERROR'
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR'
  if (status >= 500) return 'INTERNAL'
  return 'INTERNAL'
}

const mapExternalCode = (code, status, message) => {
  if (SESSION_CODE_MAP[code]) {
    return SESSION_CODE_MAP[code]
  }
  if (SUPABASE_CODE_MAP[code]) {
    return SUPABASE_CODE_MAP[code]
  }
  if (code.includes('RLS') || code.includes('ROW_LEVEL')) {
    return 'RLS_DENIED'
  }
  if (status === 401 && message && /expirad|expirou|expired/i.test(message)) {
    return 'AUTH_EXPIRED'
  }
  return null
}

export const normalizeError = (error, options = {}) => {
  const fallbackMessage = options.fallbackMessage || DEFAULT_MESSAGE
  const rawStatus =
    error?.status ?? error?.statusCode ?? error?.httpStatus ?? error?.status_code ?? null
  let status = coerceStatus(rawStatus) || 500

  const message =
    (error?.message && String(error.message).trim()) || fallbackMessage

  const rawCode = normalizeCode(error?.code)
  let code = null
  if (rawCode && KNOWN_CODES.has(rawCode)) {
    code = rawCode
  } else if (rawCode) {
    code = mapExternalCode(rawCode, status, message)
  }

  if (!code) {
    code = mapStatusToCode(status)
  }

  const preferredStatus = CODE_STATUS[code] || null
  if (
    preferredStatus &&
    (status < 400 || status >= 600 || (status >= 500 && preferredStatus < 500))
  ) {
    status = preferredStatus
  }

  return {
    status,
    code,
    message,
    stack: error?.stack || null,
    details: error?.details ?? null,
    context: error?.context ?? null,
  }
}

export const buildErrorEnvelope = (normalized, requestId) => ({
  error: {
    code: normalized.code,
    message: normalized.message,
    request_id: requestId,
  },
})

const resolveUserId = (req) => {
  if (!req?.user) {
    return null
  }
  return (
    req?.user?.id ||
    req?.user?.email ||
    req?.user?.phone ||
    req?.user?.user_metadata?.nome ||
    null
  )
}

export const logApiErrorNormalized = async (normalized, reqLike = null) => {
  const requestId = ensureRequestId(reqLike)
  const context = {
    ...(normalized.context && typeof normalized.context === 'object' ? normalized.context : {}),
    request_id: requestId,
  }
  if (!('requestId' in context)) {
    context.requestId = requestId
  }
  if (normalized.details !== undefined) {
    context.details = normalized.details
  }

  await logApiError({
    message: normalized.message,
    status: normalized.status,
    code: normalized.code,
    method: reqLike?.method || null,
    path: reqLike?.url || reqLike?.originalUrl || null,
    userId: resolveUserId(reqLike),
    stack: normalized.stack,
    context,
  })
}
