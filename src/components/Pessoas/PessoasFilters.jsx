export function PessoasFilters({ filters, locais, cargos, onChange, onSubmit, onClear }) {
  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={onChange}
          placeholder="Nome, matricula, local"
        />
      </label>
      <label className="field">
        <span>Local</span>
        <select name="local" value={filters.local} onChange={onChange}>
          <option value="todos">Todos</option>
          {locais.map((local) => (
            <option key={local} value={local}>
              {local}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Cargo</span>
        <select name="cargo" value={filters.cargo} onChange={onChange}>
          <option value="todos">Todos</option>
          {cargos.map((cargo) => (
            <option key={cargo} value={cargo}>
              {cargo}
            </option>
          ))}
        </select>
      </label>
      <div className="form__actions">
        <button type="submit" className="button button--ghost">Aplicar</button>
        <button type="button" className="button button--ghost" onClick={onClear}>
          Limpar
        </button>
      </div>
    </form>
  )
}
