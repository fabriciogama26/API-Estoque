import { formatMesRefLabel } from '../../../../utils/hhtMensalUtils.js'
import { HhtMensalHistoryTimeline } from './HhtMensalHistoryTimeline.jsx'

export function HhtMensalHistoryModal({ state, onClose }) {
  if (!state.open) {
    return null
  }

  const handleOverlayClick = () => {
    onClose()
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const titulo = state.registro
    ? `${formatMesRefLabel(state.registro.mesRef)} | ${state.registro.centroServicoNome || ''}`
    : 'Historico'

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="entradas-history__modal" onClick={stopPropagation}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico do HHT mensal</h3>
            <p className="entradas-history__subtitle">{titulo}</p>
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
          ) : (
            <HhtMensalHistoryTimeline registros={state.registros} />
          )}
        </div>
      </div>
    </div>
  )
}

