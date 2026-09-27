import { describePreviaVencimento, todayLocalKey } from '../../utils/validadesUtils.js'

export function ValidadeRegistroForm({
  registro,
  requisitos,
  previa,
  isSaving,
  feedback,
  conflito,
  podeRenovar,
  pessoaBusca,
  pessoaSugestoes,
  pessoaBuscando,
  pessoaDropdownOpen,
  onChange,
  onPessoaInputChange,
  onPessoaSelect,
  onPessoaFocus,
  onPessoaBlur,
  onSubmit,
  onCancel,
  onRenovarConflito,
}) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Registrar realizacao</h2>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field autocomplete">
            <span>
              Colaborador <span className="asterisco">*</span>
            </span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={pessoaBusca}
                onChange={onPessoaInputChange}
                onFocus={onPessoaFocus}
                onBlur={onPessoaBlur}
                placeholder="Digite matricula ou nome e selecione"
              />
              {pessoaDropdownOpen && !registro.pessoaId && (pessoaBuscando || pessoaSugestoes.length > 0) ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {pessoaBuscando ? <p className="autocomplete__feedback">Buscando colaboradores...</p> : null}
                  {pessoaSugestoes.map((pessoa) => (
                    <button
                      type="button"
                      key={pessoa.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onPessoaSelect(pessoa)}
                    >
                      <span className="autocomplete__primary">{pessoa.matricula || 'Sem matricula'}</span>
                      <span className="autocomplete__secondary">{pessoa.nome}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          <label className="field">
            <span>
              Requisito <span className="asterisco">*</span>
            </span>
            <select name="requisitoId" value={registro.requisitoId} onChange={onChange}>
              <option value="">Selecione</option>
              {requisitos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo ? `${item.codigo} - ${item.nome}` : item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Data de realizacao / emissao <span className="asterisco">*</span>
            </span>
            <input
              type="date"
              name="dataRealizacao"
              value={registro.dataRealizacao}
              onChange={onChange}
              max={todayLocalKey()}
            />
          </label>

          <label className="field field--accent">
            <span>Vencimento</span>
            <input
              value={registro.requisitoId && registro.dataRealizacao ? describePreviaVencimento(previa) : ''}
              readOnly
              disabled
              placeholder="Calculado pelo sistema"
            />
          </label>

          <label className="field">
            <span>Numero do certificado / documento</span>
            <input name="numeroDocumento" value={registro.numeroDocumento} onChange={onChange} />
          </label>

          <label className="field">
            <span>Instituicao / entidade emissora</span>
            <input name="entidadeEmissora" value={registro.entidadeEmissora} onChange={onChange} />
          </label>

          <label className="field field--full">
            <span>Observacao</span>
            <textarea name="observacao" value={registro.observacao} onChange={onChange} rows="2" />
          </label>
        </div>

        {conflito ? (
          <div className="validades-conflito" role="alert">
            <p>{conflito.mensagem}</p>
            {podeRenovar ? (
              <button type="button" className="button button--primary" onClick={onRenovarConflito}>
                Renovar registro vigente
              </button>
            ) : (
              <p className="data-table__muted">Solicite a renovacao a um usuario com permissao de renovar.</p>
            )}
          </div>
        ) : null}

        {feedback ? (
          <p className={`feedback ${feedback.tipo === 'error' ? 'feedback--error' : 'feedback--success'}`}>{feedback.mensagem}</p>
        ) : null}

        <div className="form__actions form__actions--split">
          <div className="form__actions-group">
            <button type="submit" className="button button--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Registrar'}
            </button>
            <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
              Limpar
            </button>
          </div>
        </div>
        <p className="data-table__muted">
          Data anterior a realizacao vigente fica guardada como historico. Para uma realizacao mais recente, use Renovar.
        </p>
      </form>
    </section>
  )
}
