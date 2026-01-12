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
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="entradas-history__modal" onClick={stopPropagation}>
        <header className="entradas-history__header">
          <div>
            <h3 id="pessoa-history-title">Historico de edicoes</h3>
            <p className="entradas-history__subtitle">{state.pessoa?.nome || '-'}</p>
          </div>
          <button
            type="button"
            className="entradas-history__close"
            onClick={onClose}
            aria-label="Fechar historico"
          >
            x
          </button>
        </header>
        <div className="entradas-history__body">
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
