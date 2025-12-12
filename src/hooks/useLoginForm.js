import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { logError } from '../services/errorLogService.js'

export function useLoginForm() {
  const { login, recoverPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ username: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [isRecovering, setIsRecovering] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setError(null)
    setStatus(null)
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)
    setError(null)
    setIsSubmitting(true)
    try {
      await login(form)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      logError({
        page: 'login',
        message: err.message,
        context: { username: form.username },
        severity: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordRecovery = async () => {
    setStatus(null)
    setError(null)

    const email = form.username?.trim() ?? ''
    if (!email) {
      setError('Informe seu email para recuperar a senha.')
      return
    }

    setIsRecovering(true)
    try {
      await recoverPassword(email)
      setStatus('Enviamos um link de recuperacao para o seu email.')
    } catch (err) {
      setError(err.message)
      logError({
        page: 'login',
        message: err.message,
        context: { username: form.username, action: 'recoverPassword' },
        severity: 'error',
      })
    } finally {
      setIsRecovering(false)
    }
  }

  return {
    form,
    isSubmitting,
    error,
    status,
    isRecovering,
    handleChange,
    handleSubmit,
    handlePasswordRecovery,
  }
}
