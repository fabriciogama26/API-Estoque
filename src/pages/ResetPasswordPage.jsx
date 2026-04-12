import { useState } from 'react'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js'
import { useResetPassword } from '../hooks/useResetPassword.js'
import { securityConfig } from '../config/security.js'
import { CaptchaGuard } from '../components/CaptchaGuard.jsx'
import '../styles/ResetPasswordPage.css'

const logoSrc = '/logo_segtrab.png'

export function ResetPasswordPage() {
  const [visibleFields, setVisibleFields] = useState({
    newPassword: false,
    confirmPassword: false,
  })
  const {
    form,
    status,
    isSubmitting,
    isCheckingSession,
    sessionError,
    isFormDisabled,
    isForcedReset,
    handleChange,
    handleSubmit,
    handleCaptchaToken,
    handleCancel,
  } = useResetPassword()

  const toggleFieldVisibility = (fieldName) => {
    setVisibleFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

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
            <div className="reset-field__input-wrap">
              <input
                type={visibleFields.newPassword ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                minLength={securityConfig.password.minLength}
                autoComplete="new-password"
                placeholder="Digite a nova senha"
                disabled={isFormDisabled}
                required
              />
              <button
                type="button"
                className="reset-field__toggle"
                onClick={() => toggleFieldVisibility('newPassword')}
                aria-label={visibleFields.newPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                aria-pressed={visibleFields.newPassword}
                disabled={isFormDisabled}
              >
                {visibleFields.newPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
              </button>
            </div>
          </label>

          <label className="reset-field">
            <span>Confirmar nova senha</span>
            <div className="reset-field__input-wrap">
              <input
                type={visibleFields.confirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
                disabled={isFormDisabled}
                required
              />
              <button
                type="button"
                className="reset-field__toggle"
                onClick={() => toggleFieldVisibility('confirmPassword')}
                aria-label={visibleFields.confirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                aria-pressed={visibleFields.confirmPassword}
                disabled={isFormDisabled}
              >
                {visibleFields.confirmPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
              </button>
            </div>
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
            {!isForcedReset ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Voltar ao login
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
