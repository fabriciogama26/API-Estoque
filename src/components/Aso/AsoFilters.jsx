export function AsoFilters({
  filters,
  tiposExame,
  centrosServico,
  setores,
  cargos,
  onChange,
  onSubmit,
  onClear,
}) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={onSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={onChange}
            placeholder="Buscar por nome ou matricula"
          />
        </label>

        <label className="field">
          <span>Tipo de exame</span>
          <select name="tipoExameId" value={filters.tipoExameId} onChange={onChange}>
            <option value="">Todos</option>
            {tiposExame.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={onChange}>
            <option value="">Todos</option>
            <option value="em_dia">Em dia</option>
            <option value="vence_60">Vencendo em 60 dias</option>
            <option value="vence_30">Vencendo em 30 dias</option>
            <option value="vence_15">Vencendo em 15 dias</option>
            <option value="vence_hoje">Vence hoje</option>
            <option value="vencido">Vencidos</option>
            <option value="demissional">Demissional</option>
          </select>
        </label>

        <label className="field">
          <span>Data inicial</span>
          <input type="date" name="dataInicio" value={filters.dataInicio} onChange={onChange} />
        </label>

        <label className="field">
          <span>Data final</span>
          <input type="date" name="dataFim" value={filters.dataFim} onChange={onChange} />
        </label>

        <label className="field">
          <span>Centro de servico</span>
          <select name="centroServico" value={filters.centroServico} onChange={onChange}>
            <option value="">Todos</option>
            {centrosServico.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Setor</span>
          <select name="setor" value={filters.setor} onChange={onChange}>
            <option value="">Todos</option>
            {setores.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cargo</span>
          <select name="cargo" value={filters.cargo} onChange={onChange}>
            <option value="">Todos</option>
            {cargos.map((item) => (
              <option key={item} value={item}>
                {item}
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
    </section>
  )
}
