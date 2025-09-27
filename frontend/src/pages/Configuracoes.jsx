import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { PageHeader } from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import '../styles/ConfiguracoesPage.css'

export function ConfiguracoesPage() {
  const { user } = useAuth()

  return (
    <div className="stack config-page">
      <PageHeader
        icon={<SettingsIcon size={28} />}
        title="Configuracoes"
        subtitle="Gerencie sua conta e ajustes pessoais."
      />

      <ChangePasswordSection user={user} />
    </div>
  )
}

function ChangePasswordSection({ user }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
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

      const { error } = await supabase.auth.updateUser({ password: form.newPassword })
      if (error) {
        throw error
      }

      setFeedback({ type: 'success', message: 'Senha atualizada com sucesso.' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel atualizar a senha.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card config-page__section" aria-labelledby="change-password-title">
      <header className="card__header">
        <div>
          <h2 id="change-password-title">Trocar senha</h2>
          <p className="config-page__description">Atualize a senha da sua conta com seguranca.</p>
        </div>
      </header>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Senha atual</span>
          <input
            type="password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>Nova senha</span>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Confirmar nova senha</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
          />
        </label>

        {feedback ? (
          <p className={`system-status__feedback system-status__feedback--${feedback.type}`}>
            {feedback.message}
          </p>
        ) : null}

        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Atualizando...' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </section>
  )
}
