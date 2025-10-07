import { withAuth } from '../../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../../_shared/http.js'
import { AcidentesOperations } from '../../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  const { id } = req.query || {}

  if (!id) {
    sendJson(res, 400, { error: 'ID do acidente não informado.' })
    return
  }

  try {
    if (req.method === 'PUT') {
      const body = await readJson(req)
      const acidente = await AcidentesOperations.update(id, body, user)
      sendJson(res, 200, acidente)
      return
    }

    methodNotAllowed(res, ['PUT'])
  } catch (error) {
    handleError(res, error)
  }
})
