export function compose(...middlewares) {
  const errorMiddleware = middlewares.find((mw) => mw && mw.isErrorHandler)

  return async (ctx) => {
    for (const middleware of middlewares) {
      if (!middleware || middleware.isErrorHandler) {
        continue
      }
      try {
        const result = await middleware(ctx)
        if (result?.done) {
          return result
        }
      } catch (error) {
        if (errorMiddleware) {
          return errorMiddleware(ctx, error)
        }
        throw error
      }
    }
    return undefined
  }
}
