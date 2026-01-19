import { CancelIcon } from '../../icons.jsx'

export function PessoaCancelModal({ state, onClose, onConfirm, onObservationChange, isSaving }) {
  if (!state?.open) {
    return null
  }

  const handleOverlayClick = () => {
    if (isSaving) return
    onClose?.()
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>Cancelar pessoa</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            <CancelIcon size={18} />
          </button>
        </header>
        <div className="modal__body">
          <p>
            Marcar {state.pessoa?.nome || 'esta pessoa'} como inativa? Ela deixa de aparecer nas metricas e paineis.
          </p>
          <p className="field__hint">Voce pode reativar editando a pessoa futuramente.</p>
          <label className="field">
            <span>
              Observacao <span className="asterisco">*</span>
            </span>
            <textarea
              rows={3}
              value={state.observacao}
              onChange={(event) => onObservationChange?.(event.target.value)}
              placeholder="Descreva o motivo do cancelamento"
              required
            />
          </label>
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
        </div>
        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Fechar
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={isSaving || !state.observacao?.trim()}
          >
            {isSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </footer>
      </div>
    </div>
  )
}
