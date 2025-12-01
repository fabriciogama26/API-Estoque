import { useMemo } from 'react'
import { logError } from '../services/errorLogService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isLocalMode } from '../config/runtime.js'

export function useErrorLogger(page) {
  const { user } = useAuth()

  const logger = useMemo(
    () => ({
      async reportError(err, extraContext = {}) {
        if (!err) {
          return
        }
        const message = err?.message ?? String(err)
        const stack = err?.stack ?? ''
        const context = {
          ...extraContext,
          ...(err?.context || {}),
        }
        const userId = user?.id ?? user?.email ?? user?.username ?? null
        const environment = isLocalMode ? 'dev' : 'app'
        try {
          await logError({
            message,
            stack,
            page,
            context,
            severity: 'error',
            userId,
            environment,
          })
        } catch (logErr) {
          console.warn('Falha ao enviar erro para Supabase:', logErr?.message ?? logErr)
        }
      },
    }),
    [page, user],
  )

  return logger
}
