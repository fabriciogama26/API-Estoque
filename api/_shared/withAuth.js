import { requireAuth } from './auth.js'
import { handleError } from './http.js'
import { CONSUME_LOCAL_DATA } from './environment.js'

export function withAuth(handler) {
  return async (req, res) => {
    try {
      let user = null

      if (CONSUME_LOCAL_DATA) {
        user = {
          id: 'local-user',
          user_metadata: {
            nome: 'Modo Local',
          },
        }
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
