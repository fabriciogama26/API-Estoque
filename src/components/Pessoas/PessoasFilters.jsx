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
  const normalizeOptions = (values, current) => {
    const map = new Map()
    const addValue = (value) => {
      if (value === undefined || value === null) {
        return
      }
      const trimmed = String(value).trim()
      if (!trimmed) {
        return
      }
      const key = trimmed.toLowerCase()
      if (!map.has(key)) {
        map.set(key, trimmed)
      }
    }

    if (Array.isArray(values)) {
      values.forEach(addValue)
    }
    if (current && current !== 'todos') {
      addValue(current)
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }

  const centrosServicoOptions = normalizeOptions(centrosServico, filters.centroServico)
  const setoresOptions = normalizeOptions(setores, filters.setor)
  const cargosOptions = normalizeOptions(cargos, filters.cargo)
  const tiposExecucaoOptions = normalizeOptions(tiposExecucao, filters.tipoExecucao)
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
            {centrosServicoOptions.map((centro, index) => (
              <option key={`${centro}-${index}`} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Setor</span>
          <select name="setor" value={filters.setor} onChange={onChange}>
            <option value="todos">Todos</option>
            {setoresOptions.map((setor, index) => (
              <option key={`${setor}-${index}`} value={setor}>
                {setor}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cargo</span>
          <select name="cargo" value={filters.cargo} onChange={onChange}>
            <option value="todos">Todos</option>
            {cargosOptions.map((cargo, index) => (
              <option key={`${cargo}-${index}`} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipo de execução</span>
          <select name="tipoExecucao" value={filters.tipoExecucao} onChange={onChange}>
            <option value="todos">Todos</option>
            {tiposExecucaoOptions.map((tipo, index) => (
              <option key={`${tipo}-${index}`} value={tipo}>
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
