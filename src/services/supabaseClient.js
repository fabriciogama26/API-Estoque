import { createClient } from '@supabase/supabase-js'

const env = (name) => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name]
  }
  return import.meta.env[name]
}

const supabaseUrl = env('VITE_SUPABASE_URL')
const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY')

const resolveAuthStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const authStorage = resolveAuthStorage()

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        // Mantem a sessao para que links de recuperacao de senha funcionem apos o redirect
        persistSession: Boolean(authStorage),
        detectSessionInUrl: true,
        storage: authStorage || undefined,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabase)
}

// Exponibiliza o client no navegador para facilitar debug de sessao (ex.: supabase.auth.getSession())
if (typeof window !== 'undefined' && supabase) {
  window.supabase = supabase
}
