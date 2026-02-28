import { ensureRequestId } from '../errorCore.js'

export async function requestId(ctx) {
  if (!ctx?.raw?.req || !ctx?.raw?.res) {
    return undefined
  }
  const requestId = ensureRequestId(ctx.raw.req, ctx.raw.res)
  ctx.requestId = requestId
  return undefined
}
