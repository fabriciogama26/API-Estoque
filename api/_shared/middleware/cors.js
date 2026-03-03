const DEFAULT_ALLOW_METHODS = 'GET, POST, PUT, OPTIONS'
const DEFAULT_ALLOW_HEADERS =
  'Authorization, Content-Type, X-Cron-Secret, X-User-Interaction, X-Session-Id, Idempotency-Key, X-Idempotency-Key'

export async function cors(ctx) {
  const { req, res } = ctx.raw || {}
  if (!req || !res) return undefined

  const origin = req.headers?.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', DEFAULT_ALLOW_METHODS)
    res.setHeader('Access-Control-Allow-Headers', DEFAULT_ALLOW_HEADERS)
    res.statusCode = 204
    res.end()
    return { done: true }
  }

  return undefined
}
