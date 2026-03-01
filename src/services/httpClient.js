import { notifySessionGuardFromResponse } from './sessionService.js'

const REQUEST_ID_HEADER = 'x-request-id'
const DEFAULT_ERROR_MESSAGE = 'Falha ao comunicar com o servidor.'

export class ApiError extends Error {
  constructor({ code, message, status, requestId, raw }) {
    super(message || DEFAULT_ERROR_MESSAGE)
    this.name = 'ApiError'
    this.code = code || 'INTERNAL'
    this.status = status ?? null
    this.requestId = requestId || null
    this.raw = raw || null
  }
}

const isFormData = (value) =>
  typeof FormData !== 'undefined' && value instanceof FormData

const hasContentType = (headers) => {
  if (!headers) {
    return false
  }
  const keys = Object.keys(headers)
  return keys.some((key) => key.toLowerCase() === 'content-type')
}

const normalizeHeaders = (headers) => {
  if (!headers) {
    return {}
  }
  if (headers instanceof Headers) {
    const mapped = {}
    headers.forEach((value, key) => {
      mapped[key] = value
    })
    return mapped
  }
  return { ...headers }
}

const readResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  let text = null
  try {
    text = await response.text()
  } catch {
    text = null
  }
  if (!text) {
    return { data: null, text: null, isJson: contentType.includes('application/json'), parseError: false }
  }
  if (contentType.includes('application/json')) {
    try {
      return { data: JSON.parse(text), text, isJson: true, parseError: false }
    } catch {
      return { data: null, text, isJson: true, parseError: true }
    }
  }
  return { data: text, text, isJson: false, parseError: false }
}

const resolveEnvelopeError = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  if (payload.error && typeof payload.error === 'object') {
    return {
      code: payload.error.code || null,
      message: payload.error.message || null,
      requestId: payload.error.request_id || payload.error.requestId || null,
    }
  }
  if (typeof payload.error === 'string') {
    return {
      code: payload.code || null,
      message: payload.error,
      requestId: payload.request_id || payload.requestId || null,
    }
  }
  if (payload.message || payload.code) {
    return {
      code: payload.code || null,
      message: payload.message || null,
      requestId: payload.request_id || payload.requestId || null,
    }
  }
  return null
}

const resolveRequestIdFromResponse = (response) => {
  if (!response?.headers) {
    return null
  }
  const headerId =
    response.headers.get(REQUEST_ID_HEADER) ||
    response.headers.get('X-Request-Id') ||
    response.headers.get('x-requestid') ||
    null
  return headerId ? String(headerId).trim() : null
}

const buildApiError = ({ response, payload, text, fallbackMessage }) => {
  const envelope = resolveEnvelopeError(payload)
  const requestId = envelope?.requestId || resolveRequestIdFromResponse(response)
  const message =
    envelope?.message ||
    text ||
    fallbackMessage ||
    `Falha na requisicao (status ${response?.status ?? 'desconhecido'}).`
  const code = (envelope?.code || '').toString().trim() || 'INTERNAL'

  return new ApiError({
    code,
    message,
    status: response?.status ?? null,
    requestId,
    raw: {
      payload,
      text,
      status: response?.status ?? null,
    },
  })
}

export async function request(method, url, options = {}) {
  const { body, headers, signal, requestId, raw, responseType, skipSessionGuard } = options
  const normalizedHeaders = normalizeHeaders(headers)
  if (requestId && !normalizedHeaders['X-Request-Id'] && !normalizedHeaders['x-request-id']) {
    normalizedHeaders['X-Request-Id'] = requestId
  }

  const expectedResponseType = responseType || 'json'
  const hasBody = body !== undefined && body !== null
  const formData = hasBody && isFormData(body)
  const payload = hasBody && !formData && typeof body !== 'string' ? JSON.stringify(body) : body

  if (hasBody && !formData && !hasContentType(normalizedHeaders)) {
    normalizedHeaders['Content-Type'] = 'application/json'
  }

  const config = {
    method,
    headers: normalizedHeaders,
    signal,
    credentials: 'include',
  }
  if (hasBody && method !== 'GET') {
    config.body = payload
  }

  try {
    const response = await fetch(url, config)

    if (response.ok && expectedResponseType === 'blob') {
      return await response.blob()
    }

    const { data, text, isJson, parseError } = await readResponseBody(response)

    if (!response.ok) {
      if (!skipSessionGuard) {
        notifySessionGuardFromResponse(response.status, data)
      }
      throw buildApiError({
        response,
        payload: data,
        text,
        fallbackMessage: DEFAULT_ERROR_MESSAGE,
      })
    }

    if (expectedResponseType === 'text') {
      return text ?? ''
    }

    if (isJson && parseError) {
      throw new ApiError({
        code: 'INTERNAL',
        message: 'Resposta invalida do servidor.',
        status: response.status,
        requestId: resolveRequestIdFromResponse(response),
        raw: { text },
      })
    }

    return data ?? (raw ? text : data)
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    const isAbort = err?.name === 'AbortError'
    const message = isAbort ? 'Requisicao cancelada.' : err?.message || DEFAULT_ERROR_MESSAGE
    throw new ApiError({
      code: 'UPSTREAM_ERROR',
      message,
      status: null,
      requestId: null,
      raw: { cause: err },
    })
  }
}

export const get = (url, options = {}) => request('GET', url, options)
export const post = (url, body, options = {}) => request('POST', url, { ...options, body })
export const put = (url, body, options = {}) => request('PUT', url, { ...options, body })
export const del = (url, options = {}) => request('DELETE', url, options)
