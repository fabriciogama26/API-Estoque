import { compose } from './middleware/compose.js'
import { buildContext } from './middleware/ctx.js'
import { requestId } from './middleware/requestId.js'
import { cors } from './middleware/cors.js'
import { auth } from './middleware/auth.js'
import { tenantResolve } from './middleware/tenant.js'
import { tenantGuard } from './middleware/tenantGuard.js'
import { rateLimitAuth, rateLimitApi } from './middleware/rateLimit.js'
import { idempotency } from './middleware/idempotency.js'
import { errorHandler } from './middleware/errorHandler.js'

const handlerAdapter = (handler) => async (ctx) => {
  await handler(ctx.raw.req, ctx.raw.res, ctx.user)
}

export function withAuth(handler) {
  const pipeline = compose(
    requestId,
    cors,
    auth,
    rateLimitAuth,
    tenantResolve,
    tenantGuard,
    rateLimitApi,
    idempotency,
    handlerAdapter(handler),
    errorHandler
  )

  return async (req, res) => {
    const ctx = buildContext(req, res)
    return pipeline(ctx)
  }
}
