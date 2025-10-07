import { supabaseAdmin } from './supabaseClient.js'
import { sendError } from './http.js'

export async function requireAuth(req, res) {
  const header =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    req.headers?.get?.('Authorization')

  if (!header || !header.startsWith('Bearer ')) {
    sendError(res, 401, 'Autorização requerida.')
    return null
  }

  const token = header.slice(7).trim()
  if (!token) {
    sendError(res, 401, 'Token inválido.')
    return null
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    sendError(res, 401, 'Token inválido ou expirado.')
    return null
  }

  return data.user
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
