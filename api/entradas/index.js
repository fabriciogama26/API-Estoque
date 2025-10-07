import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../_shared/http.js'
import { EntradasOperations } from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  try {
    if (req.method === 'GET') {
      const entradas = await EntradasOperations.list()
      sendJson(res, 200, entradas)
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const entrada = await EntradasOperations.create(body, user)
      sendJson(res, 201, entrada)
      return
    }

    methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    handleError(res, error)
  }
})
