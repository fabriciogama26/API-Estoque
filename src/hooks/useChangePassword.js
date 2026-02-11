import { useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
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

      if (!isSupabaseConfigured() || !supabase) {
        setFeedback({ type: 'error', message: 'Supabase nao configurado.' })
        return
      }

      if (!form.newPassword || form.newPassword.length < 8) {
        setFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 8 caracteres.' })
        return
      }

      if (form.newPassword !== form.confirmPassword) {
        setFeedback({ type: 'error', message: 'A confirmacao precisa ser igual a nova senha.' })
        return
      }

      if (!user?.email) {
        setFeedback({ type: 'error', message: 'Email do usuario nao encontrado para validar senha.' })
        return
      }

      setIsSubmitting(true)
      try {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: form.currentPassword,
        })

        if (reauthError) {
          throw new Error('Senha atual incorreta.')
        }

        const { error } = await supabase.auth.updateUser({
          password: form.newPassword,
          data: { password_changed_at: new Date().toISOString() },
        })
        if (error) {
          throw error
        }

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
