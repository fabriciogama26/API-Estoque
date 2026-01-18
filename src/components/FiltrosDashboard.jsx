import PropTypes from 'prop-types'

export function FiltrosDashboard({ filters, options, onChange, onSubmit, onReset, className }) {
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

    if (Array.isArray(lista)) {
      lista.forEach(addValue)
    }
    if (atual) {
      addValue(atual)
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }

  const centrosServicoOptions = buildOptionsWithCurrent(centrosServico, filters.centroServico)
  const tiposOptions = buildOptionsWithCurrent(tipos, filters.tipo)
  const lesoesOptions = buildOptionsWithCurrent(lesoes, filters.lesao)
  const partesLesionadasLista = buildOptionsWithCurrent(partesLesionadasOptions, filters.parteLesionada)
  const agentesOptions = buildOptionsWithCurrent(agentes, filters.agente)
  const cargosOptions = buildOptionsWithCurrent(cargos, filters.cargo)

  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
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
            />
          </label>

          <label className="field">
            <span>Centro de servico</span>
            <select name="centroServico" value={filters.centroServico ?? ''} onChange={onChange}>
              <option value="">Todos</option>
              {centrosServicoOptions.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tipo</span>
            <select name="tipo" value={filters.tipo ?? ''} onChange={onChange}>
              <option value="">Todos</option>
              {tiposOptions.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Lesao</span>
            <select name="lesao" value={filters.lesao ?? ''} onChange={onChange}>
              <option value="">Todas</option>
              {lesoesOptions.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Parte lesionada</span>
            <select name="parteLesionada" value={filters.parteLesionada ?? ''} onChange={onChange}>
              <option value="">Todas</option>
              {partesLesionadasLista.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Agente</span>
            <select name="agente" value={filters.agente ?? ''} onChange={onChange}>
              <option value="">Todos</option>
              {agentesOptions.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Cargo</span>
            <select name="cargo" value={filters.cargo ?? ''} onChange={onChange}>
              <option value="">Todos</option>
              {cargosOptions.map((value, index) => (
                <option key={`${value}-${index}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form__actions">
          <button type="submit" className="button button--primary">
            Aplicar filtros
          </button>
          <button type="button" className="button button--ghost" onClick={onReset}>
            Limpar filtros
          </button>
        </div>
      </form>
    </section>
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
}

FiltrosDashboard.defaultProps = {
  options: undefined,
  className: undefined,
}

