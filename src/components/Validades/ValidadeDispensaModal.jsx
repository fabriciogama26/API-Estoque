import { todayLocalKey } from '../../utils/validadesUtils.js'

export function ValidadeDispensaModal({ state, onClose, onChange, onSubmit }) {
  if (!state.open || !state.item) {
    return null
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={state.isSaving ? undefined : onClose}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>Dispensar requisito</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar" disabled={state.isSaving}>
            x
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="modal__body validades-modal__body">
            <label className="field field--accent">
              <span>Colaborador / requisito</span>
              <input value={`${state.item.pessoa_nome} - ${state.item.requisito_nome}`} readOnly disabled />
            </label>
            <p className="data-table__muted">
              Use quando a regra geral nao se aplica a este colaborador (ex.: funcao sem exposicao, restricao medica). O
              requisito deixa de contar como pendente e nao gera alerta. Fica registrado no historico.
            </p>
            <label className="field">
              <span>
                Motivo <span className="asterisco">*</span>
              </span>
              <textarea name="motivo" value={state.motivo} onChange={onChange} rows="3" required />
            </label>
            <label className="field">
              <span>Dispensado ate (opcional)</span>
              <input type="date" name="valida_ate" value={state.valida_ate} onChange={onChange} min={todayLocalKey()} />
              <small className="data-table__muted">Depois desta data o requisito volta a ser cobrado.</small>
            </label>
            {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
          </div>
          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={state.isSaving}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={state.isSaving}>
              {state.isSaving ? 'Salvando...' : 'Confirmar dispensa'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
