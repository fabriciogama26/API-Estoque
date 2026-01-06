// Edge Function: request-password-reset
// Valida admin/master + owner scope e dispara reset via Admin API.
// Requer variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PASSWORD_REDIRECT (opcional, whitelisted).

import { serve } from 'https://deno.land/std@0.177.1/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'text/plain',
}

const respond = (status: number, message: string) =>
  new Response(message, { status, headers: corsHeaders })

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const redirectTo = (Deno.env.get('SUPABASE_PASSWORD_REDIRECT') ?? '').trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond(405, 'method_not_allowed')
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer', '').trim()
  if (!token) {
    return respond(401, 'missing_auth_token')
  }

  const body = await req.json().catch(() => null)
  const targetUserId = body?.target_user_id
  if (!targetUserId) {
    return respond(400, 'target_user_id_required')
  }

  // Resolve usuario autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return respond(401, 'invalid_user_token')
  }
  const actorId = userData.user.id

  // Resolve owner do ator (dependente ou principal).
  const { data: dep } = await supabase
    .from('app_users_dependentes')
    .select('owner_app_user_id')
    .eq('auth_user_id', actorId)
    .maybeSingle()

  const { data: actor, error: actorError } = await supabase
    .from('app_users')
    .select('id, parent_user_id')
    .eq('id', actorId)
    .maybeSingle()

  if (actorError || (!actor && !dep)) {
    return respond(403, 'actor_not_found')
  }

  const actorOwner = dep?.owner_app_user_id ?? actor?.parent_user_id ?? actor?.id ?? null
  if (!actorOwner) {
    return respond(403, 'actor_owner_missing')
  }

  // Checa role admin/master no escopo do owner.
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_roles.user_id', actorId)
    .eq('user_roles.scope_parent_user_id', actorOwner)
    .maybeSingle()

  const roleName = roleData?.roles?.name?.toLowerCase?.() || ''
  const isAdmin = roleName === 'admin' || roleName === 'master'
  const isMaster = roleName === 'master'
  if (roleError || !isAdmin) {
    return respond(403, 'actor_not_admin_or_master')
  }

  // Resolve target dentro do mesmo owner scope (app_users).
  const { data: target, error: targetError } = await supabase
    .from('app_users')
    .select('id, email, parent_user_id')
    .eq('id', targetUserId)
    .single()
  if (targetError || !target) {
    return respond(403, 'target_not_found')
  }

  const targetOwner = target.parent_user_id ?? target.id
  if (!isMaster && targetOwner !== actorOwner) {
    return respond(403, 'target_outside_scope')
  }

  const email = (target.email || '').trim()
  if (!email) {
    return respond(403, 'target_missing_email')
  }

  // Opcional: valida redirect simples para evitar open redirect.
  const options = redirectTo && redirectTo.startsWith('https://') ? { redirectTo } : undefined
  const { error: resetError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options,
  })
  if (resetError) {
    console.error('generateLink error', resetError)
    return respond(500, 'reset_failed')
  }

  return new Response(null, { status: 204, headers: corsHeaders })
})
