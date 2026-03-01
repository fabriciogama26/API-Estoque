import { request as httpRequest } from './httpClient.js'

let effectiveUserCache = null

export function invalidateEffectiveAppUserCache() {
  effectiveUserCache = null
}


export async function resolveEffectiveAppUser(userId, { forceRefresh = false } = {}) {
  if (!userId) {
    if (forceRefresh) {
      effectiveUserCache = null
    }
    return null
  }

  if (!forceRefresh && effectiveUserCache?.authUserId === userId) {
    return effectiveUserCache
  }

  const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base) {
    return null
  }

  const response = await httpRequest('GET', `${base}/api/auth/effective`, {
    skipSessionGuard: true,
  })
  const effective = response?.effective || null
  if (effective) {
    effectiveUserCache = effective
    return effective
  }
  return null
}
