import { supabaseAdmin } from './supabaseClient.js'
import { createHttpError } from './http.js'

const TENANT_KEYS = [
  'account_owner_id',
  'accountOwnerId',
  'owner_id',
  'ownerId',
  'tenant_id',
  'tenantId',
]

const extractTenantId = (value) => {
  if (!value) return null
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return null
}

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

const resolveTenantFromObject = (obj) => {
  if (!obj || typeof obj !== 'object') return null
  for (const key of TENANT_KEYS) {
    const candidate = extractTenantId(obj[key])
    if (candidate) return candidate
  }
  return null
}

export const resolveTenantFromJwt = (token) => {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  const direct = resolveTenantFromObject(payload)
  if (direct) return direct
  const appMeta = resolveTenantFromObject(payload.app_metadata)
  if (appMeta) return appMeta
  const userMeta = resolveTenantFromObject(payload.user_metadata)
  if (userMeta) return userMeta
  return null
}

export async function resolveOwnerId(userId) {
  if (!userId) {
    throw createHttpError(400, 'Usuario invalido para resolver owner.')
  }
  const { data, error } = await supabaseAdmin.rpc('my_owner_id_v2', { p_user_id: userId })
  if (error) {
    const httpError = createHttpError(500, 'Falha ao resolver owner do usuario.')
    httpError.code = error.code
    httpError.details = error.details || null
    httpError.context = { rpc: 'my_owner_id_v2' }
    throw httpError
  }
  const resolved = Array.isArray(data) ? data[0] : data
  if (!resolved) {
    throw createHttpError(404, 'Owner nao encontrado para o usuario informado.')
  }
  return resolved
}

export async function resolveTenantId({ user, token }) {
  const fromUser = resolveTenantFromObject(user?.app_metadata) || resolveTenantFromObject(user?.user_metadata)
  if (fromUser) return fromUser

  const fromToken = resolveTenantFromJwt(token)
  if (fromToken) return fromToken

  if (!user?.id) {
    return null
  }

  return resolveOwnerId(user.id)
}
