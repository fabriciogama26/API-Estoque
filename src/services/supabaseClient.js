import { createClient } from '@supabase/supabase-js'

const env = (name) => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name]
  }
  return import.meta.env[name]
}

const resolveProxyBase = () => {
  const proxyEnv = env('VITE_SUPABASE_PROXY_URL')
  if (proxyEnv) {
    return String(proxyEnv).trim().replace(/\/+$/, '')
  }
  const apiBase = env('VITE_API_URL')
  if (apiBase) {
    return `${String(apiBase).trim().replace(/\/+$/, '')}/api/supabase`
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, '')}/api/supabase`
  }
  return ''
}

const supabaseUrl = resolveProxyBase() || env('VITE_SUPABASE_URL')
const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY')

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabase)
}

// Exponibiliza o client no navegador para facilitar debug de sessao (ex.: supabase.auth.getSession())
if (typeof window !== 'undefined' && supabase && import.meta.env.DEV) {
  window.supabase = supabase
}
