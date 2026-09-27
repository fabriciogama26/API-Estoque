import { describePreviaVencimento, formatDate, formatValidade, todayLocalKey } from '../../utils/validadesUtils.js'

export function ValidadeAcaoModal({ state, onClose, onChange, onSubmit }) {
  if (!state.open || !state.item) {
    return null
  }

  const { item, form, modo } = state
  const renovando = modo === 'renovar'

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" onClick={state.isSaving ? undefined : onClose}>
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>{renovando ? 'Renovar' : 'Editar registro'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar" disabled={state.isSaving}>
            x
          </button>
        </header>

        <form onSubmit={onSubmit}>
          <div className="modal__body validades-modal__body">
            <label className="field field--accent">
              <span>Colaborador / requisito</span>
              <input value={`${item.pessoa_nome || '-'} - ${item.requisito_nome || '-'}`} readOnly disabled />
            </label>

            {item.data_realizacao ? (
              <p className="data-table__muted">
                Realizacao atual: {formatDate(item.data_realizacao)}
                {item.data_vencimento ? ` | vence em ${formatDate(item.data_vencimento)}` : ''}
              </p>
            ) : null}

            {renovando ? (
              <p className="data-table__muted">
                O registro atual e preservado no historico. O novo registro usa a validade vigente do requisito e inicia um
                novo ciclo de alertas.
              </p>
            ) : (
              <p className="data-table__muted">
                O vencimento e recalculado com a validade original deste registro ({formatValidade(item)}), mesmo que o
                requisito tenha mudado depois.
              </p>
            )}

            <label className="field">
              <span>
                {renovando ? 'Data da nova realizacao' : 'Data de realizacao'} <span className="asterisco">*</span>
              </span>
              <input
                type="date"
                name="data_realizacao"
                value={form.data_realizacao}
                onChange={onChange}
                max={todayLocalKey()}
                required
              />
            </label>

            {renovando && form.data_realizacao ? (
              <label className="field field--accent">
                <span>Novo vencimento</span>
                <input value={describePreviaVencimento(state.previa)} readOnly disabled />
              </label>
            ) : null}

            <label className="field">
              <span>Numero do certificado / documento</span>
              <input name="numero_documento" value={form.numero_documento} onChange={onChange} />
            </label>

            <label className="field">
              <span>Instituicao / entidade emissora</span>
              <input name="entidade_emissora" value={form.entidade_emissora} onChange={onChange} />
            </label>

            <label className="field">
              <span>Observacao</span>
              <textarea name="observacao" value={form.observacao} onChange={onChange} rows="2" />
            </label>

            {!renovando ? (
              <label className="field">
                <span>
                  Motivo da edicao <span className="asterisco">*</span>
                </span>
                <textarea name="motivo" value={form.motivo} onChange={onChange} rows="2" required />
              </label>
            ) : null}

            {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}
          </div>

          <footer className="modal__footer">
            <button type="button" className="button button--ghost" onClick={onClose} disabled={state.isSaving}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={state.isSaving}>
              {state.isSaving ? 'Salvando...' : renovando ? 'Confirmar renovacao' : 'Salvar edicao'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
