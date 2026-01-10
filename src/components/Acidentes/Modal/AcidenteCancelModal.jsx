import { CancelIcon } from '../../icons.jsx'
import { formatDateWithOptionalTime } from '../../../utils/acidentesUtils.js'

export function AcidenteCancelModal({ state, onClose, onConfirm, onMotivoChange, isSaving }) {
  if (!state?.open) {
    return null
  }

  const acidente = state.acidente ?? null
  const titulo = acidente
    ? `${acidente.nome || 'Acidente'} - ${formatDateWithOptionalTime(acidente.data) || ''}`
    : 'Cancelar acidente'

  const handleOverlayClick = () => {
    if (!isSaving) {
      onClose()
    }
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="modal__content" onClick={stopPropagation}>
        <header className="modal__header">
          <h3>Cancelar acidente</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar modal" disabled={isSaving}>
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="modal__body">
          <p className="data-table__muted">{titulo}</p>
          <p>Ao cancelar, o acidente sai da lista e dos cálculos do dashboard.</p>
          <label className="field" style={{ marginTop: '0.5rem' }}>
            <span>Motivo do cancelamento</span>
            <textarea
              rows={3}
              value={state.motivo}
              onChange={(event) => onMotivoChange(event.target.value)}
              disabled={isSaving}
              placeholder="Descreva o motivo"
            />
          </label>
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
        </div>

        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Fechar
          </button>
          <button type="button" className="button button--danger" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </footer>
      </div>
    </div>
  )
}
