import { requireAuth } from './auth.js'
import { handleError } from './http.js'

export function withAuth(handler) {
  return async (req, res) => {
    try {
      const user = await requireAuth(req, res)
      if (!user) {
        return
      }
      await handler(req, res, user)
    } catch (error) {
      handleError(res, error)
    }
  }
}
