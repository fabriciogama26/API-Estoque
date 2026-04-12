import { CancelIcon } from '../icons.jsx'
import { formatDate } from '../../utils/asoUtils.js'

export function AsoConflictModal({ state, isSaving, onClose, onOpenExisting, onContinue }) {
  if (!state?.open) {
    return null
  }

  const handleOverlayClick = () => {
    if (!isSaving) {
      onClose?.()
    }
  }

  const existing = state.existing

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>{state.title || 'Conflito de cadastro'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar modal" disabled={isSaving}>
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="modal__body">
          <p>{state.message}</p>
          {existing ? (
            <p className="data-table__muted">
              Registro existente: {existing.funcionario || existing.nome || '-'} | {existing.tipoExame || '-'} |{' '}
              {formatDate(existing.dataExame)}
            </p>
          ) : null}
        </div>

        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          {existing ? (
            <button type="button" className="button button--ghost" onClick={onOpenExisting} disabled={isSaving}>
              {state.openExistingLabel || 'Ver registro existente'}
            </button>
          ) : null}
          {state.canContinue ? (
            <button type="button" className="button button--primary" onClick={onContinue} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Continuar mesmo assim'}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}
