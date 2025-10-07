import { withAuth } from '../_shared/withAuth.js'
import { handleError, methodNotAllowed, parseQuery, sendJson } from '../_shared/http.js'
import { EstoqueOperations } from '../_shared/operations.js'

export default withAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const query = parseQuery(req)
      const estoque = await EstoqueOperations.current(query)
      sendJson(res, 200, estoque)
      return
    }

    methodNotAllowed(res, ['GET'])
  } catch (error) {
    handleError(res, error)
  }
})
