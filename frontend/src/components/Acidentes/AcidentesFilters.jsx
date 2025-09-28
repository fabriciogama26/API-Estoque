export function AcidentesFilters({ filters, tipos, setores, agentes, onChange, onSubmit, onClear }) {
  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={onChange}
          placeholder="Nome, matricula, setor"
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
        <span>Setor</span>
        <select name="setor" value={filters.setor} onChange={onChange}>
          <option value="todos">Todos</option>
          {setores.map((setor) => (
            <option key={setor} value={setor}>
              {setor}
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
