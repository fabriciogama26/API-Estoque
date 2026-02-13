import { requireAuth } from './auth.js'
import { handleError } from './http.js'
import { CONSUME_LOCAL_DATA } from './environment.js'

export function withAuth(handler) {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        const origin = req.headers?.origin || '*'
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type, X-Cron-Secret, X-User-Interaction, X-Session-Id'
        )
        res.setHeader('Vary', 'Origin')
        res.statusCode = 204
        res.end()
        return
      }

      const origin = req.headers?.origin || '*'
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')

      const method = (req.method || '').toUpperCase()
      const path = (req.url || '').split('?')[0]
      const reauthRequiredMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
      const reauthExemptPaths = new Set([
        '/api/session/touch',
        '/api/session/reauth',
        '/api/session/revoke',
        '/api/health',
      ])
      req.requiresReauth = reauthRequiredMethods.has(method) && !reauthExemptPaths.has(path)

      let user = null
      const cronSecret = process.env.CRON_SECRET || ''
      const cronHeader =
        req.headers?.['x-cron-secret'] ||
        req.headers?.['X-Cron-Secret'] ||
        req.headers?.get?.('x-cron-secret') ||
        req.headers?.get?.('X-Cron-Secret')
      const authHeader =
        req.headers?.authorization ||
        req.headers?.Authorization ||
        req.headers?.get?.('authorization') ||
        req.headers?.get?.('Authorization')
      const bearerMatch = typeof authHeader === 'string' ? authHeader.match(/Bearer\s+(.+)/i) : null
      const bearerToken = bearerMatch?.[1]?.trim() || ''
      const isCron = cronSecret && ((cronHeader || '').trim() === cronSecret || bearerToken === cronSecret)

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
      } else {
        user = await requireAuth(req, res)
        if (!user) {
          return
        }
      }

      req.user = user
      await handler(req, res, user)
    } catch (error) {
      handleError(res, error, 'Erro interno do servidor.', req)
    }
  }
}
