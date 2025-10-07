import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../_shared/http.js'
import { MateriaisOperations } from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  try {
    if (req.method === 'GET') {
      const materiais = await MateriaisOperations.list()
      sendJson(res, 200, materiais)
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const material = await MateriaisOperations.create(body, user)
      sendJson(res, 201, material)
      return
    }

    methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    handleError(res, error)
  }
})
