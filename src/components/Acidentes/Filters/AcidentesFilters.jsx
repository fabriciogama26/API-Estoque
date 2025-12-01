import { useAcidentesContext } from '../../../context/AcidentesContext.jsx'

export function AcidentesFilters() {
  const {
    filters,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    tiposFiltro: tipos,
    centrosServico,
    agentesFiltro: agentes,
  } = useAcidentesContext()

  const handleCheckboxChange = (name) => (event) => {
    handleFilterChange({
      target: {
        name,
        value: event.target.checked,
      },
    })
  }

  return (
    <form className="form form--inline" onSubmit={handleFilterSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={handleFilterChange}
          placeholder="Nome, matricula, centro de servico"
        />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select name="tipo" value={filters.tipo} onChange={handleFilterChange}>
          <option value="todos">Todos</option>
          {tipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Centro de servico</span>
        <select name="centroServico" value={filters.centroServico} onChange={handleFilterChange}>
          <option value="todos">Todos</option>
          {centrosServico.map((centro) => (
            <option key={centro} value={centro}>
              {centro}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Agente</span>
        <select name="agente" value={filters.agente} onChange={handleFilterChange}>
          <option value="todos">Todos</option>
          {agentes.map((agente) => (
            <option key={agente} value={agente}>
              {agente}
            </option>
          ))}
        </select>
      </label>
      <label className="acidentes-filter-pill">
        <input
          type="checkbox"
          className="acidentes-filter-pill__checkbox"
          name="apenasSesmt"
          checked={Boolean(filters.apenasSesmt)}
          onChange={handleCheckboxChange('apenasSesmt')}
        />
        <span>Apenas SESMT</span>
      </label>
      <label className="acidentes-filter-pill">
        <input
          type="checkbox"
          className="acidentes-filter-pill__checkbox"
          name="apenasEsocial"
          checked={Boolean(filters.apenasEsocial)}
          onChange={handleCheckboxChange('apenasEsocial')}
        />
        <span>Apenas eSOCIAL</span>
      </label>
      <div className="form__actions">
        <button type="submit" className="button button--ghost">
          Aplicar
        </button>
        <button type="button" className="button button--ghost" onClick={handleFilterClear}>
          Limpar
        </button>
      </div>
    </form>
  )
}
