import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin, supabaseAnon } from './supabaseClient.js'
import { createHttpError } from './http.js'
import { resolveOwnerId } from './tenant.js'

const SESSION_TABLE = 'auth_sessions'
const REFRESH_WINDOW_MS = 60 * 1000

const hashValue = (value) =>
  createHash('sha256')
    .update(value)
    .digest('hex')

const nowIso = () => new Date().toISOString()

const computeExpiresAt = (session) => {
  if (session?.expires_at) {
    return new Date(Number(session.expires_at) * 1000)
  }
  if (session?.expires_in) {
    return new Date(Date.now() + Number(session.expires_in) * 1000)
  }
  return new Date(Date.now() + 60 * 60 * 1000)
}

const isExpiringSoon = (expiresAt) => {
  if (!expiresAt) return true
  const exp = new Date(expiresAt)
  if (!Number.isFinite(exp.getTime())) return true
  return exp.getTime() - Date.now() <= REFRESH_WINDOW_MS
}

const resolveRequestIp = (req) => {
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

const resolveUserAgent = (req) =>
  req?.headers?.['user-agent'] ||
  req?.headers?.['User-Agent'] ||
  req?.headers?.get?.('user-agent') ||
  req?.headers?.get?.('User-Agent') ||
  ''

export async function createAuthSession({ session, user, req }) {
  if (!session?.access_token || !session?.refresh_token || !user?.id) {
    throw createHttpError(500, 'Sessao invalida para persistir.')
  }

  const accountOwnerId = await resolveOwnerId(user.id)
  if (!accountOwnerId) {
    throw createHttpError(403, 'Owner nao encontrado para o usuario.')
  }

  const sessionId = randomUUID()
  const expiresAt = computeExpiresAt(session)
  const ip = resolveRequestIp(req)
  const ua = resolveUserAgent(req)

  const payload = {
    session_id: sessionId,
    user_id: user.id,
    account_owner_id: accountOwnerId,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    access_expires_at: expiresAt.toISOString(),
    last_refresh_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
    revoked_at: null,
    ip_hash: ip ? hashValue(ip) : null,
    ua_hash: ua ? hashValue(ua) : null,
  }

  const { error } = await supabaseAdmin.from(SESSION_TABLE).insert(payload)
  if (error) {
    const err = createHttpError(500, 'Falha ao registrar sessao.')
    err.code = error.code
    err.context = {
      stage: 'insert_auth_session',
      table: SESSION_TABLE,
      message: error.message,
    }
    throw err
  }

  return { sessionId, accountOwnerId, accessExpiresAt: payload.access_expires_at }
}

export async function loadAuthSession(sessionId) {
  if (!sessionId) {
    return null
  }
  const { data, error } = await supabaseAdmin
    .from(SESSION_TABLE)
    .select(
      'id, session_id, user_id, account_owner_id, access_token, refresh_token, access_expires_at, last_refresh_at, revoked_at'
    )
    .eq('session_id', sessionId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const err = createHttpError(500, 'Falha ao carregar sessao.')
    err.code = error.code
    err.context = {
      stage: 'load_auth_session',
      table: SESSION_TABLE,
      message: error.message,
    }
    throw err
  }

  return data || null
}

export async function refreshAuthSession(sessionRecord) {
  if (!supabaseAnon) {
    throw createHttpError(500, 'SUPABASE_ANON_KEY ausente para refresh.')
  }
  const refreshToken = sessionRecord?.refresh_token
  if (!refreshToken) {
    throw createHttpError(401, 'Refresh token ausente.')
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: refreshToken,
  })
  if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
    const err = createHttpError(401, 'Sessao expirada. Faca login novamente.')
    err.code = error?.code || 'AUTH_EXPIRED'
    throw err
  }

  const nextSession = data.session
  const expiresAt = computeExpiresAt(nextSession)
  const payload = {
    access_token: nextSession.access_token,
    refresh_token: nextSession.refresh_token,
    access_expires_at: expiresAt.toISOString(),
    last_refresh_at: nowIso(),
    updated_at: nowIso(),
  }

  const { error: updateError } = await supabaseAdmin
    .from(SESSION_TABLE)
    .update(payload)
    .eq('id', sessionRecord.id)

  if (updateError) {
    const err = createHttpError(500, 'Falha ao atualizar sessao.')
    err.code = updateError.code
    err.context = {
      stage: 'refresh_auth_session',
      table: SESSION_TABLE,
      message: updateError.message,
    }
    throw err
  }

  return {
    ...sessionRecord,
    ...payload,
  }
}

export async function ensureAuthSession(sessionRecord) {
  if (!sessionRecord) {
    return null
  }
  if (!isExpiringSoon(sessionRecord.access_expires_at)) {
    return sessionRecord
  }
  return await refreshAuthSession(sessionRecord)
}

export async function revokeAuthSession(sessionId) {
  if (!sessionId) {
    return { ok: false }
  }
  const now = nowIso()
  const { error } = await supabaseAdmin
    .from(SESSION_TABLE)
    .update({ revoked_at: now, updated_at: now })
    .eq('session_id', sessionId)
    .is('revoked_at', null)
  if (error) {
    const err = createHttpError(500, 'Falha ao revogar sessao.')
    err.code = error.code
    err.context = {
      stage: 'revoke_auth_session',
      table: SESSION_TABLE,
      message: error.message,
    }
    throw err
  }
  return { ok: true }
}
