import { ValidadesEventosTimeline } from './ValidadesEventosTimeline.jsx'

export function RequisitoHistoricoModal({ state, onClose }) {
  if (!state.open) {
    return null
  }

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="entradas-history__modal" onClick={(event) => event.stopPropagation()}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico do requisito</h3>
            <p className="entradas-history__subtitle">{state.requisito?.nome || '-'}</p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar historico">
            x
          </button>
        </header>
        <div className="entradas-history__body">
          {state.isLoading ? <p className="feedback">Carregando historico...</p> : null}
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
          {!state.isLoading && !state.error ? <ValidadesEventosTimeline eventos={state.eventos} /> : null}
        </div>
      </div>
    </div>
  )
}
