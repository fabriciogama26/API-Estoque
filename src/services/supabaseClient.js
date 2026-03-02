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
  return ''
}

const supabaseUrl = resolveProxyBase() || env('VITE_SUPABASE_URL')
const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY')

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabase)
}

export async function getSupabaseAccessToken() {
  if (!supabase?.auth?.getSession) {
    return null
  }
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      return null
    }
    return data?.session?.access_token || null
  } catch {
    return null
  }
}

export async function buildSupabaseAuthHeaders() {
  const token = await getSupabaseAccessToken()
  if (!token) {
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

// Exponibiliza o client no navegador para facilitar debug de sessao (ex.: supabase.auth.getSession())
if (typeof window !== 'undefined' && supabase && import.meta.env.DEV) {
  window.supabase = supabase
}
