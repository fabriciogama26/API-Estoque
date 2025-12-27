import { useResetPassword } from '../hooks/useResetPassword.js'
import { securityConfig } from '../config/security.js'
import { CaptchaGuard } from '../components/CaptchaGuard.jsx'
import '../styles/ResetPasswordPage.css'

const logoSrc = '/logo_segtrab.png'

export function ResetPasswordPage() {
  const {
    form,
    status,
    isSubmitting,
    isCheckingSession,
    sessionError,
    isFormDisabled,
    handleChange,
    handleSubmit,
    handleCaptchaToken,
  } = useResetPassword()

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
              minLength={securityConfig.password.minLength}
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

          {securityConfig.captcha.enabled && securityConfig.captcha.requiredFlows.passwordRecovery ? (
            <div className="reset-captcha">
              <p className="reset-hint">Resolva o captcha para confirmar a troca de senha.</p>
              <CaptchaGuard onToken={handleCaptchaToken} disabled={isSubmitting || isFormDisabled} />
            </div>
          ) : null}

          <div className="reset-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting || isFormDisabled}
            >
              {isSubmitting ? 'Atualizando...' : 'Salvar nova senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
