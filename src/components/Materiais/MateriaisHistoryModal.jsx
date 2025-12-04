import { MateriaisHistoricoTimeline } from './MateriaisHistoricoTimeline.jsx'

export function MateriaisHistoryModal({ modal, onClose }) {
  if (!modal.open) {
    return null
  }

  const handleOverlayClick = () => onClose()
  const stopPropagation = (event) => event.stopPropagation()

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="entradas-history__modal" onClick={stopPropagation}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico de edicoes</h3>
            <p className="entradas-history__subtitle">{modal.material?.id || '-'}</p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar historico">
            x
          </button>
        </header>
        <div className="entradas-history__body">
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
