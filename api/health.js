import { withAuth } from './_shared/withAuth.js'
import { sendJson } from './_shared/http.js'
import { healthCheck } from './_shared/operations.js'

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  const status = await healthCheck()
  sendJson(res, 200, status)
})
