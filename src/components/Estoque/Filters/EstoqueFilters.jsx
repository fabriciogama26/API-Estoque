export function EstoqueFilters({
  filters,
  centrosCusto,
  onSubmit,
  onChange,
  onClear,
}) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={onSubmit}>
        <label className="field">
          <span>Periodo inicial</span>
          <input type="month" name="periodoInicio" value={filters.periodoInicio} onChange={onChange} />
        </label>
        <label className="field">
          <span>Periodo final</span>
          <input type="month" name="periodoFim" value={filters.periodoFim} onChange={onChange} />
        </label>
        <label className="field">
          <span>Busca</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={onChange}
            placeholder="Buscar por material, fabricante, CA ou ID"
          />
        </label>
        <label className="field">
          <span>Centro de estoque</span>
          <select name="centroCusto" value={filters.centroCusto} onChange={onChange}>
            <option value="">Todos</option>
            {centrosCusto.map((centro) => (
              <option key={centro} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Estoque minimo</span>
          <input
            type="number"
            min="0"
            name="estoqueMinimo"
            value={filters.estoqueMinimo}
            onChange={onChange}
            placeholder="Mínimo configurado >= valor"
          />
        </label>
        <label className="field">
          <span>Quantidade</span>
          <input
            type="number"
            min="0"
            name="quantidadeMax"
            value={filters.quantidadeMax}
            onChange={onChange}
            placeholder="Quantidade >= valor"
          />
        </label>
        <label className="field field--checkbox field--checkbox-accent">
          <input
            type="checkbox"
            name="apenasAlertas"
            checked={Boolean(filters.apenasAlertas)}
            onChange={onChange}
          />
          <span>Apenas alertas</span>
        </label>
        <label className="field field--checkbox field--checkbox-accent">
          <input
            type="checkbox"
            name="apenasSaidas"
            checked={Boolean(filters.apenasSaidas)}
            onChange={onChange}
          />
          <span>Apenas saídas</span>
        </label>
        <label className="field field--checkbox field--checkbox-accent">
          <input
            type="checkbox"
            name="apenasZerado"
            checked={Boolean(filters.apenasZerado)}
            onChange={onChange}
          />
          <span>Apenas zerado</span>
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--primary">
            Aplicar filtros
          </button>
          <button type="button" className="button button--ghost" onClick={onClear}>
            Limpar filtros
          </button>
        </div>
      </form>
    </section>
  )
}
