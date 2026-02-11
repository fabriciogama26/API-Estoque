import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const DEVICE_KEY = 'api-estoque-device-id'

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

const resolveDeviceId = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing) {
      return existing
    }
    const generated =
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    window.localStorage.setItem(DEVICE_KEY, generated)
    return generated
  } catch {
    return null
  }
}

export function getSessionDeviceId() {
  return resolveDeviceId()
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
  const deviceId = resolveDeviceId()
  const headers = {
    Authorization: `Bearer ${token}`,
  }
  if (includeInteraction) {
    headers['X-User-Interaction'] = '1'
  }
  if (deviceId) {
    headers['X-Session-Id'] = deviceId
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
