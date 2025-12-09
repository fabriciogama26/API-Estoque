export function PessoasForm({
  form,
  onChange,
  onSubmit,
  isSaving,
  editingPessoa,
  onCancel,
  error,
  options = {},
}) {
  const normalizeValue = (valor) => (typeof valor === 'string' ? valor.trim() : '')

  const toOptionList = (lista, atual, transform) => {
    const map = new Map()
    if (Array.isArray(lista)) {
      lista.forEach((item) => {
        if (typeof item === 'string') {
          const value = normalizeValue(item)
          if (value) {
            const finalValue = transform ? transform(value) : value
            if (finalValue && !map.has(finalValue)) {
              map.set(finalValue, finalValue)
            }
          }
          return
        }
        if (item && typeof item === 'object' && typeof item.nome === 'string') {
          const value = normalizeValue(item.nome)
          if (value) {
            const finalValue = transform ? transform(value) : value
            if (finalValue && !map.has(finalValue)) {
              map.set(finalValue, finalValue)
            }
          }
        }
      })
    }
    const atualNormalizado = normalizeValue(atual)
    if (atualNormalizado) {
      const finalValue = transform ? transform(atualNormalizado) : atualNormalizado
      if (finalValue && !map.has(finalValue)) {
        map.set(finalValue, finalValue)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  const centrosServicoOptions = toOptionList(options.centrosServico, form.centroServico)
  const setoresOptions = toOptionList(options.setores, form.setor)
  const cargosOptions = toOptionList(options.cargos, form.cargo)
  const tiposExecucaoOptions = toOptionList(
    options.tiposExecucao,
    form.tipoExecucao,
    (valor) => normalizeValue(valor).toUpperCase(),
  )

  return (
    <section className="card">
      <header className="card__header">
        <h2>Cadastro de pessoa</h2>
      </header>
      <form className={`form${editingPessoa ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid">
        <label className="field">
          <span>Nome <span className="asterisco">*</span></span>
          <input name="nome" value={form.nome} onChange={onChange} required placeholder="Joao Silva" />
        </label>
        <label className="field">
          <span>Matricula <span className="asterisco">*</span></span>
          <input name="matricula" value={form.matricula} onChange={onChange} required placeholder="12345" />
        </label>
        <label className="field">
          <span>Centro de servico <span className="asterisco">*</span></span>
          <select
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            required
          >
            <option value="">Selecione o centro de servico</option>
            {centrosServicoOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Setor <span className="asterisco">*</span></span>
          <select name="setor" value={form.setor} onChange={onChange} required>
            <option value="">Selecione o setor</option>
            {setoresOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <select name="cargo" value={form.cargo} onChange={onChange} required>
            <option value="">Selecione o cargo</option>
            {cargosOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Data de admissao</span>
          <input
            type="date"
            name="dataAdmissao"
            value={form.dataAdmissao}
            onChange={onChange}
            placeholder="2025-01-01"
          />
        </label>
        <label className="field">
          <span>Tipo Execucao <span className="asterisco">*</span></span>
          <select name="tipoExecucao" value={form.tipoExecucao} onChange={onChange} required>
            <option value="">Selecione o tipo de execucao</option>
            {tiposExecucaoOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {editingPessoa ? (
        <div className="pessoas-form__status">
          <label className="field field--checkbox">
            <input
              type="checkbox"
              name="ativo"
              checked={form.ativo !== false}
              onChange={onChange}
            />
            <span>Manter colaborador ativo nos cálculos e dashboards</span>
          </label>
          <p className="field__hint">
            Pessoas inativas continuam visíveis na lista, mas deixam de aparecer nas métricas.
          </p>
        </div>
      ) : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingPessoa ? 'Salvar alteracoes' : 'Salvar pessoa'}
        </button>
        {editingPessoa ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
      </form>
    </section>
  )
}
