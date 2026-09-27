import { CATEGORIA_OPTIONS, TIPO_OPTIONS, UNIDADE_OPTIONS } from '../../config/ValidadesConfig.js'

export function RequisitoForm({
  form,
  editing,
  isSaving,
  error,
  validadeAlterada,
  podeAlterarValidade,
  onChange,
  onSubmit,
  onCancel,
}) {
  // Na edicao, a validade so pode mudar com a permissao de regras de validade.
  const validadeBloqueada = Boolean(editing) && !podeAlterarValidade

  return (
    <section className="card">
      <header className="card__header">
        <h2>{editing ? `Editar requisito: ${editing.nome}` : 'Cadastro de requisito'}</h2>
      </header>
      <form className={`form${editing ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field">
            <span>
              Nome <span className="asterisco">*</span>
            </span>
            <input name="nome" value={form.nome} onChange={onChange} placeholder="Ex.: NR-10 Basico" required />
          </label>

          <label className="field">
            <span>Codigo / sigla</span>
            <input name="codigo" value={form.codigo} onChange={onChange} placeholder="Ex.: NR10" />
          </label>

          <label className="field">
            <span>
              Categoria <span className="asterisco">*</span>
            </span>
            <select name="categoria" value={form.categoria} onChange={onChange}>
              {CATEGORIA_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Tipo (origem da exigencia) <span className="asterisco">*</span>
            </span>
            <select name="tipo" value={form.tipo} onChange={onChange}>
              {TIPO_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              name="possuiValidade"
              checked={Boolean(form.possuiValidade)}
              onChange={onChange}
              disabled={validadeBloqueada}
            />
            <span>Possui validade</span>
          </label>

          <div className="validades-validade-group">
            <label className="field">
              <span>
                Validade {form.possuiValidade ? <span className="asterisco">*</span> : null}
              </span>
              <input
                type="number"
                min="1"
                name="validadeQuantidade"
                value={form.possuiValidade ? form.validadeQuantidade : ''}
                onChange={onChange}
                disabled={!form.possuiValidade || validadeBloqueada}
                placeholder={form.possuiValidade ? 'Ex.: 24' : 'Sem validade'}
              />
            </label>
            <label className="field">
              <span>Unidade</span>
              <select
                name="validadeUnidade"
                value={form.validadeUnidade}
                onChange={onChange}
                disabled={!form.possuiValidade || validadeBloqueada}
              >
                {UNIDADE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field field--full">
            <span>Descricao</span>
            <textarea name="descricao" value={form.descricao} onChange={onChange} rows="2" />
          </label>

          <label className="field field--full">
            <span>Observacao</span>
            <textarea name="observacao" value={form.observacao} onChange={onChange} rows="2" />
          </label>

          {validadeAlterada ? (
            <label className="field field--full">
              <span>
                Motivo da alteracao da validade <span className="asterisco">*</span>
              </span>
              <textarea name="motivo" value={form.motivo} onChange={onChange} rows="2" required />
              <small className="data-table__muted">
                A nova validade vale apenas para registros e renovacoes feitos daqui em diante. Registros ja realizados
                mantem a validade com que foram cadastrados.
              </small>
            </label>
          ) : null}
        </div>

        {validadeBloqueada ? (
          <p className="data-table__muted">A validade so pode ser alterada por quem tem a permissao de regras de validade.</p>
        ) : null}
        <p className="data-table__muted">
          Vencimento = data de realizacao + periodo - 1 dia (ex.: 10/01/2024 + 24 meses vence em 09/01/2026).
        </p>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="form__actions form__actions--split">
          <div className="form__actions-group">
            <button type="submit" className="button button--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Cadastrar requisito'}
            </button>
            {editing ? (
              <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  )
}
