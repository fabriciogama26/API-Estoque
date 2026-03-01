import { requireAuth } from '../auth.js'
import { CONSUME_LOCAL_DATA } from '../environment.js'

const reauthRequiredMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const reauthExemptPaths = new Set([
  '/api/session/touch',
  '/api/session/reauth',
  '/api/session/revoke',
  '/api/health',
  '/api/auth/reauth',
  '/api/auth/password/change',
])
const publicPaths = new Set(['/api/auth/login', '/api/auth/recover', '/api/auth/reset'])

const resolveAuthHeader = (req) =>
  req?.headers?.authorization ||
  req?.headers?.Authorization ||
  req?.headers?.get?.('authorization') ||
  req?.headers?.get?.('Authorization') ||
  ''

const resolveCronHeader = (req) =>
  req?.headers?.['x-cron-secret'] ||
  req?.headers?.['X-Cron-Secret'] ||
  req?.headers?.get?.('x-cron-secret') ||
  req?.headers?.get?.('X-Cron-Secret') ||
  ''

export async function auth(ctx) {
  const { req, res } = ctx.raw || {}
  if (!req || !res) return undefined

  const method = (req.method || '').toUpperCase()
  const path = (req.url || '').split('?')[0]
  const isPublicPath = publicPaths.has(path)

  req.requiresReauth = reauthRequiredMethods.has(method) && !reauthExemptPaths.has(path)

  let user = null
  const cronSecret = process.env.CRON_SECRET || ''
  const cronHeader = resolveCronHeader(req)
  const authHeader = resolveAuthHeader(req)
  const bearerMatch = typeof authHeader === 'string' ? authHeader.match(/Bearer\s+(.+)/i) : null
  const bearerToken = bearerMatch?.[1]?.trim() || ''
  const isCron = cronSecret && ((cronHeader || '').trim() === cronSecret || bearerToken === cronSecret)

  if (isPublicPath) {
    req.user = null
    ctx.user = null
    return undefined
  }

  if (CONSUME_LOCAL_DATA) {
    user = {
      id: 'local-user',
      user_metadata: {
        nome: 'Modo Local',
      },
    }
  } else if (isCron) {
    user = {
      id: 'cron-job',
      user_metadata: {
        nome: 'Cron',
      },
      isCron: true,
    }
    req.isCron = true
    ctx.isCron = true
  } else {
    user = await requireAuth(req, res)
    if (!user) {
      return { done: true }
    }
  }

  req.user = user
  ctx.user = user
  return undefined
}
