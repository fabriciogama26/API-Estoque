import { supabase, isSupabaseConfigured } from './supabaseClient.js'

async function insertError(payload) {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  const base = payload || {}
  const fingerprint =
    base.fingerprint ||
    `${base.page || 'unknown'}|${(base.message || '').slice(0, 200)}|${base.severity || 'error'}`

  const record = {
    environment: 'app',
    page: base.page || '',
    user_id: base.userId || null,
    message: base.message || 'Erro desconhecido',
    stack: base.stack || null,
    context: base.context || null,
    severity: base.severity || 'error',
    fingerprint,
  }

  const { error } = await supabase.from('app_errors').insert(record)
  if (error) {
    // Não propaga falha de log para não quebrar UX
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
