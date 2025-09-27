import { PessoasHistoryTimeline } from './PessoasHistoryTimeline.jsx'

export function PessoasHistoryModal({ state, onClose }) {
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
      className="materiais-record-history__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pessoa-history-title"
      onClick={handleOverlayClick}
    >
      <div className="materiais-record-history__modal" onClick={stopPropagation}>
        <header className="materiais-record-history__header">
          <h3 id="pessoa-history-title">Historico de edicoes - {state.pessoa?.nome}</h3>
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
          {state.isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : state.error ? (
            <p className="feedback feedback--error">{state.error}</p>
          ) : state.registros.length === 0 ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <PessoasHistoryTimeline registros={state.registros} />
          )}
        </div>
      </div>
    </div>
  )
}
