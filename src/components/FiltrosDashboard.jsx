import PropTypes from 'prop-types'

export function FiltrosDashboard({
  filters,
  anos,
  unidades,
  onChange,
  onSubmit,
  onReset,
  isLoading,
}) {
  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Ano</span>
        {anos?.length ? (
          <select name="ano" value={filters.ano} onChange={onChange} disabled={isLoading}>
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            name="ano"
            value={filters.ano}
            onChange={onChange}
            placeholder="AAAA"
            disabled={isLoading}
          />
        )}
      </label>

      <label className="field">
        <span>Unidade</span>
        <select
          name="unidade"
          value={filters.unidade}
          onChange={onChange}
          disabled={isLoading}
        >
          <option value="todas">Todas</option>
          {unidades?.map((unidade) => {
            const value = typeof unidade === 'object' && unidade !== null ? unidade.id ?? unidade.value ?? unidade.nome : unidade
            const label = typeof unidade === 'object' && unidade !== null ? unidade.nome ?? unidade.label ?? value : unidade
            return (
              <option key={value} value={value}>
                {label}
              </option>
            )
          })}
        </select>
      </label>

      <div className="form__actions">
        <button type="submit" className="button button--ghost" disabled={isLoading}>
          {isLoading ? 'Carregando...' : 'Aplicar'}
        </button>
        <button type="button" className="button button--ghost" onClick={onReset} disabled={isLoading}>
          Limpar
        </button>
      </div>
    </form>
  )
}

FiltrosDashboard.propTypes = {
  filters: PropTypes.shape({
    ano: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    unidade: PropTypes.string,
  }).isRequired,
  anos: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  unidades: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
}

FiltrosDashboard.defaultProps = {
  anos: undefined,
  unidades: undefined,
  isLoading: false,
}
