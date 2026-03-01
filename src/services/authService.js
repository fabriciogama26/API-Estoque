import { request as httpRequest } from './httpClient.js'

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

export async function loginWithLoginName(loginName, password) {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }

  const payload = {
    loginName,
    password,
  }

  const response = await httpRequest('POST', `${base}/api/auth/login`, {
    body: payload,
    skipSessionGuard: true,
  })
  const user = response?.user || null
  const session = response?.session || null
  if (!user?.id) {
    throw new Error('Falha ao autenticar.')
  }
  return { user, session }
}

export async function requestPasswordRecoveryByLoginName(loginName) {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }

  const payload = {
    loginName,
  }

  await httpRequest('POST', `${base}/api/auth/recover`, {
    body: payload,
    skipSessionGuard: true,
  })
  return true
}

export async function fetchCurrentUser() {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }
  const response = await httpRequest('GET', `${base}/api/auth/me`, {
    skipSessionGuard: true,
  })
  return response?.user || null
}

export async function resetPasswordWithCode(code, newPassword) {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }
  await httpRequest('POST', `${base}/api/auth/reset`, {
    body: { code, newPassword },
    skipSessionGuard: true,
  })
  return true
}

export async function reauthWithPassword(password) {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }
  await httpRequest('POST', `${base}/api/auth/reauth`, {
    body: { password },
  })
  return true
}

export async function changePassword(currentPassword, newPassword) {
  const base = resolveApiBase()
  if (!base) {
    throw new Error('Base da API nao encontrada.')
  }
  await httpRequest('POST', `${base}/api/auth/password/change`, {
    body: { currentPassword, newPassword },
  })
  return true
}

// Compat para require() em ambientes CJS
if (typeof module !== 'undefined') {
  module.exports = {
    loginWithLoginName,
    requestPasswordRecoveryByLoginName,
    fetchCurrentUser,
    resetPasswordWithCode,
    reauthWithPassword,
    changePassword,
  }
}
