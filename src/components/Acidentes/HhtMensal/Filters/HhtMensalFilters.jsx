export function HhtMensalFilters({ filters, centrosServico, onChange, onSubmit, onClear, isLoading }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit()
  }

  const handleInput = (field) => (event) => {
    onChange(field, event.target.value)
  }

  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Mes inicio</span>
          <input type="month" value={filters.mesInicio} onChange={handleInput('mesInicio')} disabled={isLoading} />
        </label>

        <label className="field">
          <span>Mes fim</span>
          <input type="month" value={filters.mesFim} onChange={handleInput('mesFim')} disabled={isLoading} />
        </label>

        <label className="field">
          <span>Centro de servico</span>
          <select
            value={filters.centroServicoId}
            onChange={handleInput('centroServicoId')}
            disabled={isLoading}
          >
            <option value="">Todos</option>
            {(centrosServico ?? []).map((centro) => (
              <option key={centro.id} value={centro.id}>
                {centro.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="form__actions">
          <button type="submit" className="button button--ghost" disabled={isLoading}>
            Aplicar
          </button>
          <button type="button" className="button button--ghost" onClick={onClear} disabled={isLoading}>
            Limpar
          </button>
        </div>
      </form>
    </section>
  )
}
