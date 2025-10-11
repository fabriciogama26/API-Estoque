export function AcidentesFilters({ filters, tipos, centrosServico, agentes, onChange, onSubmit, onClear }) {
  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={onChange}
          placeholder="Nome, matricula, centro de servico"
        />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select name="tipo" value={filters.tipo} onChange={onChange}>
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
        <select name="centroServico" value={filters.centroServico} onChange={onChange}>
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
        <select name="agente" value={filters.agente} onChange={onChange}>
          <option value="todos">Todos</option>
          {agentes.map((agente) => (
            <option key={agente} value={agente}>
              {agente}
            </option>
          ))}
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
  )
}
