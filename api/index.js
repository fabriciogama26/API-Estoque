import { withAuth } from './_shared/withAuth.js'
import {
  readJson,
  sendJson,
  methodNotAllowed,
  handleError,
  parseQuery,
  createHttpError,
} from './_shared/http.js'
import {
  PessoasOperations,
  MateriaisOperations,
  AcidentesOperations,
  EntradasOperations,
  SaidasOperations,
  EstoqueOperations,
  DocumentosOperations,
  CentrosCustoOperations,
  healthCheck,
} from './_shared/operations.js'
import { touchSession, markSessionReauth, revokeSession } from './_shared/sessionActivity.js'

const SESSION_TOUCH_DEBUG = process.env.SESSION_TOUCH_DEBUG === 'true'

const maskAuthHeader = (header) => {
  if (!header || typeof header !== 'string') {
    return null
  }
  if (header.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim()
    if (!token) return 'Bearer <vazio>'
    return `Bearer ${token.slice(0, 12)}...`
  }
  return `${header.slice(0, 12)}...`
}

const resolveSessionErrorCode = (result = {}) => {
  const raw = (result.code || '').toString().trim().toUpperCase()
  if (raw === 'INTERACTION_REQUIRED') {
    return 'VALIDATION_ERROR'
  }
  if (raw === 'SESSION_EXPIRED' || raw === 'REAUTH_REQUIRED') {
    return 'AUTH_EXPIRED'
  }
  if (result.status === 401 || result.status === 403) {
    return 'AUTH_EXPIRED'
  }
  return 'VALIDATION_ERROR'
}

