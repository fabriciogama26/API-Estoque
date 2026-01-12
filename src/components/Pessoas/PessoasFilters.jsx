export function PessoasFilters({
  filters,
  centrosServico = [],
  setores = [],
  cargos = [],
  tiposExecucao = [],
  onChange,
  onSubmit,
  onClear,
}) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={onSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={onChange}
            placeholder="Nome, matricula, centro de servico ou setor"
          />
        </label>
        <label className="field">
          <span>Centro de serviço</span>
          <select name="centroServico" value={filters.centroServico} onChange={onChange}>
            <option value="todos">Todos</option>
            {centrosServico.map((centro) => (
              <option key={centro} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Setor</span>
          <select name="setor" value={filters.setor} onChange={onChange}>
            <option value="todos">Todos</option>
            {setores.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cargo</span>
          <select name="cargo" value={filters.cargo} onChange={onChange}>
            <option value="todos">Todos</option>
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipo de execução</span>
          <select name="tipoExecucao" value={filters.tipoExecucao} onChange={onChange}>
            <option value="todos">Todos</option>
            {tiposExecucao.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={onChange}>
            <option value="todos">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
        <label className="field">
          <span>Cadastrado de</span>
          <input
            type="date"
            name="cadastradoInicio"
            value={filters.cadastradoInicio}
            onChange={onChange}
          />
        </label>
        <label className="field">
          <span>Cadastrado ate</span>
          <input
            type="date"
            name="cadastradoFim"
            value={filters.cadastradoFim}
            onChange={onChange}
          />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--ghost">Aplicar</button>
          <button type="button" className="button button--ghost" onClick={onClear}>
            Limpar
          </button>
        </div>
      </form>
    </section>
  )
}
