// Edge Function: auth-recover
// Resolve login_name -> email e dispara reset de senha.
// Requer variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PASSWORD_REDIRECT (opcional).

import { serve } from 'https://deno.land/std@0.177.1/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const respond = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders })

const normalizeLoginName = (value: unknown) =>
  String(value ?? '').trim().toLowerCase()

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const redirectTo = (Deno.env.get('SUPABASE_PASSWORD_REDIRECT') ?? '').trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond(405, { error: { message: 'method_not_allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const body = await req.json().catch(() => ({}))
  const loginName = normalizeLoginName(body.loginName ?? body.login_name ?? body.username)

  if (!loginName) {
    return respond(400, {
      error: { message: 'Informe seu login para recuperar a senha.', code: 'VALIDATION_ERROR' },
    })
  }

  const { data: userRow, error } = await supabase
    .from('app_users')
    .select('email')
    .eq('login_name', loginName)
    .maybeSingle()

  if (error) {
    return respond(500, { error: { message: 'Falha ao consultar login.', code: 'UPSTREAM_ERROR' } })
  }

  const email = String(userRow?.email ?? '').trim()
  if (userRow && !email) {
    return respond(422, {
      error: { message: 'Login sem email cadastrado. Procure um administrador.', code: 'MISSING_EMAIL' },
    })
  }

  if (!email) {
    return respond(200, { ok: true })
  }

  const options = redirectTo ? { redirectTo } : undefined
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, options)
  if (resetError) {
    return respond(500, {
      error: { message: 'Falha ao enviar email de recuperacao.', code: 'UPSTREAM_ERROR' },
    })
  }

  return respond(200, { ok: true })
})
