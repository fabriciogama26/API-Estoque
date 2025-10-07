import { withAuth } from '../../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../../_shared/http.js'
import { MateriaisOperations } from '../../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  const { id } = req.query || {}

  if (!id) {
    sendJson(res, 400, { error: 'ID do material não informado.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const material = await MateriaisOperations.get(id)
      if (!material) {
        sendJson(res, 404, { error: 'Material não encontrado.' })
        return
      }
      sendJson(res, 200, material)
      return
    }

    if (req.method === 'PUT') {
      const body = await readJson(req)
      const material = await MateriaisOperations.update(id, body, user)
      sendJson(res, 200, material)
      return
    }

    methodNotAllowed(res, ['GET', 'PUT'])
  } catch (error) {
    handleError(res, error)
  }
})
