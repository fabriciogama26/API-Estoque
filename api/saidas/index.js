import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../_shared/http.js'
import { SaidasOperations } from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  try {
    if (req.method === 'GET') {
      const saidas = await SaidasOperations.list()
      sendJson(res, 200, saidas)
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const saida = await SaidasOperations.create(body, user)
      sendJson(res, 201, saida)
      return
    }

    methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    handleError(res, error)
  }
})
