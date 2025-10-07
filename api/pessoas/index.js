import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../_shared/http.js'
import { PessoasOperations } from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  try {
    if (req.method === 'GET') {
      const pessoas = await PessoasOperations.list()
      sendJson(res, 200, pessoas)
      return
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      const pessoa = await PessoasOperations.create(body, user)
      sendJson(res, 201, pessoa)
      return
    }

    methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    handleError(res, error)
  }
})
