import { supabaseAdmin } from './supabaseClient.js'
import { sendError } from './http.js'

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
    sendError(res, 401, 'Autorizacao requerida.')
    return null
  }

  const token = header.slice(7).trim()
  if (!token) {
    console.warn('[AUTH] Token vazio no header de autorizacao.', {
      method: req?.method,
      path: req?.url || req?.originalUrl,
    })
    sendError(res, 401, 'Token invalido.')
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
      sendError(res, 401, 'Token invalido ou expirado.')
      return null
    }

    return data.user
  } catch (error) {
    console.error('[AUTH] Falha ao validar token.', {
      method: req?.method,
      path: req?.url || req?.originalUrl,
      message: error?.message,
      stack: error?.stack,
    })
    sendError(res, 401, 'Token invalido ou expirado.')
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
