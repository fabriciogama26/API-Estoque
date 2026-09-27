import { formatNumber } from '../../utils/validadesUtils.js'

function CatalogoSelect({ name, label, value, options, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        <option value="">Qualquer</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    </label>
  )
}

export function RequisitoRegrasModal({
  state,
  catalogos,
  podeGerenciar,
  pessoaBusca,
  pessoaSugestoes,
  pessoaBuscando,
  onClose,
  onChange,
  onSubmit,
  onRemover,
  onPessoaBuscaChange,
  onPessoaSelect,
}) {
  if (!state.open || !state.requisito) {
    return null
  }

  const { form } = state

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="entradas-history__modal validades-modal--wide" onClick={(event) => event.stopPropagation()}>
        <header className="entradas-history__header">
          <div>
            <h3>Aplicabilidade: {state.requisito.nome}</h3>
            <p className="entradas-history__subtitle">
              Quem precisa deste requisito. Criterios de uma mesma regra combinam entre si (E); regras diferentes se somam
              (OU).
            </p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </header>

        <div className="entradas-history__body validades-modal__body">
          {state.isLoading ? <p className="feedback">Carregando regras...</p> : null}

          {!state.isLoading && !state.regras.length ? (
            <p className="feedback">Nenhuma regra ativa: este requisito ainda nao e exigido de ninguem.</p>
          ) : null}

          {state.regras.length ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Regra</th>
                    <th>Colaboradores ativos</th>
                    <th>Criada por</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {state.regras.map((regra) => (
                    <tr key={regra.id}>
                      <td>{regra.descricao}</td>
                      <td>{formatNumber(regra.afetados)}</td>
                      <td>{regra.criado_por_nome || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => onRemover(regra)}
                          disabled={!podeGerenciar}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {podeGerenciar ? (
            <form className="validades-regra-form" onSubmit={onSubmit}>
              <h4>Nova regra</h4>
              <div className="form__grid form__grid--two">
                <CatalogoSelect name="cargo_id" label="Cargo / funcao" value={form.cargo_id} options={catalogos.cargos} onChange={onChange} />
                <CatalogoSelect name="setor_id" label="Setor" value={form.setor_id} options={catalogos.setores} onChange={onChange} />
                <CatalogoSelect
                  name="centro_servico_id"
                  label="Centro de servico (unidade)"
                  value={form.centro_servico_id}
                  options={catalogos.centrosServico}
                  onChange={onChange}
                />
                <CatalogoSelect
                  name="centro_custo_id"
                  label="Centro de custo"
                  value={form.centro_custo_id}
                  options={catalogos.centrosCusto}
                  onChange={onChange}
                />
                <label className="field autocomplete field--full">
                  <span>Colaborador especifico (opcional)</span>
                  <div className="autocomplete__control">
                    <input
                      className="autocomplete__input"
                      value={pessoaBusca}
                      onChange={onPessoaBuscaChange}
                      placeholder="Digite matricula ou nome"
                    />
                    {!form.pessoa_id && (pessoaBuscando || pessoaSugestoes.length > 0) ? (
                      <div className="autocomplete__dropdown" role="listbox">
                        {pessoaBuscando ? <p className="autocomplete__feedback">Buscando...</p> : null}
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
              </div>

              <p className="data-table__muted">
                {state.previa === null
                  ? 'Escolha ao menos um criterio para ver quantos colaboradores ativos a regra alcanca.'
                  : `Esta regra alcanca ${formatNumber(state.previa)} colaborador(es) ativo(s).`}
              </p>

              {state.error ? <p className="feedback feedback--error">{state.error}</p> : null}

              <div className="form__actions">
                <button type="submit" className="button button--primary" disabled={state.isSaving}>
                  {state.isSaving ? 'Salvando...' : 'Adicionar regra'}
                </button>
              </div>
            </form>
          ) : state.error ? (
            <p className="feedback feedback--error">{state.error}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
