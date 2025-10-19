import PropTypes from 'prop-types'

export function FiltrosDashboard({
  filters,
  options,
  onChange,
  onSubmit,
  onReset,
  isLoading,
  className,
}) {
  const formClassName = ['form', 'form--inline', 'form--filters']
    .concat(className ? [className] : [])
    .join(' ')

  const {
    centrosServico = [],
    tipos = [],
    lesoes = [],
    partesLesionadas: partesLesionadasOptions = [],
    agentes = [],
    cargos = [],
  } = options || {}

  const buildOptionsWithCurrent = (lista = [], atual) => {
    const items = Array.isArray(lista) ? lista.slice() : []
    if (atual && !items.includes(atual)) {
      items.push(atual)
    }
    return items.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }

  const centrosServicoOptions = buildOptionsWithCurrent(centrosServico, filters.centroServico)
  const tiposOptions = buildOptionsWithCurrent(tipos, filters.tipo)
  const lesoesOptions = buildOptionsWithCurrent(lesoes, filters.lesao)
  const partesLesionadasLista = buildOptionsWithCurrent(partesLesionadasOptions, filters.parteLesionada)
  const agentesOptions = buildOptionsWithCurrent(agentes, filters.agente)
  const cargosOptions = buildOptionsWithCurrent(cargos, filters.cargo)

  return (
    <form className={formClassName} onSubmit={onSubmit}>
      <div className="form__grid form--filters__grid">
        <label className="field">
          <span>Periodo inicial</span>
          <input
            type="month"
            name="periodoInicio"
            value={filters.periodoInicio ?? ''}
            onChange={onChange}
            max={filters.periodoFim || undefined}
            disabled={isLoading}
          />
        </label>

        <label className="field">
          <span>Periodo final</span>
          <input
            type="month"
            name="periodoFim"
            value={filters.periodoFim ?? ''}
            onChange={onChange}
            min={filters.periodoInicio || undefined}
            disabled={isLoading}
          />
        </label>

        <label className="field">
          <span>Centro de servico</span>
          <select
            name="centroServico"
            value={filters.centroServico ?? ''}
            onChange={onChange}
            disabled={isLoading}
          >
            <option value="">Todos</option>
            {centrosServicoOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tipo</span>
          <select name="tipo" value={filters.tipo ?? ''} onChange={onChange} disabled={isLoading}>
            <option value="">Todos</option>
            {tiposOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Lesao</span>
          <select name="lesao" value={filters.lesao ?? ''} onChange={onChange} disabled={isLoading}>
            <option value="">Todas</option>
            {lesoesOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Parte lesionada</span>
          <select
            name="parteLesionada"
            value={filters.parteLesionada ?? ''}
            onChange={onChange}
            disabled={isLoading}
          >
            <option value="">Todas</option>
            {partesLesionadasLista.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Agente</span>
          <select name="agente" value={filters.agente ?? ''} onChange={onChange} disabled={isLoading}>
            <option value="">Todos</option>
            {agentesOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cargo</span>
          <select name="cargo" value={filters.cargo ?? ''} onChange={onChange} disabled={isLoading}>
            <option value="">Todos</option>
            {cargosOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isLoading}>
          {isLoading ? 'Filtrando...' : 'Aplicar filtros'}
        </button>
        <button type="button" className="button button--ghost" onClick={onReset} disabled={isLoading}>
          Limpar filtros
        </button>
      </div>
    </form>
  )
}

FiltrosDashboard.propTypes = {
  filters: PropTypes.shape({
    periodoInicio: PropTypes.string,
    periodoFim: PropTypes.string,
    centroServico: PropTypes.string,
    tipo: PropTypes.string,
    lesao: PropTypes.string,
    parteLesionada: PropTypes.string,
    agente: PropTypes.string,
    cargo: PropTypes.string,
  }).isRequired,
  options: PropTypes.shape({
    centrosServico: PropTypes.arrayOf(PropTypes.string),
    tipos: PropTypes.arrayOf(PropTypes.string),
    lesoes: PropTypes.arrayOf(PropTypes.string),
    partesLesionadas: PropTypes.arrayOf(PropTypes.string),
    agentes: PropTypes.arrayOf(PropTypes.string),
    cargos: PropTypes.arrayOf(PropTypes.string),
  }),
  className: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
}

FiltrosDashboard.defaultProps = {
  options: undefined,
  className: undefined,
  isLoading: false,
}
