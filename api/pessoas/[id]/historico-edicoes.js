import { withAuth } from '../../../_shared/withAuth.js'
import { handleError, methodNotAllowed, sendJson } from '../../../_shared/http.js'
import { PessoasOperations } from '../../../_shared/operations.js'

export default withAuth(async (req, res) => {
  const { id } = req.query || {}

  if (!id) {
    sendJson(res, 400, { error: 'ID da pessoa não informado.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const historico = await PessoasOperations.history(id)
      sendJson(res, 200, historico)
      return
    }

    methodNotAllowed(res, ['GET'])
  } catch (error) {
    handleError(res, error)
  }
})
