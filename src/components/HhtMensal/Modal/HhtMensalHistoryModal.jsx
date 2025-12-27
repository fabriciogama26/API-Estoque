import { formatMesRefLabel } from '../../../utils/hhtMensalUtils.js'
import { HhtMensalHistoryTimeline } from './HhtMensalHistoryTimeline.jsx'

export function HhtMensalHistoryModal({ state, onClose }) {
  if (!state?.open) {
    return null
  }

  const handleOverlayClick = () => {
    onClose?.()
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const mesLabel = formatMesRefLabel(state?.registro?.mesRef ?? state?.registro?.mes_ref)
  const centro = state?.registro?.centroServicoNome ?? state?.registro?.centroServico ?? state?.registro?.centro_servico_nome

  return (
    <div
      className="pessoas-record-history__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hht-history-title"
      onClick={handleOverlayClick}
    >
      <div className="pessoas-record-history__modal" onClick={stopPropagation}>
        <header className="pessoas-record-history__header">
          <div>
            <h3 id="hht-history-title">Historico do HHT</h3>
            <p className="entradas-history__subtitle">
              {mesLabel ? `${mesLabel} - ` : ''}
              {centro ?? ''}
            </p>
          </div>
          <button type="button" className="pessoas-record-history__close" onClick={onClose} aria-label="Fechar historico">
            x
          </button>
        </header>
        <div className="pessoas-record-history__body">
          {state.isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : state.error ? (
            <p className="feedback feedback--error">{state.error}</p>
          ) : !state.registros?.length ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <HhtMensalHistoryTimeline registros={state.registros} />
          )}
        </div>
      </div>
    </div>
  )
}
