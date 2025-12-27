import { formatMesRefLabel } from '../../../utils/hhtMensalUtils.js'

export function HhtMensalDeleteModal({ state, onClose, onConfirm, onMotivoChange, isSaving = false }) {
  if (!state?.open) {
    return null
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const mesLabel = formatMesRefLabel(state?.registro?.mesRef ?? state?.registro?.mes_ref)
  const centro = state?.registro?.centroServicoNome ?? state?.registro?.centroServico ?? state?.registro?.centro_servico_nome

  return (
    <div className="acidente-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="acidente-details__modal" onClick={stopPropagation}>
        <header className="acidente-details__header">
          <div>
            <p className="acidente-details__eyebrow">Cancelar registro</p>
            <h3 className="acidente-details__title">{mesLabel ? `HHT ${mesLabel}` : 'HHT mensal'}</h3>
            <p className="acidente-details__meta">{centro ?? ''}</p>
          </div>
          <button
            type="button"
            className="acidente-details__close"
            onClick={onClose}
            aria-label="Fechar confirmacao"
            disabled={isSaving}
          >
            x
          </button>
        </header>

        <div className="acidente-details__section">
          <p>Confirma cancelar/remover este registro de HHT? O historico sera mantido.</p>
          <label className="field field--full">
            <span>
              Motivo <span className="asterisco">*</span>
            </span>
            <textarea
              rows={3}
              value={state.motivo ?? ''}
              onChange={(event) => onMotivoChange?.(event.target.value)}
              placeholder="Descreva o motivo do cancelamento"
              required
              disabled={isSaving}
            />
          </label>
          {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
        </div>

        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Voltar
          </button>
          <button type="button" className="button button--primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
