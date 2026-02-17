import { useLoginForm } from '../hooks/useLoginForm.js'
import '../styles/LoginPage.css'

const logoSrc = '/logo_segtrab.png'


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
  const {
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
  } = useLoginForm()

  return (
    <div className="login-auth login-auth--login">
      <form className="login-auth-card login-auth-card--neon" onSubmit={handleSubmit}>
        <div className="login-auth-card__logo">
          <img src={logoSrc} alt="EpicControl" />
        </div>

        <header className="login-auth-card__titles">
          <h1>Bem-vindo de volta.</h1>
        </header>

        <label className="field login-field--panel">
          <span>Login</span>
          <div className="login-field__panel">
            <BadgeIcon />
            <input
              type="text"
              name="loginName"
              value={form.loginName}
              onChange={handleChange}
              placeholder="Digite seu login"
              autoComplete="username"
              required
            />
          </div>
        </label>

        <label className="field login-field--panel">
          <span>Senha</span>
          <div className="login-field__panel">
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
        {status ? <p className="feedback feedback--success">{status}</p> : null}

        <div className="login-auth-card__options">
          <button
            type="button"
            className="link-button"
            onClick={handleToggleRecovery}
          >
            {isRecoveryOpen ? 'Cancelar recuperação' : 'Esqueceu a senha?'}
          </button>
        </div>

        {isRecoveryOpen ? (
          <div className="login-auth-card__recovery">
            <label className="field login-field--panel">
              <span>Login para recuperação</span>
              <div className="login-field__panel">
                <BadgeIcon />
                <input
                  type="text"
                  name="recoveryLogin"
                  value={recoveryLogin}
                  onChange={handleRecoveryChange}
                  placeholder="Digite seu login"
                  autoComplete="username"
                />
              </div>
            </label>
            <div className="login-recovery__actions">
              <button
                type="button"
                className="button button--ghost login-recovery__button"
                onClick={handlePasswordRecovery}
                disabled={isRecovering}
              >
                {isRecovering ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </div>
          </div>
        ) : null}

        <button type="submit" className="button login-button--neon" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>

        <footer className="login-auth-card__footer">
          <p className="login-auth-card__footer-text">
            Seu EPI é sua proteção. Registre corretamente cada movimentação.
          </p>
        </footer>
      </form>
    </div>
  )
}