export default withAuth(async (req, res, user) => {
  const { method, url } = req
  const path = url.split('?')[0]
  const query = parseQuery(req)

  try {
    // Pessoas
    if (path === '/api/pessoas') {
      if (method === 'GET') return sendJson(res, 200, await PessoasOperations.list(query))
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await PessoasOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/pessoas/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) {
        throw createHttpError(400, 'ID da pessoa não informado.', { code: 'VALIDATION_ERROR' })
      }
      const body = await readJson(req)
      return sendJson(res, 200, await PessoasOperations.update(id, body, user))
    }
    if (path.startsWith('/api/pessoas/history/') && method === 'GET') {
      const id = path.split('/')[4]
      if (!id) {
        throw createHttpError(400, 'ID da pessoa não informado para histórico.', {
          code: 'VALIDATION_ERROR',
        })
      }
      return sendJson(res, 200, await PessoasOperations.history(id))
    }

    // Materiais
    if (path === '/api/materiais/groups' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.groups())
    }
    if (path === '/api/materiais/fabricantes' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.fabricantes())
    }
    if (path === '/api/materiais/caracteristicas' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.caracteristicas())
    }
    if (path === '/api/materiais/cores' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.cores())
    }
    if (path === '/api/materiais/medidas-calcado' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.medidasCalcado())
    }
    if (path === '/api/materiais/medidas-vestimenta' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.medidasVestimenta())
    }
    if (path === '/api/materiais/search' && method === 'GET') {
      return sendJson(res, 200, await MateriaisOperations.search(query))
    }
    if (path === '/api/materiais') {
      if (method === 'GET') return sendJson(res, 200, await MateriaisOperations.list())
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await MateriaisOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/materiais/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) {
        throw createHttpError(400, 'ID do material não informado.', { code: 'VALIDATION_ERROR' })
      }
      const body = await readJson(req)
      return sendJson(res, 200, await MateriaisOperations.update(id, body, user))
    }
    if (path.startsWith('/api/materiais/price-history/') && method === 'GET') {
      const id = path.split('/')[4]
      if (!id) {
        throw createHttpError(400, 'ID do material não informado para histórico de preços.', {
          code: 'VALIDATION_ERROR',
        })
      }
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
      if (!id) {
        throw createHttpError(400, 'ID do acidente não informado.', { code: 'VALIDATION_ERROR' })
      }
      const body = await readJson(req)
      return sendJson(res, 200, await AcidentesOperations.update(id, body, user))
    }

    // Entradas
    if (path === '/api/entradas') {
      if (method === 'GET') return sendJson(res, 200, await EntradasOperations.list(query))
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await EntradasOperations.create(body, user))
      }
    }
    if (path.startsWith('/api/entradas/') && method === 'PUT') {
      const id = path.split('/')[3]
      if (!id) {
        throw createHttpError(400, 'ID da entrada nao informado.', { code: 'VALIDATION_ERROR' })
      }
      const body = await readJson(req)
      return sendJson(res, 200, await EntradasOperations.update(id, body, user))
    }
    if (path.startsWith('/api/entradas/history/') && method === 'GET') {
      const id = path.split('/')[4]
      if (!id) {
        throw createHttpError(400, 'ID da entrada nao informado para historico.', {
          code: 'VALIDATION_ERROR',
        })
      }
      return sendJson(res, 200, await EntradasOperations.history(id))
    }

    // Saídas
    if (path === '/api/saidas') {
      if (method === 'GET') return sendJson(res, 200, await SaidasOperations.list(query))
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 201, await SaidasOperations.create(body, user))
      }
    }

    // Estoque e Dashboard
    if (path === '/api/estoque/relatorio' && method === 'POST') {
      const body = await readJson(req)
      return sendJson(res, 200, await EstoqueOperations.report(body, user))
    }
    if (path === '/api/estoque/relatorios' && method === 'GET') {
      return sendJson(res, 200, await EstoqueOperations.reportHistory(query, user))
    }
    if (path === '/api/estoque/relatorio/pdf' && method === 'POST') {
      const body = await readJson(req)
      return sendJson(res, 200, await EstoqueOperations.reportPdf(body, user))
    }
    if (path === '/api/estoque/relatorio/auto' && method === 'POST') {
      if (!req.isCron) {
        throw createHttpError(401, 'Nao autorizado para executar relatorio automatico.', {
          code: 'AUTH_REQUIRED',
        })
      }
      return sendJson(res, 200, await EstoqueOperations.reportAuto())
    }
    if (path === '/api/estoque/previsao') {
      if (method === 'GET') return sendJson(res, 200, await EstoqueOperations.forecast(query, user))
      if (method === 'POST') {
        const body = await readJson(req)
        return sendJson(res, 200, await EstoqueOperations.forecast(body, user))
      }
    }
    if (path === '/api/estoque') {
      if (query.view === 'dashboard') {
        return sendJson(res, 200, await EstoqueOperations.dashboard(query))
      }
      return sendJson(res, 200, await EstoqueOperations.current(query))
    }

    if (path === '/api/documentos/termo-epi' && method === 'GET') {
      if (query.format && query.format !== 'json') {
        throw createHttpError(
          400,
          'Formato nao suportado. Utilize format=json para obter o contexto do termo.',
          { code: 'VALIDATION_ERROR' }
        )
      }

      const contexto = await DocumentosOperations.termoEpiContext(query)
      return sendJson(res, 200, contexto)
    }

    if (path === '/api/centros-custo' && method === 'GET') {
      return sendJson(res, 200, await CentrosCustoOperations.list())
    }

    // Session activity
    if (path === '/api/session/touch' && method === 'POST') {
      if (SESSION_TOUCH_DEBUG) {
        console.log('=== SESSION TOUCH DEBUG ===')
        console.log('Headers:', {
          'x-session-id': req?.headers?.['x-session-id'] || req?.headers?.['X-Session-Id'] || null,
          'x-user-interaction':
            req?.headers?.['x-user-interaction'] || req?.headers?.['X-User-Interaction'] || null,
          'user-agent': req?.headers?.['user-agent'] || req?.headers?.['User-Agent'] || null,
          'x-forwarded-for':
            req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For'] || null,
          authorization: maskAuthHeader(
            req?.headers?.authorization ||
              req?.headers?.Authorization ||
              req?.headers?.get?.('authorization') ||
              req?.headers?.get?.('Authorization')
          ),
        })
        console.log('Body:', req?.body || null)
        console.log('User:', user?.id || null)
      }

      try {
        const result = await touchSession(req, user, req.authToken)
        if (!result?.ok) {
          const status = result.status || 400
          const code = resolveSessionErrorCode({ status, code: result.code })
          throw createHttpError(
            status,
            result.message || 'Falha ao validar sessao.',
            { code }
          )
        }
        return sendJson(res, 200, { ok: true, touched: result.touched })
      } catch (error) {
        if (SESSION_TOUCH_DEBUG) {
          console.error('ERRO COMPLETO:', error)
          console.error('Stack:', error?.stack)
        }
        throw error
      }
    }

    if (path === '/api/session/reauth' && method === 'POST') {
      const result = await markSessionReauth(req, user, req.authToken)
      if (!result?.ok) {
        const status = result.status || 400
        const code = resolveSessionErrorCode({ status, code: result.code })
        throw createHttpError(
          status,
          result.message || 'Falha ao validar sessao.',
          { code }
        )
      }
      return sendJson(res, 200, { ok: true })
    }

    if (path === '/api/session/revoke' && method === 'POST') {
      const result = await revokeSession(req, user, req.authToken)
      if (!result?.ok) {
        const status = result.status || 400
        const code = resolveSessionErrorCode({ status, code: result.code })
        throw createHttpError(
          status,
          result.message || 'Falha ao validar sessao.',
          { code }
        )
      }
      return sendJson(res, 200, { ok: true })
    }

    // Health check
    if (path === '/api/health' && method === 'GET') {
      return sendJson(res, 200, await healthCheck())
    }

    methodNotAllowed(res, ['GET', 'POST', 'PUT'], req)
  } catch (error) {
    handleError(res, error, 'Erro interno do servidor.', req)
  }
})
