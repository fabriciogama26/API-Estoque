import { formatMesRefLabel } from '../../../../utils/hhtMensalUtils.js'
import { CancelIcon } from '../../../icons.jsx'

export function HhtMensalDeleteModal({ state, onClose, onConfirm, onMotivoChange, isSaving }) {
  if (!state?.open) {
    return null
  }

  const registro = state.registro ?? null
  const titulo = registro
    ? `${formatMesRefLabel(registro.mesRef)} | ${registro.centroServicoNome || ''}`
    : 'Cancelar HHT mensal'

  const handleOverlayClick = () => {
    if (!isSaving) {
      onClose()
    }
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const disableConfirm = isSaving || !String(state.motivo ?? '').trim()

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="modal__content" onClick={stopPropagation}>
        <header className="modal__header">
          <h3>Cancelar HHT mensal</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar modal" disabled={isSaving}>
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="modal__body">
          <p className="data-table__muted">{titulo}</p>
          <p>Informe um motivo para cancelamento:</p>
          <textarea
            className="modal__textarea"
            rows={3}
            value={state.motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            disabled={isSaving}
            placeholder="Descreva o motivo do cancelamento"
          />
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
        </div>

        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Fechar
          </button>
          <button type="button" className="button button--danger" onClick={onConfirm} disabled={disableConfirm}>
            {isSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </footer>
      </div>
    </div>
  )
}
