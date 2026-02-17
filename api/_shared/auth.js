import { supabaseAdmin } from './supabaseClient.js'
import { sendError, handleError } from './http.js'

import { validateSession } from './sessionActivity.js'

export async function requireAuth(req, res) {
  const header =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    req.headers?.get?.('Authorization')

  if (!header || !header.startsWith('Bearer ')) {
    console.warn('[AUTH] Requisicao sem header de autorizacao.', {
      method: req?.method,
      path: req?.url || req?.originalUrl,
    })
    sendError(res, 401, 'Autorizacao requerida.', { code: 'AUTH_REQUIRED', req })
    return null
  }

  const token = header.slice(7).trim()
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
