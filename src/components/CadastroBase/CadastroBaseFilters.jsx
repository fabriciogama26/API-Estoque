export function CadastroBaseFilters({ filters, tableKey, tableOptions, onChange, onSubmit, onClear }) {
  return (
    <section className="card cadastro-base__filters">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={onSubmit}>
        <label className="field">
          <span>Tabela</span>
          <select name="table" value={tableKey} onChange={onChange}>
            {tableOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={onChange}
            placeholder="Digite parte do nome"
          />
        </label>

        <label className="field">
          <span>Status</span>
          <select name="ativo" value={filters.ativo} onChange={onChange}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>

        <div className="form__actions">
          <button type="submit" className="button button--ghost">
            Aplicar
          </button>
          <button type="button" className="button button--ghost" onClick={onClear}>
            Limpar
          </button>
        </div>
      </form>
    </section>
  )
}
