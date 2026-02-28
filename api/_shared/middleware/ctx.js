import { resolveRoute } from './route.js'

const resolveIp = (req) => {
  const forwarded =
    req?.headers?.['x-forwarded-for'] ||
    req?.headers?.['X-Forwarded-For'] ||
    req?.headers?.get?.('x-forwarded-for') ||
    req?.headers?.get?.('X-Forwarded-For') ||
    ''
  if (forwarded) {
    return String(forwarded).split(',')[0].trim()
  }
  return (
    req?.headers?.['x-real-ip'] ||
    req?.headers?.['X-Real-IP'] ||
    req?.headers?.get?.('x-real-ip') ||
    req?.headers?.get?.('X-Real-IP') ||
    req?.socket?.remoteAddress ||
    ''
  )
}

export function buildContext(req, res) {
  return {
    requestId: null,
    ip: resolveIp(req),
    route: resolveRoute(req),
    method: (req?.method || '').toUpperCase(),
    user: null,
    tenantId: null,
    raw: { req, res },
  }
}
