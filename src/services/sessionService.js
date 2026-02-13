import { supabase, isSupabaseConfigured } from './supabaseClient.js'

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

const notifySessionGuard = (status, payload) => {
  if (status === 401 && payload?.code === 'SESSION_EXPIRED') {
    safeDispatch('session-expired', payload)
  }
  if (status === 403 && payload?.code === 'REAUTH_REQUIRED') {
    safeDispatch('session-reauth-required', payload)
  }
}

const safeJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
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

  const response = await fetch(`${base}/api/session/touch`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    notifySessionGuard(response.status, payload)
    return { ok: false, status: response.status, payload }
  }

  return { ok: true }
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

  const response = await fetch(`${base}/api/session/reauth`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    notifySessionGuard(response.status, payload)
    return { ok: false, status: response.status, payload }
  }

  return { ok: true }
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

  const response = await fetch(`${base}/api/session/revoke`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    notifySessionGuard(response.status, payload)
    return { ok: false, status: response.status, payload }
  }

  return { ok: true }
}
