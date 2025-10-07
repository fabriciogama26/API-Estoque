import { Readable } from 'node:stream'

export async function readJson(req) {
  if (req.body) {
    try {
      return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch (error) {
      throw createHttpError(400, 'Corpo da requisição inválido.')
    }
  }

  const chunks = []
  const stream = Readable.from(req)

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  if (!chunks.length) {
    return {}
  }

  try {
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    throw createHttpError(400, 'Corpo da requisição inválido.')
  }
}

export function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '))
  sendError(res, 405, 'Método não permitido.')
}

export function createHttpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export function handleError(res, error, fallbackMessage = 'Erro interno do servidor.') {
  if (error?.status) {
    sendError(res, error.status, error.message || fallbackMessage)
    return
  }
  console.error(error)
  sendError(res, 500, fallbackMessage)
}

export function parseQuery(req) {
  return req.query || {}
}
