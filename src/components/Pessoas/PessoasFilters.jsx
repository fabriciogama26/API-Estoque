export function PessoasFilters({ filters, centrosServico, cargos, onChange, onSubmit, onClear }) {
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
