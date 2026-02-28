import { handleError } from '../http.js'

export function errorHandler(ctx, error) {
  const { req, res } = ctx.raw || {}
  if (!res) {
    throw error
  }
  handleError(res, error, 'Erro interno do servidor.', req)
  return { done: true }
}

errorHandler.isErrorHandler = true
