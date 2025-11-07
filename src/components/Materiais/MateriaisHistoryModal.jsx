import { MateriaisHistoricoTimeline } from './MateriaisHistoricoTimeline.jsx'

export function MateriaisHistoryModal({ modal, onClose }) {
  if (!modal.open) {
    return null
  }

  const handleOverlayClick = () => {
    onClose()
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  return (
    <div
      className="materiais-record-history__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-history-title"
      onClick={handleOverlayClick}
    >
      <div className="materiais-record-history__modal" onClick={stopPropagation}>
        <header className="materiais-record-history__header">
          <h3 id="record-history-title">
            Historico de edicoes -
            {' '}
            {modal.material?.id || '-'}
          </h3>
          <button
            type="button"
            className="materiais-record-history__close"
            onClick={onClose}
            aria-label="Fechar historico"
          >
            x
          </button>
        </header>
        <div className="materiais-record-history__body">
          {modal.isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : modal.error ? (
            <p className="feedback feedback--error">{modal.error}</p>
          ) : modal.items.length === 0 ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <MateriaisHistoricoTimeline registros={modal.items} />
          )}
        </div>
      </div>
    </div>
  )
}
