import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { restoreResetSession, updatePassword } from '../services/authService.js'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient.js'
import { logError } from '../services/errorLogService.js'
import { validatePasswordOrThrow } from '../services/passwordPolicyService.js'
import { securityConfig } from '../config/security.js'

export function useResetPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    const ensureSession = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setSessionError('Supabase nao configurado para redefinir senha.')
        setIsCheckingSession(false)
        return
      }

      try {
        const session = await restoreResetSession()
        setUserEmail(session?.user?.email || null)
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

  const handleCaptchaToken = (token) => {
    setCaptchaToken(token || '')
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

    setIsSubmitting(true)
    try {
      if (securityConfig.captcha.enabled && securityConfig.captcha.requiredFlows.passwordRecovery) {
        if (!captchaToken) {
          throw new Error('Resolva o captcha antes de salvar a nova senha.')
        }
      }

      await validatePasswordOrThrow(form.newPassword, { email: userEmail })

      if (form.newPassword !== form.confirmPassword) {
        throw new Error('A confirmacao precisa ser igual a nova senha.')
      }

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
    handleCaptchaToken,
  }
}
