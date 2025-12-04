// Filtros para a lista de materiais
export function MateriaisFilters({
  filters,
  grupos = [],
  tamanhos = [],
  fabricantes = [],
  caracteristicas = [],
  cores = [],
  onChange,
  onSubmit,
  onClear,
}) {
  const renderOptions = (lista) =>
    lista.map((item) => {
      const valueRaw = item?.id ?? item?.valor ?? item?.value ?? item?.nome ?? item?.label ?? item
      const value = valueRaw === null || valueRaw === undefined ? '' : String(valueRaw)
      const label =
        item?.nome ?? item?.label ?? item?.valor ?? item?.value ?? value
      const chave = `${label}-${value}`
      return (
        <option key={chave} value={value}>
          {label}
        </option>
      )
    })

  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={onChange}
          placeholder="EPI, fabricante, grupo ou CA"
        />
      </label>
      <label className="field">
        <span>Grupo</span>
        <select name="grupo" value={filters.grupo} onChange={onChange}>
          <option value="">Todos</option>
          {renderOptions(grupos)}
        </select>
      </label>
      <label className="field">
        <span>Tamanho/Número</span>
        <select name="tamanho" value={filters.tamanho} onChange={onChange}>
          <option value="">Todos</option>
          {renderOptions(tamanhos)}
        </select>
      </label>
      <label className="field">
        <span>Fabricante</span>
        <select name="fabricante" value={filters.fabricante} onChange={onChange}>
          <option value="">Todos</option>
          {renderOptions(fabricantes)}
        </select>
      </label>
      <label className="field">
        <span>Características</span>
        <select name="caracteristica" value={filters.caracteristica} onChange={onChange}>
          <option value="">Todas</option>
          {renderOptions(caracteristicas)}
        </select>
      </label>
      <label className="field">
        <span>Cores</span>
        <select name="cor" value={filters.cor} onChange={onChange}>
          <option value="">Todas</option>
          {renderOptions(cores)}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" value={filters.status} onChange={onChange}>
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </label>
      <label className="field">
        <span>Valor unitário (mín.)</span>
        <input
          type="number"
          name="valorMin"
          min="0"
          step="0.01"
          value={filters.valorMin}
          onChange={onChange}
          placeholder="Ex.: 10"
        />
      </label>
      <label className="field">
        <span>Valor unitário (máx.)</span>
        <input
          type="number"
          name="valorMax"
          min="0"
          step="0.01"
          value={filters.valorMax}
          onChange={onChange}
          placeholder="Ex.: 100"
        />
      </label>
      <div className="form__actions">
        <button type="submit" className="button button--ghost">Aplicar</button>
        <button type="button" className="button button--ghost" onClick={onClear}>
          Limpar
        </button>
      </div>
    </form>
  )
}
