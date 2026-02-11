import { CancelIcon } from '../../icons.jsx'
import { formatDateWithOptionalTime } from '../../../utils/acidentesUtils.js'

export function AcidenteDuplicateModal({ state, onClose, onConfirm, isSaving }) {
  if (!state?.open) {
    return null
  }

  const dataLabel = state.data ? formatDateWithOptionalTime(state.data) : ''
  const matriculaLabel = state.matricula || state.acidente?.matricula || ''
  const idLabel = state.acidente?.id || ''

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
          <h3>Acidente ja cadastrado</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar modal" disabled={isSaving}>
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="modal__body">
          <p>
            Ja existe um acidente para a matricula <strong>{matriculaLabel || '-'}</strong> na data{' '}
            <strong>{dataLabel || '-'}</strong>.
          </p>
          {idLabel ? <p className="data-table__muted">ID existente: {idLabel}</p> : null}
          <p>Deseja cadastrar mesmo assim?</p>
        </div>

        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="button button--primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Cadastrar mesmo assim'}
          </button>
        </footer>
      </div>
    </div>
  )
}
