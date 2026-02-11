import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const ALLOWED_CONTEXT_KEYS = new Set([
  'route',
  'feature',
  'action',
  'code',
  'severity',
  'source',
  'status',
  'stage',
  'function',
  'bucket',
  'path',
  'response',
  'requestId',
])
const MAX_FIELD_LENGTH = 500

const scrubString = (value) => {
  if (typeof value !== 'string') {
    value = value != null ? String(value) : ''
  }
  // Remove e-mails
  let sanitized = value.replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[redacted-email]')
  // Remove possiveis tokens/IDs longos
  sanitized = sanitized.replace(/[A-Za-z0-9._-]{24,}/g, '[redacted-token]')
  if (sanitized.length > MAX_FIELD_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_FIELD_LENGTH)}...`
  }
  return sanitized
}

const sanitizeContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') {
    return null
  }
  const result = {}
  Object.entries(ctx).forEach(([key, value]) => {
    if (ALLOWED_CONTEXT_KEYS.has(key)) {
      result[key] = scrubString(value)
    }
  })
  return Object.keys(result).length ? result : null
}

const resolveSessionUserId = async () => {
  if (!supabase) {
    return null
  }
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user?.id || null
  } catch (_) {
    return null
  }
}

async function insertError(payload) {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  const base = payload || {}
  const userId = base.userId || (await resolveSessionUserId())
  const context = sanitizeContext({
    source: base.context?.source || 'front',
    ...(base.context || {}),
  })
  const fingerprint =
    base.fingerprint ||
    [
      base.page || 'unknown',
      scrubString(base.message || '').slice(0, 200),
      base.severity || 'error',
      context?.action ? `action=${scrubString(context.action)}` : '',
      context?.path ? `path=${scrubString(context.path)}` : '',
      context?.requestId ? `req=${scrubString(context.requestId)}` : '',
    ]
      .filter(Boolean)
      .join('|')
      .slice(0, 200)

  const record = {
    environment: 'app',
    page: base.page || '',
    user_id: userId || null,
    message: scrubString(base.message || 'Erro desconhecido'),
    stack: base.stack ? scrubString(base.stack) : null,
    context,
    severity: base.severity || 'error',
    fingerprint,
  }

  const { error } = await supabase
    .from('app_errors')
    .upsert(record, { onConflict: 'fingerprint', ignoreDuplicates: true })
  if (error) {
    if (userId && (error.code === '23503' || error.message?.includes('app_errors_user_id_fkey'))) {
      const { error: retryError } = await supabase
        .from('app_errors')
        .upsert({ ...record, user_id: null }, { onConflict: 'fingerprint', ignoreDuplicates: true })
      if (!retryError || retryError.code === '23505') {
        return
      }
      console.warn('Falha ao registrar erro', retryError)
      return
    }
    if (error.code === '23505') {
      return
    }
    // Nao propaga falha de log para nao quebrar UX
    console.warn('Falha ao registrar erro', error)
  }
}

export async function logError(payload) {
  try {
    await insertError(payload)
  } catch (err) {
    console.warn('Erro ao registrar log de erro', err)
  }
}
