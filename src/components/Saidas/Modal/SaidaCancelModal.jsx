import { CancelIcon } from '../../icons.jsx'

export function SaidaCancelModal({ state, onClose, onConfirm, onMotivoChange, isSaving }) {
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
          <h3>Cancelar saida</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            <CancelIcon size={18} />
          </button>
        </header>
        <div className="modal__body">
          <p>Informe um motivo para cancelamento:</p>
          <textarea
            className="modal__textarea"
            rows={3}
            value={state.motivo}
            onChange={(event) => onMotivoChange?.(event.target.value)}
            placeholder="Descreva o motivo do cancelamento"
          />
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
            disabled={isSaving || !state.motivo?.trim()}
          >
            {isSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </footer>
      </div>
    </div>
  )
}
