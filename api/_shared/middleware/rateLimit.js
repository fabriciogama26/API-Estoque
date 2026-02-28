import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../supabaseClient.js'
import { createHttpError, readJson, sendError } from '../http.js'

const AUTH_ROUTES = new Set(['auth.login', 'auth.recover'])
const CREATE_ROUTES = new Set([
  'create.pessoa',
  'create.material',
  'create.acidente',
  'create.entrada',
  'create.saida',
])

const hashValue = (value) =>
  createHash('sha256')
    .update(value)
    .digest('hex')

const normalizeLoginName = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim().toLowerCase()
}

const readBodyOnce = async (req) => {
  if (req.body) {
    return req.body
  }
  const body = await readJson(req)
  req.body = body
  return body
}

const handleRateLimitResult = (result, req, res) => {
  if (!result || result.allowed !== false) {
    return null
  }
  const retryAfter = result.retry_after ? String(result.retry_after) : null
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter)
  }
  sendError(res, 429, 'Limite de requisicoes excedido.', { code: 'RATE_LIMIT', req })
  return { done: true }
}

const callRateLimitRpc = async (payload) => {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_check_and_hit', payload)
  if (error) {
    const httpError = createHttpError(500, 'Falha ao validar limite de requisicoes.', {
      code: 'UPSTREAM_ERROR',
    })
    httpError.details = error.details || null
    httpError.context = { rpc: 'rate_limit_check_and_hit' }
    throw httpError
  }
  return Array.isArray(data) ? data[0] : data
}

export async function rateLimitAuth(ctx) {
  if (!AUTH_ROUTES.has(ctx.route)) {
    return undefined
  }

  const { req, res } = ctx.raw || {}
  if (!req || !res) return undefined

  const body = await readBodyOnce(req)
  const loginName = normalizeLoginName(body?.loginName ?? body?.login_name ?? body?.username)
  if (!loginName) {
    return undefined
  }

  const ip = ctx.ip || 'unknown'
  const identityHash = hashValue(`${ip}|${loginName}`)

  const result = await callRateLimitRpc({
    p_scope: 'auth',
    p_route: ctx.route,
    p_identity_hash: identityHash,
    p_owner_id: null,
    p_ip_hash: null,
  })

  return handleRateLimitResult(result, req, res)
}

export async function rateLimitApi(ctx) {
  if (!CREATE_ROUTES.has(ctx.route)) {
    return undefined
  }

  const { req, res } = ctx.raw || {}
  if (!req || !res) return undefined

  if (!ctx.tenantId) {
    return undefined
  }

  const ip = ctx.ip || 'unknown'
  const ipHash = hashValue(ip)

  const result = await callRateLimitRpc({
    p_scope: 'api',
    p_route: ctx.route,
    p_identity_hash: null,
    p_owner_id: ctx.tenantId,
    p_ip_hash: ipHash,
  })

  return handleRateLimitResult(result, req, res)
}
