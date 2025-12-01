import { supabase } from './supabaseClient.js'

const TABLE = 'app_errors'

const trimText = (value) => (typeof value === 'string' ? value.trim() : '')

const buildFingerprint = (message, page, stack) => {
  const base = `${trimText(page)}|${trimText(message)}|${trimText(stack).slice(0, 180)}`
  // Hash simples para evitar dependências
  let hash = 0
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i)
    hash |= 0
  }
  return `fp_${Math.abs(hash)}`
}

export async function logError({
  message,
  stack = '',
  page = '',
  context = null,
  severity = 'error',
  userId = null,
  environment = 'app',
}) {
  if (!supabase) {
    console.warn('Supabase client indisponivel para log de erros.')
    return null
  }

  const payload = {
    message: trimText(message) || 'Erro desconhecido',
    stack: trimText(stack),
    page: trimText(page),
    severity: trimText(severity) || 'error',
    user_id: userId ? String(userId) : null,
    environment: trimText(environment) || 'app',
    fingerprint: buildFingerprint(message, page, stack),
    context,
  }

  const { error, data } = await supabase.from(TABLE).upsert(
    {
      ...payload,
      created_at: new Date().toISOString(),
      // dedupe por fingerprint + page
    },
    { onConflict: 'fingerprint' },
  )

  if (error) {
    console.warn('Falha ao registrar erro no Supabase:', error.message)
    return null
  }

  return data ?? null
}
