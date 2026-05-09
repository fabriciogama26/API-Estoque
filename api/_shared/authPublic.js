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

async function resolveAuthIdentity(loginName) {
  const { data: ownerRow, error: ownerError } = await supabaseAdmin
    .from('app_users')
    .select('id, email, ativo')
    .eq('login_name', loginName)
    .maybeSingle()

  if (ownerError) {
    throw createHttpError(500, 'Falha ao consultar login.', { code: 'UPSTREAM_ERROR' })
  }

  if (ownerRow) {
    return {
      email: String(ownerRow.email ?? '').trim(),
      active: ownerRow.ativo !== false,
      ownerActive: ownerRow.ativo !== false,
    }
  }

  const { data: dependentRow, error: dependentError } = await supabaseAdmin
    .from('app_users_dependentes')
    .select('id, email, ativo, owner_app_user_id')
    .eq('username', loginName)
    .maybeSingle()

  if (dependentError) {
    throw createHttpError(500, 'Falha ao consultar login.', { code: 'UPSTREAM_ERROR' })
  }

  if (!dependentRow) {
    return null
  }

  const { data: dependentOwner, error: dependentOwnerError } = await supabaseAdmin
    .from('app_users')
    .select('id, ativo')
    .eq('id', dependentRow.owner_app_user_id)
    .maybeSingle()

  if (dependentOwnerError) {
    throw createHttpError(500, 'Falha ao consultar login.', { code: 'UPSTREAM_ERROR' })
  }

  return {
    email: String(dependentRow.email ?? '').trim(),
    active: dependentRow.ativo !== false,
    ownerActive: Boolean(dependentOwner) && dependentOwner.ativo !== false,
  }
}

export async function loginWithLoginName(payload = {}) {
  const loginName = normalizeLoginName(payload.loginName ?? payload.login_name ?? payload.username)
  const password = payload.password ?? ''

  if (!loginName || !password) {
    throw createHttpError(400, 'Informe login e senha.', { code: 'VALIDATION_ERROR' })
  }

  const authIdentity = await resolveAuthIdentity(loginName)

  if (!authIdentity?.email) {
    throw createHttpError(401, 'Login ou senha invalidos.', { code: 'AUTH_INVALID' })
  }

  if (authIdentity.active === false || authIdentity.ownerActive === false) {
    throw createHttpError(403, 'Usuario inativo. Procure um administrador.', { code: 'AUTH_INACTIVE' })
  }

  const { data, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: authIdentity.email,
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

  const authIdentity = await resolveAuthIdentity(loginName)

  const email = String(authIdentity?.email ?? '').trim()
  if (authIdentity && !email) {
    throw createHttpError(422, 'Login sem email cadastrado. Procure um administrador.', {
      code: 'MISSING_EMAIL',
    })
  }
  if (authIdentity && (authIdentity.active === false || authIdentity.ownerActive === false)) {
    throw createHttpError(403, 'Usuario inativo. Procure um administrador.', { code: 'AUTH_INACTIVE' })
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
