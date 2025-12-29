import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const ALLOWED_CONTEXT_KEYS = new Set(['route', 'feature', 'action', 'code', 'severity'])
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

async function insertError(payload) {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  const base = payload || {}
  const fingerprint =
    base.fingerprint ||
    `${base.page || 'unknown'}|${scrubString(base.message || '').slice(0, 200)}|${base.severity || 'error'}`

  const record = {
    environment: 'app',
    page: base.page || '',
    user_id: base.userId || null,
    message: scrubString(base.message || 'Erro desconhecido'),
    stack: base.stack ? scrubString(base.stack) : null,
    context: sanitizeContext(base.context),
    severity: base.severity || 'error',
    fingerprint,
  }

  const { error } = await supabase.from('app_errors').insert(record)
  if (error) {
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
