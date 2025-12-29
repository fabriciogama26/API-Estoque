// Edge Function: request-password-reset
// Valida admin/master + owner scope e dispara reset via Admin API.
// Requer variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PASSWORD_REDIRECT (opcional, whitelisted).

import { serve } from 'https://deno.land/std@0.177.1/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const redirectTo = (Deno.env.get('SUPABASE_PASSWORD_REDIRECT') ?? '').trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer', '').trim()
  if (!token) {
    return new Response('Missing auth token', { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const targetUserId = body?.target_user_id
  if (!targetUserId) {
    return new Response('target_user_id required', { status: 400 })
  }

  // Resolve usuario autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return new Response('Invalid user', { status: 401 })
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
    return new Response('Permission denied', { status: 403 })
  }

  const actorOwner = dep?.owner_app_user_id ?? actor?.parent_user_id ?? actor?.id ?? null
  if (!actorOwner) {
    return new Response('Permission denied', { status: 403 })
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
    return new Response('Permission denied', { status: 403 })
  }

  // Resolve target dentro do mesmo owner scope (app_users).
  const { data: target, error: targetError } = await supabase
    .from('app_users')
    .select('id, email, parent_user_id')
    .eq('id', targetUserId)
    .single()
  if (targetError || !target) {
    return new Response('Permission denied', { status: 403 })
  }

  const targetOwner = target.parent_user_id ?? target.id
  if (!isMaster && targetOwner !== actorOwner) {
    return new Response('Permission denied', { status: 403 })
  }

  const email = (target.email || '').trim()
  if (!email) {
    return new Response('Permission denied', { status: 403 })
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
    return new Response('Reset failed', { status: 500 })
  }

  return new Response(null, { status: 204 })
})
