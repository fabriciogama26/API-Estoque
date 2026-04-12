import { AsoHistoryTimeline } from './AsoHistoryTimeline.jsx'

export function AsoHistoryModal({ state, onClose }) {
  if (!state.open) {
    return null
  }

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="entradas-history__modal" onClick={(event) => event.stopPropagation()}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico de ASO</h3>
            <p className="entradas-history__subtitle">{state.aso?.funcionario || state.aso?.nome || '-'}</p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar historico">
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
            <AsoHistoryTimeline registros={state.registros} />
          )}
        </div>
      </div>
    </div>
  )
}
