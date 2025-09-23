import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const logoSrc = '/logo_epicontrol.png'

const BadgeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="field__icon">
    <path
      fill="currentColor"
      d="M17 3h-2.35a3.5 3.5 0 0 0-6.3 0H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a3 3 0 0 0 3-3V5a2 2 0 0 0-2-2Zm-5-1a1.5 1.5 0 0 1 1.415 1h-2.83A1.5 1.5 0 0 1 12 2Zm6 16a1 1 0 0 1-1 1H6V5h12Zm-3-5.5a3 3 0 1 0-4.243 2.743 5.002 5.002 0 0 0-3.69 3.632 1 1 0 0 0 .972 1.225h6.042a1 1 0 0 0 .972-1.225 5.002 5.002 0 0 0-3.69-3.632A3 3 0 0 0 15 12.5Zm-3 1.5a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 12 14Z"
    />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="field__icon">
    <path
      fill="currentColor"
      d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 5a3 3 0 0 1 6 0v3H9Zm3 6a2 2 0 0 1 1 3.732V18a1 1 0 0 1-2 0v-1.268A2 2 0 0 1 12 13Z"
    />
  </svg>
)

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '', remember: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname ?? '/'

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(form)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth auth--login">
      <form className="auth-card auth-card--neon" onSubmit={handleSubmit}>
        <div className="auth-card__logo">
          <img src={logoSrc} alt="EpicControl" />
        </div>

        <header className="auth-card__titles">
          <p className="auth-card__kicker">Seguranca em Primeiro Lugar</p>
          <h1>Controle de EPIs com Facilidade</h1>
          <p className="auth-card__subtitle">Bem-vindo de volta. Acesse o sistema para registrar entrega ou devolucao de EPI.</p>
        </header>

        <label className="field field--panel">
          <span>Matricula / CPF</span>
          <div className="field__panel">
            <BadgeIcon />
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Digite sua matricula ou CPF"
              autoComplete="username"
              required
            />
          </div>
        </label>

        <label className="field field--panel">
          <span>Senha</span>
          <div className="field__panel">
            <LockIcon />
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Informe sua senha"
              autoComplete="current-password"
              required
            />
          </div>
        </label>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="auth-card__options">
          <label className="checkbox">
            <input type="checkbox" name="remember" checked={form.remember} onChange={handleChange} />
            <span>Manter conectado</span>
          </label>
          <button type="button" className="link-button">Esqueceu a senha?</button>
        </div>

        <button type="submit" className="button button--neon" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>

        <footer className="auth-card__footer">
          <button type="button" className="link-button link-button--muted">Registrar novo colaborador</button>
          <p>Seu EPI e sua protecao. Registre corretamente cada movimentacao.</p>
        </footer>
      </form>
    </div>
  )
}
