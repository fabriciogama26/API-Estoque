import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/SessionReauthModal.css'

export function SessionReauthModal() {
  const { reauthState, confirmReauth, cancelReauth } = useAuth()
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (reauthState?.open) {
      setPassword('')
    }
  }, [reauthState?.open])

  if (!reauthState?.open) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await confirmReauth(password)
  }

  const handleOverlayClick = () => {
    if (!reauthState?.isSubmitting) {
      cancelReauth()
    }
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  return (
    <div className="session-reauth__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="session-reauth__card" onClick={stopPropagation}>
        <header className="session-reauth__header">
          <h3>Reautenticacao necessaria</h3>
          <button
            type="button"
            className="session-reauth__close"
            onClick={cancelReauth}
            disabled={reauthState?.isSubmitting}
            aria-label="Fechar"
          >
            x
          </button>
        </header>
        <p className="session-reauth__subtitle">
          Para continuar com esta acao, confirme sua senha.
        </p>
        <form className="session-reauth__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              disabled={reauthState?.isSubmitting}
              required
            />
          </label>
          {reauthState?.error ? <p className="feedback feedback--error">{reauthState.error}</p> : null}
          <div className="session-reauth__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={cancelReauth}
              disabled={reauthState?.isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={reauthState?.isSubmitting}
            >
              {reauthState?.isSubmitting ? 'Validando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
