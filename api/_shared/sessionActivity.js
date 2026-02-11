import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabaseClient.js'
import { createHttpError } from './http.js'

const SESSION_TABLE = 'auth_session_activity'
const SESSION_TIMEBOX_MS = 12 * 60 * 60 * 1000
const SESSION_IDLE_MS = 30 * 60 * 1000
const SESSION_REAUTH_WINDOW_MS = 15 * 60 * 1000
const SESSION_TOUCH_THROTTLE_MS = 30 * 1000

const hashValue = (value) =>
  createHash('sha256')
    .update(value)
    .digest('hex')

const nowIso = () => new Date().toISOString()

function decodeJwtPayload(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  try {
    const raw = Buffer.from(padded, 'base64').toString('utf8')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function resolveSessionHeaderId(req) {
  const value =
    req?.headers?.['x-session-id'] ||
    req?.headers?.['X-Session-Id'] ||
    req?.headers?.get?.('x-session-id') ||
    req?.headers?.get?.('X-Session-Id') ||
    ''
  const normalized = String(value).trim()
  return normalized || null
}

function resolveSessionId(req, token) {
  const headerId = resolveSessionHeaderId(req)
  if (headerId) {
    return headerId
  }
  const payload = decodeJwtPayload(token)
  const candidate =
    payload?.session_id ||
    payload?.sessionId ||
    payload?.jti ||
    payload?.sid ||
    null
  if (candidate && typeof candidate === 'string') {
    return candidate.trim()
  }
  return hashValue(token)
}

function resolveInteractionHeader(req) {
  const value =
    req?.headers?.['x-user-interaction'] ||
    req?.headers?.['X-User-Interaction'] ||
    req?.headers?.get?.('x-user-interaction') ||
    req?.headers?.get?.('X-User-Interaction') ||
    ''
  const normalized = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on', 'y'].includes(normalized)
}

function resolveUserAgent(req) {
  return (
    req?.headers?.['user-agent'] ||
    req?.headers?.['User-Agent'] ||
    req?.headers?.get?.('user-agent') ||
    req?.headers?.get?.('User-Agent') ||
    ''
  )
}

function resolveIp(req) {
  const forwarded =
    req?.headers?.['x-forwarded-for'] ||
    req?.headers?.['X-Forwarded-For'] ||
    req?.headers?.get?.('x-forwarded-for') ||
    req?.headers?.get?.('X-Forwarded-For') ||
    ''
  if (forwarded) {
    return String(forwarded).split(',')[0].trim()
  }
  return (
    req?.headers?.['x-real-ip'] ||
    req?.headers?.['X-Real-IP'] ||
    req?.headers?.get?.('x-real-ip') ||
    req?.headers?.get?.('X-Real-IP') ||
    req?.socket?.remoteAddress ||
    ''
  )
}

async function resolveOwnerId(userId) {
  if (!userId) {
    return null
  }
  const { data: dependent, error: depError } = await supabaseAdmin
    .from('app_users_dependentes')
    .select('owner_app_user_id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (!depError && dependent?.owner_app_user_id) {
    return dependent.owner_app_user_id
  }

  const { data: owner, error: ownerError } = await supabaseAdmin
    .from('app_users')
    .select('id, parent_user_id')
    .eq('id', userId)
    .maybeSingle()

  if (ownerError) {
    return null
  }

  return owner?.parent_user_id ?? owner?.id ?? null
}

function isExpiredByIdle(lastSeenAt, createdAt, now) {
  const base = lastSeenAt || createdAt
  if (!base) {
    return false
  }
  const last = new Date(base)
  return Number.isFinite(last.getTime()) && now - last.getTime() > SESSION_IDLE_MS
}

function isExpiredByTimebox(expiresAt, now) {
  if (!expiresAt) {
    return false
  }
  const expires = new Date(expiresAt)
  return Number.isFinite(expires.getTime()) && now > expires.getTime()
}

function isReauthExpired(lastReauthAt, createdAt, now) {
  const base = lastReauthAt || createdAt
  if (!base) {
    return true
  }
  const last = new Date(base)
  return Number.isFinite(last.getTime()) ? now - last.getTime() > SESSION_REAUTH_WINDOW_MS : true
}

async function createSessionRecord({ req, userId, sessionId, now }) {
  const ip = resolveIp(req)
  const ua = resolveUserAgent(req)
  const ipHash = ip ? hashValue(ip) : null
  const uaHash = ua ? hashValue(ua) : null
  const ownerId = await resolveOwnerId(userId)
  const createdAt = nowIso()

  const payload = {
    user_id: userId,
    account_owner_id: ownerId,
    session_id: sessionId,
    last_seen_at: createdAt,
    last_reauth_at: createdAt,
    created_at: createdAt,
    expires_at: new Date(now.getTime() + SESSION_TIMEBOX_MS).toISOString(),
    ip_hash: ipHash,
    ua_hash: uaHash,
  }

  const { error: insertError } = await supabaseAdmin.from(SESSION_TABLE).insert(payload)
  if (insertError && insertError.code !== '23505') {
    throw createHttpError(500, 'Falha ao registrar sessao.')
  }

  return {
    ...payload,
    id: null,
    revoked_at: null,
  }
}

async function loadSessionRecord({ req, userId, sessionId }) {
  const { data, error } = await supabaseAdmin
    .from(SESSION_TABLE)
    .select('id, last_seen_at, last_reauth_at, created_at, expires_at, revoked_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) {
    throw createHttpError(500, 'Falha ao validar sessao.')
  }

  if (data) {
    return data
  }

  const now = new Date()
  const created = await createSessionRecord({ req, userId, sessionId, now })
  if (created.id) {
    return created
  }

  const { data: fallback } = await supabaseAdmin
    .from(SESSION_TABLE)
    .select('id, last_seen_at, last_reauth_at, created_at, expires_at, revoked_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle()

  return fallback || created
}

function buildSessionError({ status, code, message }) {
  return { ok: false, status, code, message }
}

export async function validateSession(req, user, token, { requireReauth = false } = {}) {
  if (!user?.id || !token) {
    throw createHttpError(401, 'Sessao invalida.')
  }

  const sessionId = resolveSessionId(req, token)
  const now = new Date()
  const record = await loadSessionRecord({ req, userId: user.id, sessionId })

  const expired =
    Boolean(record?.revoked_at) ||
    isExpiredByTimebox(record?.expires_at, now) ||
    isExpiredByIdle(record?.last_seen_at, record?.created_at, now)

  if (expired) {
    if (record?.id && !record?.revoked_at) {
      await supabaseAdmin.from(SESSION_TABLE).update({ revoked_at: nowIso() }).eq('id', record.id)
    }
    return buildSessionError({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: 'Sessao expirada. Faca login novamente.',
    })
  }

  if (requireReauth && isReauthExpired(record?.last_reauth_at, record?.created_at, now)) {
    return buildSessionError({
      status: 403,
      code: 'REAUTH_REQUIRED',
      message: 'Reautenticacao necessaria.',
    })
  }

  return { ok: true, sessionId, record }
}

export async function touchSession(req, user, token) {
  const interaction = resolveInteractionHeader(req)
  if (!interaction) {
    return buildSessionError({
      status: 400,
      code: 'INTERACTION_REQUIRED',
      message: 'Interacao do usuario obrigatoria.',
    })
  }

  const validated = await validateSession(req, user, token)
  if (!validated.ok) {
    return validated
  }

  const { record } = validated
  const now = new Date()
  const lastSeen = record?.last_seen_at ? new Date(record.last_seen_at) : null
  const shouldTouch =
    !lastSeen || (Number.isFinite(lastSeen.getTime()) && now - lastSeen.getTime() > SESSION_TOUCH_THROTTLE_MS)

  if (shouldTouch && record?.id) {
    const ip = resolveIp(req)
    const ua = resolveUserAgent(req)
    const ipHash = ip ? hashValue(ip) : null
    const uaHash = ua ? hashValue(ua) : null
    await supabaseAdmin
      .from(SESSION_TABLE)
      .update({ last_seen_at: nowIso(), ip_hash: ipHash, ua_hash: uaHash })
      .eq('id', record.id)
  }

  return { ok: true, touched: Boolean(shouldTouch) }
}

export async function markSessionReauth(req, user, token) {
  const validated = await validateSession(req, user, token)
  if (!validated.ok) {
    return validated
  }

  const { record } = validated
  if (record?.id) {
    await supabaseAdmin
      .from(SESSION_TABLE)
      .update({ last_reauth_at: nowIso(), last_seen_at: nowIso() })
      .eq('id', record.id)
  }
  return { ok: true }
}

export function getSessionTimeboxMs() {
  return SESSION_TIMEBOX_MS
}

export function getSessionIdleMs() {
  return SESSION_IDLE_MS
}

export function getReauthWindowMs() {
  return SESSION_REAUTH_WINDOW_MS
}
