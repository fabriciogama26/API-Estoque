import { formatDate } from '../../utils/asoUtils.js'

export function AsoForm({
  form,
  tiposExame,
  editingAso,
  isSaving,
  error,
  pessoaSearchValue,
  pessoaSuggestions,
  pessoaDropdownOpen,
  isSearchingPessoas,
  pessoaSearchError,
  onPessoaInputChange,
  onPessoaSelect,
  onPessoaFocus,
  onPessoaBlur,
  onChange,
  onSubmit,
  onCancel,
  onOpenImportMass,
}) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Cadastro de ASO</h2>
      </header>
      <form className={`form${editingAso ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field autocomplete">
            <span>Matricula <span className="asterisco">*</span></span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={pessoaSearchValue}
                onChange={onPessoaInputChange}
                onFocus={onPessoaFocus}
                onBlur={onPessoaBlur}
                placeholder="Digite a matricula e selecione"
                required
              />
              {pessoaDropdownOpen && (isSearchingPessoas || pessoaSearchError || pessoaSuggestions.length > 0) ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingPessoas ? <p className="autocomplete__feedback">Buscando funcionarios...</p> : null}
                  {!isSearchingPessoas && pessoaSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{pessoaSearchError}</p>
                  ) : null}
                  {!isSearchingPessoas && !pessoaSearchError && pessoaSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhuma matricula encontrada.</p>
                  ) : null}
                  {pessoaSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onPessoaSelect(item)}
                    >
                      <span className="autocomplete__primary">{item.matricula || 'Sem matricula'}</span>
                      <span className="autocomplete__secondary">{item.nome || 'Nome nao informado'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          <label className="field field--accent">
            <span>Nome</span>
            <input name="nome" value={form.nome} readOnly disabled placeholder="Nome preenchido automaticamente" />
          </label>

          <label className="field">
            <span>Tipo de exame <span className="asterisco">*</span></span>
            <select name="tipoExameId" value={form.tipoExameId} onChange={onChange} required>
              <option value="">Selecione</option>
              {tiposExame.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Data do exame <span className="asterisco">*</span></span>
            <input type="date" name="dataExame" value={form.dataExame} onChange={onChange} required />
          </label>

          <label className="field field--accent">
            <span>Proximo ao vencimento</span>
            <input
              name="proximoVencimento"
              value={form.proximoVencimento ? formatDate(form.proximoVencimento) : ''}
              readOnly
              disabled
              placeholder="Calculado automaticamente"
            />
          </label>

          <label className="field field--full">
            <span>Observacao</span>
            <textarea
              name="observacao"
              value={form.observacao}
              onChange={onChange}
              rows="4"
              placeholder="Observacoes do exame"
            />
          </label>
        </div>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="form__actions form__actions--split">
          <div className="form__actions-group">
            <button type="submit" className="button button--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : editingAso ? 'Salvar alteracoes' : 'Cadastrar'}
            </button>
            {!editingAso ? (
              <button type="button" className="button button--ghost" onClick={onOpenImportMass} disabled={isSaving}>
                Cadastrar em massa
              </button>
            ) : null}
            {editingAso ? (
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
