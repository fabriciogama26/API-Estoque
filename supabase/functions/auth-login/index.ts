// Edge Function: auth-login
// Resolve login_name -> email e autentica via Supabase Auth.
// Requer variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

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
  const password = body.password ?? ''

  if (!loginName || password === '') {
    return respond(400, { error: { message: 'Informe login e senha.', code: 'VALIDATION_ERROR' } })
  }

  const { data: userRow, error } = await supabase
    .from('app_users')
    .select('id, email, ativo')
    .eq('login_name', loginName)
    .maybeSingle()

  if (error) {
    return respond(500, { error: { message: 'Falha ao consultar login.', code: 'UPSTREAM_ERROR' } })
  }

  if (!userRow?.email) {
    return respond(401, { error: { message: 'Login ou senha invalidos.', code: 'AUTH_INVALID' } })
  }

  if (userRow.ativo === false) {
    return respond(403, {
      error: { message: 'Usuario inativo. Procure um administrador.', code: 'AUTH_INACTIVE' },
    })
  }

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: userRow.email,
    password,
  })

  if (signInError || !data?.session?.access_token || !data?.session?.refresh_token) {
    return respond(401, { error: { message: 'Login ou senha invalidos.', code: 'AUTH_INVALID' } })
  }

  const session = data.session
  return respond(200, {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
    },
  })
})
