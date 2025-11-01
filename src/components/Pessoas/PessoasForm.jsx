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
  const toOptionList = (lista, transform) => {
    const source = Array.isArray(lista) ? lista : []
    const mapped = source
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }
        if (item && typeof item === 'object' && typeof item.nome === 'string') {
          return item.nome
        }
        return ''
      })
      .map((value) => {
        const normalized = typeof value === 'string' ? value.trim() : ''
        return transform ? transform(normalized) : normalized
      })
      .filter(Boolean)
    return Array.from(new Set(mapped))
  }

  const centrosServicoOptions = toOptionList(options.centrosServico)
  const setoresOptions = toOptionList(options.setores)
  const cargosOptions = toOptionList(options.cargos)
  const tiposExecucaoOptions = toOptionList(options.tiposExecucao, (valor) => valor.toUpperCase())

  const datalistIds = {
    centrosServico: 'pessoas-centros-servico-options',
    setores: 'pessoas-setores-options',
    cargos: 'pessoas-cargos-options',
    tiposExecucao: 'pessoas-tipos-execucao-options',
  }

  return (
    <form className="form" onSubmit={onSubmit}>
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
          <input
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            required
            placeholder="Ex: Operacao"
            list={datalistIds.centrosServico}
            autoComplete="off"
            title={form.centroServico}
          />
        </label>
        <label className="field">
          <span>Setor <span className="asterisco">*</span></span>
          <input
            name="setor"
            value={form.setor}
            onChange={onChange}
            required
            placeholder="Ex: Almoxarifado"
            list={datalistIds.setores}
            autoComplete="off"
            title={form.setor}
          />
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <input
            name="cargo"
            value={form.cargo}
            onChange={onChange}
            required
            placeholder="Tecnico de manutencao"
            list={datalistIds.cargos}
            autoComplete="off"
            title={form.cargo}
          />
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
          <input
            name="tipoExecucao"
            value={form.tipoExecucao}
            onChange={onChange}
            required
            placeholder="Ex: Proprio, Terceirizado"
            list={datalistIds.tiposExecucao}
            autoComplete="off"
            title={form.tipoExecucao}
          />
        </label>
      </div>
      <datalist id={datalistIds.centrosServico}>
        {centrosServicoOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id={datalistIds.setores}>
        {setoresOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id={datalistIds.cargos}>
        {cargosOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id={datalistIds.tiposExecucao}>
        {tiposExecucaoOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
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
  )
}
