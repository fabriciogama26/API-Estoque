import { useState, useCallback } from 'react'
import { changePassword } from '../services/authService.js'
import { logError } from '../services/errorLogService.js'

const INITIAL_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function useChangePassword(user) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleChange = useCallback((event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }, [])

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM)
  }, [])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setFeedback(null)

      if (!form.newPassword || form.newPassword.length < 8) {
        setFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 8 caracteres.' })
        return
      }

      if (form.newPassword !== form.confirmPassword) {
        setFeedback({ type: 'error', message: 'A confirmacao precisa ser igual a nova senha.' })
        return
      }

      setIsSubmitting(true)
      try {
        await changePassword(form.currentPassword, form.newPassword)

        setFeedback({ type: 'success', message: 'Senha atualizada com sucesso.' })
        resetForm()
      } catch (err) {
        const message = err.message || 'Nao foi possivel atualizar a senha.'
        setFeedback({ type: 'error', message })
        logError({
          page: 'configuracoes',
          message,
          context: { action: 'change-password', userId: user?.id },
          severity: 'error',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [form, resetForm, user],
  )

  return {
    form,
    feedback,
    isSubmitting,
    handleChange,
    handleSubmit,
  }
}
