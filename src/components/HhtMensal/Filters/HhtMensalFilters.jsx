export function HhtMensalFilters({
  filters,
  centrosServico = [],
  onChange,
  onSubmit,
  onClear,
  isLoading = false,
}) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.()
  }

  const handleInputChange = (field) => (event) => {
    onChange?.(field, event.target.value)
  }

  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Mes inicio</span>
          <input
            type="month"
            name="mesInicio"
            value={filters.mesInicio ?? ''}
            onChange={handleInputChange('mesInicio')}
            disabled={isLoading}
          />
        </label>

        <label className="field">
          <span>Mes fim</span>
          <input
            type="month"
            name="mesFim"
            value={filters.mesFim ?? ''}
            onChange={handleInputChange('mesFim')}
            disabled={isLoading}
          />
        </label>

        <label className="field">
          <span>Centro de servico</span>
          <select
            name="centroServicoId"
            value={filters.centroServicoId ?? ''}
            onChange={handleInputChange('centroServicoId')}
            disabled={isLoading}
          >
            <option value="">{isLoading ? 'Carregando...' : 'Todos'}</option>
            {(Array.isArray(centrosServico) ? centrosServico : []).map((centro) => (
              <option key={centro.id ?? centro.value ?? centro.nome} value={centro.id ?? centro.value ?? ''}>
                {centro.nome ?? centro.label ?? centro.descricao ?? centro.value}
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
