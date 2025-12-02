import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { restoreResetSession, updatePassword } from '../services/authService.js'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient.js'
import { logError } from '../services/errorLogService.js'

export function useResetPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const ensureSession = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setSessionError('Supabase nao configurado para redefinir senha.')
        setIsCheckingSession(false)
        return
      }

      try {
        await restoreResetSession()
        setIsReady(true)
      } catch (err) {
        setSessionError(err.message || 'Nao foi possivel validar o link de redefinicao.')
        logError({
          page: 'reset-password',
          message: err.message,
          context: { source: 'restoreResetSession' },
          severity: 'error',
        })
      } finally {
        setIsCheckingSession(false)
      }
    }

    ensureSession()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setStatus(null)
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)

    if (!isSupabaseConfigured() || !supabase) {
      setStatus({ type: 'error', message: 'Supabase nao configurado para redefinir senha.' })
      return
    }

    if (!isReady) {
      setStatus({ type: 'error', message: 'Link de redefinicao invalido ou expirado.' })
      return
    }

    if (!form.newPassword || form.newPassword.length < 8) {
      setStatus({ type: 'error', message: 'A senha deve ter pelo menos 8 caracteres.' })
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setStatus({ type: 'error', message: 'A confirmacao precisa ser igual a nova senha.' })
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(form.newPassword)
      setStatus({ type: 'success', message: 'Senha atualizada! Redirecionando para o login...' })
      setForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Nao foi possivel atualizar a senha.' })
      logError({
        page: 'reset-password',
        message: err.message,
        context: { source: 'updatePassword' },
        severity: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (status?.type === 'success') {
      const id = window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1200)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [status?.type, navigate])

  const isFormDisabled = Boolean(sessionError) || isCheckingSession

  return {
    form,
    status,
    isSubmitting,
    isCheckingSession,
    sessionError,
    isReady,
    isFormDisabled,
    handleChange,
    handleSubmit,
  }
}
