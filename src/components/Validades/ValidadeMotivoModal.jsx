export function ValidadeMotivoModal({ state, onClose, onChange, onSubmit, confirmLabel = 'Confirmar' }) {
  if (!state?.open) {
    return null
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={state.isSaving ? undefined : onClose}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>{state.titulo}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar" disabled={state.isSaving}>
            x
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="modal__body validades-modal__body">
            {state.descricao ? <p className="data-table__muted">{state.descricao}</p> : null}
            <label className="field">
              <span>
                Motivo <span className="asterisco">*</span>
              </span>
              <textarea name="motivo" value={state.motivo} onChange={onChange} rows="3" required />
            </label>
            {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
          </div>
          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={state.isSaving}>
              Voltar
            </button>
            <button type="submit" className="button button--primary" disabled={state.isSaving}>
              {state.isSaving ? 'Salvando...' : confirmLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
