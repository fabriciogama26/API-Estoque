import { supabaseAdmin, supabaseAnonKey } from './supabaseClient.js'
import { sendError, handleError } from './http.js'
import {
  ensureAuthSession,
  loadAuthSession,
  refreshAuthSession,
  revokeAuthSession,
} from './authSessionStore.js'
import { getSessionIdFromCookies } from './cookies.js'

import { validateSession } from './sessionActivity.js'

export async function requireAuth(req, res) {
  const header =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    req.headers?.get?.('Authorization')

  const bearerMatch = typeof header === 'string' ? header.match(/Bearer\s+(.+)/i) : null
  const rawBearerToken = bearerMatch?.[1]?.trim() || ''

  const decodeJwtPayload = (token) => {
    if (!token || typeof token !== 'string') return null
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

  const isAnonJwt = (token) => {
    if (!token) return false
    if (supabaseAnonKey && token === supabaseAnonKey) {
      return true
    }
    const payload = decodeJwtPayload(token)
    return payload?.role === 'anon'
  }

  const bearerToken = isAnonJwt(rawBearerToken) ? '' : rawBearerToken

  const tryCookieSession = async () => {
    const sessionId = getSessionIdFromCookies(req)
    if (!sessionId) {
      return null
    }
    const record = await loadAuthSession(sessionId)
    if (!record) {
      return null
    }

    let activeRecord = await ensureAuthSession(record)
    let accessToken = activeRecord?.access_token || ''
    let userResponse = await supabaseAdmin.auth.getUser(accessToken)
    if (userResponse?.error || !userResponse?.data?.user) {
      try {
        activeRecord = await refreshAuthSession(activeRecord)
        accessToken = activeRecord?.access_token || ''
        userResponse = await supabaseAdmin.auth.getUser(accessToken)
      } catch (refreshError) {
        await revokeAuthSession(sessionId)
        throw refreshError
      }
    }

    if (userResponse?.error || !userResponse?.data?.user) {
      await revokeAuthSession(sessionId)
      return null
    }

    req.authToken = accessToken
    req.authSessionId = sessionId
    req.accountOwnerId = activeRecord?.account_owner_id || null
    return userResponse.data.user
  }

  if (!bearerToken) {
    try {
      const cookieUser = await tryCookieSession()
      if (!cookieUser) {
        console.warn('[AUTH] Requisicao sem token/cookie valido.', {
          method: req?.method,
          path: req?.url || req?.originalUrl,
        })
        sendError(res, 401, 'Autorizacao requerida.', { code: 'AUTH_REQUIRED', req })
        return null
      }
      const sessionGuard = await validateSession(req, cookieUser, req.authToken, {
        requireReauth: Boolean(req?.requiresReauth),
      })
      if (!sessionGuard?.ok) {
        const status = sessionGuard.status || 401
        const codeRaw = (sessionGuard.code || '').toString().trim().toUpperCase()
        const code =
          codeRaw === 'INTERACTION_REQUIRED'
            ? 'VALIDATION_ERROR'
            : 'AUTH_EXPIRED'
        sendError(res, status, sessionGuard.message || 'Sessao expirada. Faca login novamente.', {
          code,
          req,
        })
        return null
      }
      return cookieUser
    } catch (cookieError) {
      const status = cookieError?.status || 401
      const message = cookieError?.message || 'Token invalido ou expirado.'
      if (status >= 500) {
        handleError(res, cookieError, message, req)
      } else {
        const fallbackCode = status === 401 ? 'AUTH_EXPIRED' : null
        sendError(res, status, message, { code: fallbackCode, req })
      }
      return null
    }
  }

  const token = bearerToken
  req.authToken = token
  if (!token) {
    console.warn('[AUTH] Token vazio no header de autorizacao.', {
      method: req?.method,
      path: req?.url || req?.originalUrl,
    })
    sendError(res, 401, 'Token invalido.', { code: 'AUTH_REQUIRED', req })
    return null
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) {
      console.warn('[AUTH] Token invalido ou expirado.', {
        method: req?.method,
        path: req?.url || req?.originalUrl,
        code: error?.code,
        message: error?.message,
      })
      sendError(res, 401, 'Token invalido ou expirado.', { code: 'AUTH_EXPIRED', req })
      return null
    }

    const sessionGuard = await validateSession(req, data.user, token, {
      requireReauth: Boolean(req?.requiresReauth),
    })
    if (!sessionGuard?.ok) {
      const status = sessionGuard.status || 401
      const codeRaw = (sessionGuard.code || '').toString().trim().toUpperCase()
      const code =
        codeRaw === 'INTERACTION_REQUIRED'
          ? 'VALIDATION_ERROR'
          : 'AUTH_EXPIRED'
      sendError(res, status, sessionGuard.message || 'Sessao expirada. Faca login novamente.', {
        code,
        req,
      })
      return null
    }

    return data.user
  } catch (error) {
    const status = error?.status || 401
    const message = error?.message || 'Token invalido ou expirado.'
    if (status >= 500) {
      handleError(res, error, message, req)
    } else {
      const fallbackCode = status === 401 ? 'AUTH_EXPIRED' : null
      sendError(res, status, message, { code: fallbackCode, req })
    }
    return null
  }
}

export function resolveUsuarioNome(user) {
  if (!user) {
    return 'sistema'
  }
  const metadata = user.user_metadata || {}
  return (
    metadata.nome ||
    metadata.full_name ||
    metadata.name ||
    user.email ||
    user.phone ||
    user.id ||
    'sistema'
  )
}
