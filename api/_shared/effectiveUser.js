import { supabaseAdmin } from './supabaseClient.js'
import { createHttpError } from './http.js'

const APP_USER_SELECT = 'id, display_name, username, email, credential, page_permissions, ativo'

const normalizePermissions = (value) => (Array.isArray(value) ? value : [])

async function loadCredentialCatalog() {
  const { data, error } = await supabaseAdmin
    .from('app_credentials_catalog')
    .select('id, id_text')
  if (error) {
    throw createHttpError(500, 'Falha ao carregar catalogo de credenciais.', {
      code: 'UPSTREAM_ERROR',
    })
  }
  const byId = new Map()
  const byText = new Map()
  ;(data || []).forEach((item) => {
    if (item?.id) {
      byId.set(item.id, (item.id_text || '').trim().toLowerCase())
    }
    if (item?.id_text) {
      byText.set((item.id_text || '').trim().toLowerCase(), item.id)
    }
  })
  return { byId, byText }
}

async function credentialUuidToText(uuidValue, catalog) {
  const uuid = (uuidValue || '').toString()
  if (!uuid) {
    return null
  }
  return catalog.byId.get(uuid) || null
}

export async function resolveEffectiveUserForAuth(userId) {
  if (!userId) {
    throw createHttpError(400, 'Usuario invalido para resolver perfil.', { code: 'VALIDATION_ERROR' })
  }

  const catalog = await loadCredentialCatalog()

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('app_users')
    .select(APP_USER_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw createHttpError(500, 'Falha ao carregar perfil do usuario.', {
      code: 'UPSTREAM_ERROR',
    })
  }

  if (profile) {
    const credentialText = await credentialUuidToText(profile.credential, catalog)
    return {
      authUserId: userId,
      appUserId: profile.id,
      profile: { ...profile, credential_text: credentialText },
      dependentProfile: null,
      isDependent: false,
      credential: credentialText || 'admin',
      credentialId: profile.credential || null,
      pagePermissions: normalizePermissions(profile.page_permissions),
      active: profile.ativo !== false,
      ownerActive: profile.ativo !== false,
      dependentActive: null,
    }
  }

  const { data: dependent, error: dependentError } = await supabaseAdmin
    .from('app_users_dependentes')
    .select(
      `
        id,
        auth_user_id,
        owner_app_user_id,
        username,
        display_name,
        email,
        credential,
        page_permissions,
        ativo,
        owner:app_users!app_users_dependentes_owner_app_user_id_fkey (${APP_USER_SELECT})
      `
    )
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (dependentError) {
    throw createHttpError(500, 'Falha ao carregar perfil dependente.', {
      code: 'UPSTREAM_ERROR',
    })
  }

  if (dependent) {
    const owner = dependent.owner || null
    const ownerActive = owner ? owner.ativo !== false : true
    const dependentActive = dependent.ativo !== false
    const ownerCredentialText = await credentialUuidToText(owner?.credential, catalog)
    const dependentCredentialText = await credentialUuidToText(dependent.credential, catalog)
    const resolvedCredential = dependentCredentialText || ownerCredentialText || 'admin'
    const resolvedCredentialId = dependent.credential || owner?.credential || null
    const resolvedPagePermissions =
      Array.isArray(dependent.page_permissions) && dependent.page_permissions.length
        ? dependent.page_permissions
        : normalizePermissions(owner?.page_permissions)

    return {
      authUserId: userId,
      appUserId: owner?.id || dependent.owner_app_user_id || null,
      profile: owner ? { ...owner, credential_text: ownerCredentialText } : null,
      dependentProfile: {
        id: dependent.id,
        auth_user_id: dependent.auth_user_id,
        owner_app_user_id: dependent.owner_app_user_id,
        username: dependent.username,
        display_name: dependent.display_name,
        email: dependent.email,
        credential: dependent.credential,
        credential_text: dependentCredentialText,
        page_permissions: dependent.page_permissions,
        ativo: dependent.ativo,
      },
      isDependent: true,
      credential: resolvedCredential,
      credentialId: resolvedCredentialId,
      pagePermissions: resolvedPagePermissions,
      active: ownerActive && dependentActive,
      ownerActive,
      dependentActive,
    }
  }

  return {
    authUserId: userId,
    appUserId: null,
    profile: null,
    dependentProfile: null,
    isDependent: false,
    credential: null,
    credentialId: null,
    pagePermissions: [],
    active: true,
    ownerActive: null,
    dependentActive: null,
  }
}
