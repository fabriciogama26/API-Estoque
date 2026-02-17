import { supabaseAdmin } from './supabaseClient.js'
import { createHttpError } from './http.js'

const normalizeLoginName = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim().toLowerCase()
}

const resolveRedirectTo = () => {
  const raw =
    process.env.SUPABASE_PASSWORD_REDIRECT ||
    process.env.VITE_SUPABASE_PASSWORD_REDIRECT ||
    ''
  const trimmed = String(raw || '').trim()
  return trimmed ? trimmed : null
}

export async function loginWithLoginName(payload = {}) {
  const loginName = normalizeLoginName(payload.loginName ?? payload.login_name ?? payload.username)
  const password = payload.password ?? ''

  if (!loginName || !password) {
    throw createHttpError(400, 'Informe login e senha.', { code: 'VALIDATION_ERROR' })
  }

  const { data: userRow, error } = await supabaseAdmin
    .from('app_users')
    .select('id, email, ativo')
    .eq('login_name', loginName)
    .maybeSingle()

  if (error) {
    throw createHttpError(500, 'Falha ao consultar login.', { code: 'UPSTREAM_ERROR' })
  }

  if (!userRow?.email) {
    throw createHttpError(401, 'Login ou senha invalidos.', { code: 'AUTH_INVALID' })
  }

  if (userRow.ativo === false) {
    throw createHttpError(403, 'Usuario inativo. Procure um administrador.', { code: 'AUTH_INACTIVE' })
  }

  const { data, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: userRow.email,
    password,
  })

  if (signInError || !data?.session?.access_token || !data?.session?.refresh_token) {
    throw createHttpError(401, 'Login ou senha invalidos.', { code: 'AUTH_INVALID' })
  }

  const session = data.session

  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
    },
  }
}

export async function recoverWithLoginName(payload = {}) {
  const loginName = normalizeLoginName(payload.loginName ?? payload.login_name ?? payload.username)

  if (!loginName) {
    throw createHttpError(400, 'Informe seu login para recuperar a senha.', { code: 'VALIDATION_ERROR' })
  }

  const { data: userRow, error } = await supabaseAdmin
    .from('app_users')
    .select('email')
    .eq('login_name', loginName)
    .maybeSingle()

  if (error) {
    throw createHttpError(500, 'Falha ao consultar login.', { code: 'UPSTREAM_ERROR' })
  }

  const email = String(userRow?.email ?? '').trim()
  if (userRow && !email) {
    throw createHttpError(422, 'Login sem email cadastrado. Procure um administrador.', {
      code: 'MISSING_EMAIL',
    })
  }
  if (!email) {
    return { ok: true }
  }

  const redirectTo = resolveRedirectTo()
  const options = redirectTo ? { redirectTo } : undefined

  const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, options)
  if (resetError) {
    throw createHttpError(500, 'Falha ao enviar email de recuperacao.', { code: 'UPSTREAM_ERROR' })
  }

  return { ok: true }
}
