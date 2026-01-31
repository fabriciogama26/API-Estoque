import { CadastroBaseHistoryTimeline } from './CadastroBaseHistoryTimeline.jsx'

export function CadastroBaseHistoryModal({ state, onClose }) {
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
    <div className="cadastro-base-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="cadastro-base-history__modal" onClick={stopPropagation}>
        <header className="cadastro-base-history__header">
          <div>
            <h3>Historico de edicoes</h3>
            <p className="cadastro-base-history__subtitle">ID: {state.item?.id || '-'}</p>
          </div>
          <button
            type="button"
            className="cadastro-base-history__close"
            onClick={onClose}
            aria-label="Fechar historico"
          >
            x
          </button>
        </header>
        <div className="cadastro-base-history__body">
          {state.isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : state.error ? (
            <p className="feedback feedback--error">{state.error}</p>
          ) : state.registros.length === 0 ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <CadastroBaseHistoryTimeline registros={state.registros} centrosCustoMap={state.centrosCustoMap} centrosServicoMap={state.centrosServicoMap} />
          )}
        </div>
      </div>
    </div>
  )
}
