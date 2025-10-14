import { AcidentesHistoryTimeline } from './AcidentesHistoryTimeline.jsx'

export function AcidentesHistoryModal({ state, onClose }) {
  if (!state.open) {
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
      className="acidentes-record-history__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acidente-history-title"
      onClick={handleOverlayClick}
    >
      <div className="acidentes-record-history__modal" onClick={stopPropagation}>
        <header className="acidentes-record-history__header">
          <h3 id="acidente-history-title">Historico de edicoes - {state.acidente?.nome}</h3>
          <button
            type="button"
            className="acidentes-record-history__close"
            onClick={onClose}
            aria-label="Fechar historico"
          >
            x
          </button>
        </header>
        <div className="acidentes-record-history__body">
          {state.isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : state.error ? (
            <p className="feedback feedback--error">{state.error}</p>
          ) : state.registros?.length === 0 ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <AcidentesHistoryTimeline registros={state.registros} />
          )}
        </div>
      </div>
    </div>
  )
}
