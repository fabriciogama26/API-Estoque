// import { createClient } from '@supabase/supabase-js'

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// export const supabase = supabaseUrl && supabaseAnonKey
//   ? createClient(supabaseUrl, supabaseAnonKey, {
//       auth: {
//         autoRefreshToken: true,
//         persistSession: true,
//         detectSessionInUrl: true,
//       },
//     })
//   : null

// export function isSupabaseConfigured() {
//   return Boolean(supabase)
// }


// Supabase desativado por enquanto

// Mantemos a assinatura dos exports pra não quebrar os imports em AuthContext.jsx
export const supabase = null

export function isSupabaseConfigured() {
  return false
}