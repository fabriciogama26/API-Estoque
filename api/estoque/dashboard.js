import { withAuth } from '../../_shared/withAuth.js'
import { handleError, methodNotAllowed, parseQuery, sendJson } from '../../_shared/http.js'
import { EstoqueOperations } from '../../_shared/operations.js'

export default withAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const query = parseQuery(req)
      const dashboard = await EstoqueOperations.dashboard(query)
      sendJson(res, 200, dashboard)
      return
    }

    methodNotAllowed(res, ['GET'])
  } catch (error) {
    handleError(res, error)
  }
})
