import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import '../styles/ResetPasswordPage.css'

const logoSrc = '/logo2.png'

export function ResetPasswordPage() {
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
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          throw error
        }
        if (data?.session) {
          setIsReady(true)
          return
        }

        const currentUrl = new URL(window.location.href)
        const hashParams = new URLSearchParams(currentUrl.hash?.replace(/^#/, '') ?? '')
        const searchParams = currentUrl.searchParams

        const code = searchParams.get('code') || hashParams.get('code')
        if (code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
          if (exchangeData?.session) {
            setIsReady(true)
            return
          }
        }

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionFromTokensError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionFromTokensError) {
            throw sessionFromTokensError
          }
          if (sessionData?.session) {
            setIsReady(true)
            return
          }
        }

        throw new Error('Link de redefinicao invalido ou expirado. Solicite um novo email.')
      } catch (err) {
        setSessionError(err.message || 'Nao foi possivel validar o link de redefinicao.')
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
      const { error } = await supabase.auth.updateUser({ password: form.newPassword })
      if (error) {
        throw error
      }
      setStatus({ type: 'success', message: 'Senha atualizada! Use-a para entrar novamente.' })
      setForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Nao foi possivel atualizar a senha.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoToLogin = () => {
    navigate('/login')
  }

  const isFormDisabled = Boolean(sessionError) || isCheckingSession

  return (
    <div className="reset-page">
      <div className="reset-page__glow reset-page__glow--one" aria-hidden="true" />
      <div className="reset-page__glow reset-page__glow--two" aria-hidden="true" />

      <div className="reset-card">
        <div className="reset-card__logo">
          <img src={logoSrc} alt="EpicControl" />
        </div>

        <header className="reset-card__header">
          <p className="reset-card__kicker">Seguranca em primeiro lugar</p>
          <h1>Redefinir senha</h1>
          <p className="reset-card__subtitle">
            Crie uma nova senha para voltar a acessar o painel com seguranca.
          </p>
        </header>

        {sessionError ? (
          <div className="reset-alert reset-alert--error" role="alert">
            {sessionError}
          </div>
        ) : (
          <p className="reset-hint" aria-live="polite">
            {isCheckingSession ? 'Validando seu link de redefinicao...' : 'Informe sua nova senha abaixo.'}
          </p>
        )}

        <form className="reset-form" onSubmit={handleSubmit}>
          <label className="reset-field">
            <span>Nova senha</span>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              minLength={8}
              autoComplete="new-password"
              placeholder="Digite a nova senha"
              disabled={isFormDisabled}
              required
            />
          </label>

          <label className="reset-field">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              disabled={isFormDisabled}
              required
            />
          </label>

          {status ? <p className={`feedback feedback--${status.type}`}>{status.message}</p> : null}

          <div className="reset-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting || isFormDisabled}
            >
              {isSubmitting ? 'Atualizando...' : 'Salvar nova senha'}
            </button>
            <button type="button" className="button button--ghost" onClick={handleGoToLogin}>
              Voltar para o login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
