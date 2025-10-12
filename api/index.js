import { withAuth } from '../_shared/withAuth.js'
import { readJson, sendJson, methodNotAllowed, handleError, parseQuery } from '../_shared/http.js'
import {
  PessoasOperations,
  MateriaisOperations,
  AcidentesOperations,
  EntradasOperations,
  SaidasOperations,
  EstoqueOperations,
  healthCheck,
} from '../_shared/operations.js'

export default withAuth(async (req, res, user) => {
  const { method, url } = req
  const path = url.split('?')[0]
  const query = parseQuery(req)

  try {
    // Pessoas
    if (path === '/api/pessoas') {
      if (method === 'GET') return sendJson(res, 200, await PessoasOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await PessoasOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/pessoas/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) return sendJson(res, 400, { error: 'ID da pessoa não informado.' })
      const body = await readJson(req)
      return sendJson(res, 200, await PessoasOperations.update(id, body, user))
    }
    if (path.startsWith('/api/pessoas/history/') && method === 'GET') {
      const id = path.split('/')[4]
      if (!id) return sendJson(res, 400, { error: 'ID da pessoa não informado para histórico.' })
      return sendJson(res, 200, await PessoasOperations.history(id))
    }

    // Materiais
    if (path === '/api/materiais') {
      if (method === 'GET') return sendJson(res, 200, await MateriaisOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await MateriaisOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/materiais/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) return sendJson(res, 400, { error: 'ID do material não informado.' })
      const body = await readJson(req)
      return sendJson(res, 200, await MateriaisOperations.update(id, body, user))
    }
    if (path.startsWith('/api/materiais/price-history/') && method === 'GET') {
      const id = path.split('/')[4]
      if (!id) return sendJson(res, 400, { error: 'ID do material não informado para histórico de preços.' })
      return sendJson(res, 200, await MateriaisOperations.priceHistory(id))
    }

    // Acidentes
    if (path === '/api/acidentes') {
      if (method === 'GET') return sendJson(res, 200, await AcidentesOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await AcidentesOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/acidentes/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) return sendJson(res, 400, { error: 'ID do acidente não informado.' })
      const body = await readJson(req)
      return sendJson(res, 200, await AcidentesOperations.update(id, body, user))
    }

    // Entradas
    if (path === '/api/entradas') {
      if (method === 'GET') return sendJson(res, 200, await EntradasOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await EntradasOperations.create(body, user))
      }
    }

    // Saídas
    if (path === '/api/saidas') {
      if (method === 'GET') return sendJson(res, 200, await SaidasOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await SaidasOperations.create(body, user))
      }
    }

    // Estoque e Dashboard
    if (path === '/api/estoque') {
      if (query.view === 'dashboard') {
        return sendJson(res, 200, await EstoqueOperations.dashboard(query))
      }
      return sendJson(res, 200, await EstoqueOperations.current(query))
    }

    // Health check
    if (path === '/api/health' && method === 'GET') {
      return sendJson(res, 200, await healthCheck())
    }

    methodNotAllowed(res, ['GET', 'POST', 'PUT'])
  } catch (error) {
    handleError(res, error)
  }
})
