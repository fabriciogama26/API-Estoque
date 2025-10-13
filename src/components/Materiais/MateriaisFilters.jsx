// Filtros para a lista de materiais
export function MateriaisFilters({ filters, onChange, onSubmit, onClear }) {
  return (
    <form className="form form--inline" onSubmit={onSubmit}>
      <label className="field">
        <span>Buscar</span>
        <input
          name="termo"
          value={filters.termo}
          onChange={onChange}
          placeholder="EPI, fabricante, grupo ou CA"
        />
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" value={filters.status} onChange={onChange}>
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
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
