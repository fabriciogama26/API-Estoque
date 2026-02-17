import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { logError } from '../services/errorLogService.js'

export function useLoginForm() {
  const { login, recoverPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ loginName: '', password: '' })
  const [recoveryLogin, setRecoveryLogin] = useState('')
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
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

  const handleRecoveryChange = (event) => {
    const { value } = event.target
    setError(null)
    setStatus(null)
    setRecoveryLogin(value)
  }

  const handleToggleRecovery = () => {
    if (!isRecoveryOpen && !recoveryLogin && form.loginName) {
      setRecoveryLogin(form.loginName)
    }
    setIsRecoveryOpen((prev) => !prev)
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
        context: { loginName: form.loginName },
        severity: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordRecovery = async () => {
    setStatus(null)
    setError(null)

    const loginName = recoveryLogin?.trim() ?? ''
    if (!loginName) {
      setError('Informe seu login para recuperar a senha.')
      return
    }

    setIsRecovering(true)
    try {
      await recoverPassword(loginName)
      setStatus('Enviamos um link de recuperacao para o seu email.')
    } catch (err) {
      setError(err.message)
      logError({
        page: 'login',
        message: err.message,
        context: { loginName: recoveryLogin, action: 'recoverPassword' },
        severity: 'error',
      })
    } finally {
      setIsRecovering(false)
    }
  }

  return {
    form,
    recoveryLogin,
    isRecoveryOpen,
    isSubmitting,
    error,
    status,
    isRecovering,
    handleChange,
    handleRecoveryChange,
    handleToggleRecovery,
    handleSubmit,
    handlePasswordRecovery,
  }
}
