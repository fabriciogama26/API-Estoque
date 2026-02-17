import { Readable } from 'node:stream'
import {
  buildErrorEnvelope,
  ensureRequestId,
  logApiErrorNormalized,
  normalizeError,
} from './errorCore.js'

export async function readJson(req) {
  if (req.body) {
    try {
      return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch (error) {
      throw createHttpError(400, 'Corpo da requisição inválido.')
    }
  }

  const chunks = []
  const stream = Readable.from(req)

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  if (!chunks.length) {
    return {}
  }

  try {
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    throw createHttpError(400, 'Corpo da requisição inválido.')
  }
}

export function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export function sendError(res, status, message, options = {}) {
  const normalized = normalizeError(
    { status, message, code: options?.code },
    { fallbackMessage: message }
  )
  const requestId = ensureRequestId(options?.req || options?.reqLike || null, res)
  sendJson(res, normalized.status, buildErrorEnvelope(normalized, requestId))
}

export function methodNotAllowed(res, methods, req = null) {
  res.setHeader('Allow', methods.join(', '))
  sendError(res, 405, 'Método não permitido.', { code: 'VALIDATION_ERROR', req })
}

export function createHttpError(status, message, options = {}) {
  const error = new Error(message)
  error.status = status
  if (options?.code) {
    error.code = options.code
  }
  if (options?.details) {
    error.details = options.details
  }
  if (options?.context) {
    error.context = options.context
  }
  return error
}

function logServerError(normalized, req, fallbackMessage) {
  const status = normalized?.status || 500
  const path = req?.url || req?.originalUrl || null
  const method = req?.method || null
  const user =
    req?.user?.id ||
    req?.user?.email ||
    req?.user?.phone ||
    req?.user?.user_metadata?.nome ||
    null

  console.error('[API_ERROR]', {
    status,
    code: normalized?.code,
    message: normalized?.message || fallbackMessage,
    method,
    path,
    user,
    stack: normalized?.stack,
  })
}

export function handleError(res, error, fallbackMessage = 'Erro interno do servidor.', req = null) {
  const normalized = normalizeError(error, { fallbackMessage })
  const requestId = ensureRequestId(req, res)

  logServerError(normalized, req, fallbackMessage)

  if (req) {
    logApiErrorNormalized(normalized, req).catch((logErr) => {
      console.warn('[API_ERROR_LOG] Falha ao registrar erro no Supabase.', {
        message: logErr?.message,
      })
    })
  }

  sendJson(res, normalized.status, buildErrorEnvelope(normalized, requestId))
}

export function parseQuery(req) {
  return req.query || {}
}
