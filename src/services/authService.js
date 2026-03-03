import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { logError } from './errorLogService.js'
import { validatePasswordOrThrow } from './passwordPolicyService.js'
import { request as httpRequest } from './httpClient.js'

function assertSupabase() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase nao configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

const resolveFunctionsBase = () => {
  const envBase = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '')
  if (envBase) {
    return envBase
  }
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`
  }
  return ''
}

const buildFunctionsHeaders = () => {
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const headers = {
    'Content-Type': 'application/json',
  }
  if (anonKey) {
    headers.apikey = anonKey
    headers.Authorization = `Bearer ${anonKey}`
  }
  return headers
}

export async function loginWithLoginName(loginName, password) {
  const base = resolveFunctionsBase()
  if (!base) {
    throw new Error('Base das edge functions nao encontrada.')
  }

  const payload = {
    loginName,
    password,
  }

  const response = await httpRequest('POST', `${base}/auth-login`, {
    body: payload,
    headers: buildFunctionsHeaders(),
    skipSessionGuard: true,
  })
  const session = response?.session || null
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error('Falha ao autenticar.')
  }
  return session
}

export async function requestPasswordRecoveryByLoginName(loginName) {
  const base = resolveFunctionsBase()
  if (!base) {
    throw new Error('Base das edge functions nao encontrada.')
  }

  const payload = {
    loginName,
  }

  await httpRequest('POST', `${base}/auth-recover`, {
    body: payload,
    headers: buildFunctionsHeaders(),
    skipSessionGuard: true,
  })
  return true
}

export async function sendPasswordRecovery(email, redirectTo) {
  assertSupabase()
  const identifier = (email || '').trim()
  if (!identifier) {
    throw new Error('Informe o email utilizado no login para recuperar a senha.')
  }

  const options = redirectTo ? { redirectTo } : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(identifier, options)
  if (error) {
    throw new Error(error.message)
  }
  return true
}

export async function updatePassword(newPassword) {
  assertSupabase()
  await validatePasswordOrThrow(newPassword)
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { password_changed_at: new Date().toISOString() },
  })
  if (error) {
    throw new Error(error.message)
  }
  return true
}

// Restaura a sessao a partir da URL ou tokens para permitir redefinir senha
export async function restoreResetSession() {
  assertSupabase()

  const sessionResult = await supabase.auth.getSession()
  if (sessionResult?.data?.session) {
    return sessionResult.data.session
  }
  if (sessionResult?.error) {
    throw sessionResult.error
  }

  // Tenta usar helper oficial
  try {
    const { data: urlSessionData, error: urlSessionError } = await supabase.auth.getSessionFromUrl({
      storeSession: true,
    })
    if (!urlSessionError && urlSessionData?.session) {
      return urlSessionData.session
    }
  } catch (urlError) {
    logError({
      message: 'getSessionFromUrl falhou',
      page: 'auth_service',
      severity: 'warn',
      context: { errorMessage: urlError?.message },
      stack: urlError?.stack,
    }).catch(() => {})
  }

  const currentUrl = new URL(window.location.href)
  const hashParams = new URLSearchParams(currentUrl.hash?.replace(/^#/, '') ?? '')
  const searchParams = currentUrl.searchParams

  const code = searchParams.get('code') || hashParams.get('code')
  if (code) {
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      throw exchangeError
    }
    if (exchangeData?.session) {
      return exchangeData.session
    }
  }

  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data: sessionData, error: sessionFromTokensError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionFromTokensError) {
      throw sessionFromTokensError
    }
    if (sessionData?.session) {
      return sessionData.session
    }
  }

  throw new Error('Link de redefinicao invalido ou expirado. Solicite um novo email.')
}

// Compat para require() em ambientes CJS
if (typeof module !== 'undefined') {
  module.exports = {
    loginWithLoginName,
    requestPasswordRecoveryByLoginName,
    sendPasswordRecovery,
    updatePassword,
    restoreResetSession,
  }
}
