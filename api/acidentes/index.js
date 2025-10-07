import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../_shared/http.js'
import { AcidentesOperations } from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  try {
    if (req.method === 'GET') {
      const acidentes = await AcidentesOperations.list()
      sendJson(res, 200, acidentes)
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const acidente = await AcidentesOperations.create(body, user)
      sendJson(res, 201, acidente)
      return
    }

    methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    handleError(res, error)
  }
})
