import { supabaseAdmin } from './supabaseClient.js'

const SERVICE_NAME = process.env.SERVICE_NAME || 'api'
const ENVIRONMENT =
  process.env.APP_ENV ||
  process.env.RUNTIME_ENV ||
  process.env.NODE_ENV ||
  'api'

function buildFingerprint(payload) {
  const parts = [
    payload.method || 'UNKNOWN',
    payload.path || 'unknown',
    payload.status || 'NA',
    payload.code || '',
    (payload.message || '').slice(0, 120),
  ]
  return parts.join('|').slice(0, 200)
}

export async function logApiError(payload = {}) {
  const record = {
    environment: ENVIRONMENT || 'api',
    service: payload.service || SERVICE_NAME,
    method: payload.method || null,
    path: payload.path || null,
    status: payload.status || null,
    code: payload.code || null,
    user_id: payload.userId || null,
    message: payload.message || 'Erro desconhecido',
    stack: payload.stack || null,
    context: payload.context || null,
    severity: payload.severity || 'error',
    fingerprint: payload.fingerprint || buildFingerprint(payload),
  }

  const { error } = await supabaseAdmin.from('api_errors').insert(record)
  if (error) {
    console.warn('[API_LOGGER] Falha ao registrar erro no Supabase.', {
      code: error?.code,
      message: error?.message,
    })
  }
}
