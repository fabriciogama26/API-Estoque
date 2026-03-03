import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const APP_USER_SELECT = 'id, display_name, username, email, credential, page_permissions, ativo'
let effectiveUserCache = null
let credentialCatalogCache = null

export function invalidateEffectiveAppUserCache() {
  effectiveUserCache = null
}

export function invalidateCredentialCatalogCache() {
  credentialCatalogCache = null
}

function normalizePagePermissions(value) {
  return Array.isArray(value) ? value : []
}

async function loadCredentialCatalog() {
  if (!isSupabaseConfigured() || !supabase) {
    return { byId: new Map(), byText: new Map() }
  }
  if (credentialCatalogCache) {
    return credentialCatalogCache
  }
  const { data, error } = await supabase.from('app_credentials_catalog').select('id, id_text')
  if (error) {
    throw error
  }
  const byId = new Map()
  const byText = new Map()
  ;(data || []).forEach((item) => {
    if (item.id) {
      byId.set(item.id, (item.id_text || '').trim().toLowerCase())
    }
    if (item.id_text) {
      byText.set((item.id_text || '').trim().toLowerCase(), item.id)
    }
  })
  credentialCatalogCache = { byId, byText }
  return credentialCatalogCache
}

async function credentialUuidToText(uuidValue) {
  const uuid = (uuidValue || '').toString()
  if (!uuid) {
    return null
  }
  const catalog = await loadCredentialCatalog()
  return catalog.byId.get(uuid) || null
}

async function credentialTextToUuid(textValue) {
  const text = (textValue || '').toString().trim().toLowerCase()
  if (!text) {
    return null
  }
  const catalog = await loadCredentialCatalog()
  return catalog.byText.get(text) || null
}

export async function resolveEffectiveAppUser(userId, { forceRefresh = false } = {}) {
  if (!userId || !isSupabaseConfigured() || !supabase) {
    if (forceRefresh) {
      effectiveUserCache = null
    }
    return null
  }

  if (!forceRefresh && effectiveUserCache?.authUserId === userId) {
    return effectiveUserCache
  }

  const { data: profile, error: profileError } = await supabase
    .from('app_users')
    .select(APP_USER_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError
  }

  if (profile) {
    const credentialText = await credentialUuidToText(profile.credential)
    const resolved = {
      authUserId: userId,
      appUserId: profile.id,
      profile: { ...profile, credential_text: credentialText },
      dependentProfile: null,
      isDependent: false,
      credential: credentialText || 'admin',
      credentialId: profile.credential || null,
      pagePermissions: normalizePagePermissions(profile.page_permissions),
      active: profile.ativo !== false,
      ownerActive: profile.ativo !== false,
      dependentActive: null,
    }
    effectiveUserCache = resolved
    return resolved
  }

  const { data: dependent, error: dependentError } = await supabase
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

  if (dependentError && dependentError.code !== 'PGRST116') {
    throw dependentError
  }

  if (dependent) {
    const owner = dependent.owner || null
    const ownerActive = owner ? owner.ativo !== false : true
    const dependentActive = dependent.ativo !== false
    const ownerCredentialText = await credentialUuidToText(owner?.credential)
    const dependentCredentialText = await credentialUuidToText(dependent.credential)
    const resolvedCredential = dependentCredentialText || ownerCredentialText || 'admin'
    const resolvedCredentialId = dependent.credential || owner?.credential || null
    const resolvedPagePermissions = Array.isArray(dependent.page_permissions) && dependent.page_permissions.length
      ? dependent.page_permissions
      : normalizePagePermissions(owner?.page_permissions)
    const resolved = {
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
    effectiveUserCache = resolved
    return resolved
  }

  const fallback = {
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
  effectiveUserCache = fallback
  return fallback
}

export async function mapCredentialUuidToText(uuidValue) {
  return credentialUuidToText(uuidValue)
}

export async function mapCredentialTextToUuid(textValue) {
  return credentialTextToUuid(textValue)
}
