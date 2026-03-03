import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { ApiError, request as httpRequest } from './httpClient.js'

const SESSION_KEY = 'api-estoque-session-id'

const resolveApiBase = () => {
  const envBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
  if (envBase) {
    return envBase
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

const safeDispatch = (name, detail) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch {
    // ignore
  }
}

const generateSessionId = () => {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const resolveSessionId = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) {
      return existing
    }
    return null
  } catch {
    return null
  }
}

export function getSessionId() {
  return resolveSessionId()
}

export function getSessionDeviceId() {
  return getSessionId()
}

export function rotateSessionId() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const generated = generateSessionId()
    window.localStorage.setItem(SESSION_KEY, generated)
    return generated
  } catch {
    return null
  }
}

export function clearSessionId() {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

const resolvePayloadCode = (payload) => {
  if (!payload) {
    return null
  }
  if (payload.error && typeof payload.error === 'object') {
    return payload.error.code || null
  }
  if (payload.code) {
    return payload.code
  }
  return null
}

const notifySessionGuard = (status, payload) => {
  const code = (resolvePayloadCode(payload) || '').toString().trim().toUpperCase()
  if (
    status === 401 &&
    (code === 'SESSION_EXPIRED' || code === 'AUTH_EXPIRED' || code === 'AUTH_REQUIRED')
  ) {
    safeDispatch('session-expired', payload)
  }
  if (status === 403 && (code === 'REAUTH_REQUIRED' || code === 'AUTH_EXPIRED')) {
    safeDispatch('session-reauth-required', payload)
  }
}

const ensureSessionId = () => {
  const existing = resolveSessionId()
  if (existing) {
    return existing
  }
  return rotateSessionId()
}

const buildHeaders = async (includeInteraction) => {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) {
    safeDispatch('session-expired', { code: 'SESSION_EXPIRED' })
    return null
  }
  const sessionId = includeInteraction ? ensureSessionId() : resolveSessionId()
  const headers = {
    Authorization: `Bearer ${token}`,
  }
  if (includeInteraction) {
    headers['X-User-Interaction'] = '1'
  }
  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  }
  return headers
}

export function notifySessionGuardFromResponse(status, payload) {
  notifySessionGuard(status, payload)
}

export async function touchSession() {
  const base = resolveApiBase()
  if (!base) {
    return { ok: false, skipped: true }
  }

  const headers = await buildHeaders(true)
  if (!headers) {
    return { ok: false }
  }

  try {
    await httpRequest('POST', `${base}/api/session/touch`, { headers })
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status ?? null, payload: err.raw?.payload ?? null }
    }
    return { ok: false }
  }
}

export async function markSessionReauth() {
  const base = resolveApiBase()
  if (!base) {
    return { ok: false, skipped: true }
  }

  const headers = await buildHeaders(false)
  if (!headers) {
    return { ok: false }
  }

  try {
    await httpRequest('POST', `${base}/api/session/reauth`, { headers })
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status ?? null, payload: err.raw?.payload ?? null }
    }
    return { ok: false }
  }
}

export async function revokeSession() {
  const base = resolveApiBase()
  if (!base) {
    return { ok: false, skipped: true }
  }

  const headers = await buildHeaders(false)
  if (!headers) {
    return { ok: false }
  }

  try {
    await httpRequest('POST', `${base}/api/session/revoke`, { headers })
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status ?? null, payload: err.raw?.payload ?? null }
    }
    return { ok: false }
  }
}
