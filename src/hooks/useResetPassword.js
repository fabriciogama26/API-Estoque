import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resetPasswordWithCode } from '../services/authService.js'
import { logError } from '../services/errorLogService.js'
import { validatePasswordOrThrow } from '../services/passwordPolicyService.js'
import { securityConfig } from '../config/security.js'

export function useResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [resetCode, setResetCode] = useState(null)
  const resetReason = new URLSearchParams(location.search).get('reason') || ''
  const isForcedReset = resetReason === 'expired'

  useEffect(() => {
    const ensureSession = async () => {
      try {
        const currentUrl = new URL(window.location.href)
        const hashParams = new URLSearchParams(currentUrl.hash?.replace(/^#/, '') ?? '')
        const searchParams = currentUrl.searchParams
        const code = searchParams.get('code') || hashParams.get('code')
        if (!code) {
          throw new Error('Link de redefinicao invalido ou expirado.')
        }
        setResetCode(code)
        setIsReady(true)
      } catch (err) {
        setSessionError(err.message || 'Nao foi possivel validar o link de redefinicao.')
        logError({
          page: 'reset-password',
          message: err.message,
          context: { source: 'reset-link' },
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

  const handleCancel = async () => {
    if (isSubmitting) {
      return
    }
    navigate('/login', { replace: true })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)

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

      await validatePasswordOrThrow(form.newPassword)

      if (form.newPassword !== form.confirmPassword) {
        throw new Error('A confirmacao precisa ser igual a nova senha.')
      }

      await resetPasswordWithCode(resetCode, form.newPassword)
      setStatus({ type: 'success', message: 'Senha atualizada! Redirecionando para o login...' })
      setForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Nao foi possivel atualizar a senha.' })
      logError({
        page: 'reset-password',
        message: err.message,
        context: { source: 'resetPasswordWithCode' },
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
    isForcedReset,
    resetReason,
    handleChange,
    handleSubmit,
    handleCaptchaToken,
    handleCancel,
  }
}
