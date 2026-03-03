import { CONSUME_LOCAL_DATA } from '../environment.js'
import { resolveTenantId } from '../tenant.js'

const PUBLIC_ROUTES = new Set(['auth.login', 'auth.recover', 'health.check'])

export async function tenantResolve(ctx) {
  if (!ctx?.raw?.req) return undefined
  if (PUBLIC_ROUTES.has(ctx.route)) {
    ctx.tenantId = null
    return undefined
  }
  if (ctx.isCron || ctx.raw.req?.isCron) {
    ctx.tenantId = null
    return undefined
  }
  if (!ctx.user) {
    return undefined
  }

  if (CONSUME_LOCAL_DATA) {
    ctx.tenantId = ctx.user?.id || 'local-owner'
    ctx.raw.req.tenantId = ctx.tenantId
    return undefined
  }

  const token = ctx.raw.req?.authToken || null
  const tenantId = await resolveTenantId({ user: ctx.user, token })
  ctx.tenantId = tenantId
  ctx.raw.req.tenantId = tenantId
  return undefined
}
