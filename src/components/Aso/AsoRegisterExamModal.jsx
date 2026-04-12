import { formatDate } from '../../utils/asoUtils.js'

export function AsoRegisterExamModal({
  state,
  onClose,
  onChange,
  onSubmit,
}) {
  if (!state.open || !state.aso) {
    return null
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>Registrar exame</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </header>

        <form onSubmit={onSubmit}>
          <div className="modal__body aso-register-modal__body">
            <label className="field field--accent">
              <span>Funcionario</span>
              <input value={state.aso.funcionario || state.aso.nome || '-'} readOnly disabled />
            </label>

            <label className="field field--accent">
              <span>Tipo</span>
              <input value={state.aso.tipoExame || '-'} readOnly disabled />
            </label>

            <label className="field field--accent">
              <span>Data prevista</span>
              <input value={formatDate(state.aso.proximoVencimento)} readOnly disabled />
            </label>

            <label className="field">
              <span>Data realizada <span className="asterisco">*</span></span>
              <input type="date" name="dataRealizada" value={state.dataRealizada} onChange={onChange} required />
            </label>

            <label className="field">
              <span>Observacao</span>
              <textarea
                name="observacao"
                value={state.observacao}
                onChange={onChange}
                rows="4"
                placeholder="Observacoes do exame realizado"
              />
            </label>

            {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
          </div>

          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={state.isSaving}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={state.isSaving}>
              {state.isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
