import { formatDisplayDateTime } from '../../utils/saidasUtils.js'

const TABLE_FIELD_LABELS = {
  fabricantes: {
    fabricante: 'Fabricante',
    ativo: 'Status',
  },
  cargos: {
    nome: 'Cargo',
    ativo: 'Status',
  },
  centros_custo: {
    nome: 'Centro de custo',
    ativo: 'Status',
  },
  centros_servico: {
    nome: 'Centro de servico',
    centro_custo_id: 'Centro de custo',
    ativo: 'Status',
  },
  centros_estoque: {
    almox: 'Centro de estoque',
    centro_custo: 'Centro de custo',
    ativo: 'Status',
  },
  setores: {
    nome: 'Setor',
    centro_servico_id: 'Centro de servico',
    ativo: 'Status',
  },
}

const formatValue = (value, field, maps = {}) => {
  if (field === 'ativo') {
    return value === false ? 'Inativo' : 'Ativo'
  }
  if (field === 'centro_custo_id' || field === 'centro_custo') {
    return maps.centrosCustoMap?.get?.(value) || value || '-'
  }
  if (field === 'centro_servico_id') {
    return maps.centrosServicoMap?.get?.(value) || value || '-'
  }
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Nao'
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (_err) {
      return String(value)
    }
  }
  return String(value)
}

const buildChanges = (registro, maps) => {
  const fields = Array.isArray(registro.changed_fields) ? registro.changed_fields : []
  const before = registro.before || {}
  const after = registro.after || {}
  return fields.map((field) => ({
    field,
    before: formatValue(before?.[field], field, maps),
    after: formatValue(after?.[field], field, maps),
  }))
}

const resolveFieldLabel = (table, field) => {
  const labels = TABLE_FIELD_LABELS[table] || {}
  return labels[field] || field
}

export function CadastroBaseHistoryTimeline({ registros = [], centrosCustoMap, centrosServicoMap }) {
  const maps = { centrosCustoMap, centrosServicoMap }
  return (
    <div className="cadastro-base__history-list">
      {registros.map((registro) => {
        const changes = buildChanges(registro, maps)
        const action = (registro.action || '').toString().toUpperCase()
        const emptyLabel =
          action === 'INSERT'
            ? 'Registro criado.'
            : action === 'DELETE'
              ? 'Registro removido.'
              : 'Sem alteracoes registradas.'
        return (
          <div key={registro.id} className="cadastro-base__history-item">
          <div className="cadastro-base__history-header">
            <strong>{registro.action}</strong>
            <span>{formatDisplayDateTime(registro.created_at)}</span>
          </div>
          <p className="cadastro-base__history-meta">
            {registro.changedByUserName || registro.changed_by_user_name || registro.changed_by_user_id || 'Nao informado'}
          </p>
          <div className="cadastro-base__history-fields">
            {changes.length ? (
              changes.map((change) => (
                <div key={`${registro.id}-${change.field}`} className="cadastro-base__history-change">
                  <span className="cadastro-base__history-field">{resolveFieldLabel(registro.table_name, change.field)}</span>
                  <span className="cadastro-base__history-values">
                    De: {change.before} → Para: {change.after}
                  </span>
                </div>
              ))
            ) : (
              <span className="cadastro-base__history-empty">{emptyLabel}</span>
            )}
          </div>
          </div>
        )
      })}
    </div>
  )
}
