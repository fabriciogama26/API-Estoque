import {
  CATEGORIA_OPTIONS,
  EXIGENCIA_OPTIONS,
  FAIXA_OPTIONS,
  STATUS_FILTRO_OPTIONS,
} from '../../config/ValidadesConfig.js'

function CatalogoSelect({ name, label, value, options, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        <option value="">Todos</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ValidadesFilters({ filters, requisitos, catalogos, onChange, onSubmit, onClear }) {
  const statusConhecido = STATUS_FILTRO_OPTIONS.some((item) => item.value === filters.status)

  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={onSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input name="termo" value={filters.termo} onChange={onChange} placeholder="Nome, matricula ou requisito" />
        </label>

        <label className="field">
          <span>Requisito</span>
          <select name="requisito_id" value={filters.requisito_id} onChange={onChange}>
            <option value="">Todos</option>
            {requisitos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo ? `${item.codigo} - ${item.nome}` : item.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Categoria</span>
          <select name="categoria" value={filters.categoria} onChange={onChange}>
            <option value="">Todas</option>
            {CATEGORIA_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={onChange}>
            {STATUS_FILTRO_OPTIONS.map((item) => (
              <option key={item.value || 'todos'} value={item.value}>
                {item.label}
              </option>
            ))}
            {!statusConhecido ? <option value={filters.status}>{filters.status}</option> : null}
          </select>
        </label>

        <label className="field">
          <span>Exigencia</span>
          <select name="exigencia" value={filters.exigencia} onChange={onChange}>
            {EXIGENCIA_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <CatalogoSelect name="cargo_id" label="Cargo" value={filters.cargo_id} options={catalogos.cargos} onChange={onChange} />
        <CatalogoSelect name="setor_id" label="Setor" value={filters.setor_id} options={catalogos.setores} onChange={onChange} />
        <CatalogoSelect
          name="centro_servico_id"
          label="Centro de servico (unidade)"
          value={filters.centro_servico_id}
          options={catalogos.centrosServico}
          onChange={onChange}
        />
        <CatalogoSelect
          name="centro_custo_id"
          label="Centro de custo"
          value={filters.centro_custo_id}
          options={catalogos.centrosCusto}
          onChange={onChange}
        />

        <label className="field">
          <span>Vence em</span>
          <select name="faixa" value={filters.faixa} onChange={onChange}>
            <option value="">Qualquer prazo</option>
            {FAIXA_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Vencimento de</span>
          <input type="date" name="vencimento_de" value={filters.vencimento_de} onChange={onChange} />
        </label>

        <label className="field">
          <span>Vencimento ate</span>
          <input type="date" name="vencimento_ate" value={filters.vencimento_ate} onChange={onChange} />
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
    </section>
  )
}
