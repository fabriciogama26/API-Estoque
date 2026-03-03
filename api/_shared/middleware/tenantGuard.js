import { createHttpError } from '../http.js'

const PUBLIC_ROUTES = new Set(['auth.login', 'auth.recover', 'health.check'])

export async function tenantGuard(ctx) {
  if (!ctx?.raw?.req) return undefined
  if (PUBLIC_ROUTES.has(ctx.route)) {
    return undefined
  }
  if (ctx.isCron || ctx.raw.req?.isCron) {
    return undefined
  }
  if (!ctx.user) {
    return undefined
  }

  if (!ctx.tenantId) {
    throw createHttpError(403, 'Tenant nao identificado.', { code: 'RLS_DENIED' })
  }

  const body = ctx.raw.req?.body
  if (body && typeof body === 'object') {
    const payloadOwner = body.account_owner_id || body.accountOwnerId || null
    if (payloadOwner && String(payloadOwner) !== String(ctx.tenantId)) {
      throw createHttpError(403, 'Tenant invalido para a operacao.', { code: 'RLS_DENIED' })
    }
  }

  return undefined
}
