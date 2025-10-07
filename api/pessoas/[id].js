import { withAuth } from '../../_shared/withAuth.js'
import { handleError, methodNotAllowed, readJson, sendJson } from '../../_shared/http.js'
import { PessoasOperations } from '../../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  const { id } = req.query || {}

  if (!id) {
    sendJson(res, 400, { error: 'ID da pessoa não informado.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const pessoa = await PessoasOperations.get(id)
      if (!pessoa) {
        sendJson(res, 404, { error: 'Pessoa não encontrada.' })
        return
      }
      sendJson(res, 200, pessoa)
      return
    }

    if (req.method === 'PUT') {
      const body = await readJson(req)
      const pessoa = await PessoasOperations.update(id, body, user)
      sendJson(res, 200, pessoa)
      return
    }

    methodNotAllowed(res, ['GET', 'PUT'])
  } catch (error) {
    handleError(res, error)
  }
})
