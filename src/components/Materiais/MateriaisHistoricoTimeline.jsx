import { formatCurrency } from '../../utils/MateriaisUtils.js'
import { formatSelectionValue } from '../../utils/selectionUtils.js'

const FIELD_LABELS = {
  materialItemNome: 'Material',
  nome: 'Material',
  fabricanteNome: 'Fabricante',
  validadeDias: 'Validade (dias)',
  ca: 'CA',
  valorUnitario: 'Valor unitário',
  estoqueMinimo: 'Estoque mínimo',
  ativo: 'Status',
  descricao: 'Descrição',
  grupoMaterial: 'Grupo de material',
  grupoMaterialNome: 'Grupo de material',
  numeroCalcado: 'Número de calçado',
  numeroVestimenta: 'Número de vestimenta',
  numeroEspecifico: 'Número específico',
  caracteristicaEpi: 'Características',
  caracteristicas: 'Características',
  caracteristicas_epi: 'Características',
  cores: 'Cores',
  corMaterial: 'Cor principal',
}

const SELECTION_FIELDS = new Set(['caracteristicaEpi', 'caracteristicas', 'caracteristicas_epi', 'cores'])

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

const formatValue = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '-'
  }
  if (SELECTION_FIELDS.has(campo)) {
    const texto = formatSelectionValue(valor)
    return texto || '-'
  }
  if (campo === 'corMaterial') {
    const texto = formatSelectionValue(valor)
    return texto || '-'
  }
  if (campo === 'valorUnitario') {
    const numero = Number(valor)
    return Number.isNaN(numero) ? '-' : formatCurrency(numero)
  }
  if (campo === 'ativo') {
    return valor ? 'Ativo' : 'Inativo'
  }
  return String(valor)
}

const buildChanges = (registro) => {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return []
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      const antes = formatValue(campo, de)
      const depois = formatValue(campo, para)
      if (antes === depois) return null
      return { campo, label, before: antes, after: depois }
    })
    .filter(Boolean)
}

export function MateriaisHistoricoTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  const ordenados = registros
    .slice()
    .sort((a, b) => new Date(b.dataRegistro ?? b.criadoEm ?? 0) - new Date(a.dataRegistro ?? a.criadoEm ?? 0))

  return (
    <ul className="entradas-history__list">
      {ordenados.map((registro) => {
        const data = registro.dataRegistro ?? registro.criadoEm
        const changes = buildChanges(registro)
        return (
          <li key={registro.id} className="entradas-history__item">
            <div className="entradas-history__item-header">
              <div>
                <strong>{formatDateTime(data)}</strong>
                <p>{registro.usuarioResponsavel || 'Responsavel não informado'}</p>
              </div>
            </div>
            <div className="entradas-history__item-body">
              {changes.length === 0 ? (
                <p className="feedback">Sem alterações registradas.</p>
              ) : (
                changes.map((change) => (
                  <p key={`${registro.id}-${change.campo}`}>
                    <strong>{change.label}:</strong> "{change.before}" → "{change.after}"
                  </p>
                ))
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
