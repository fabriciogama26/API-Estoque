import { formatCurrency } from '../../utils/MateriaisUtils.js'
import { formatSelectionValue } from '../../utils/selectionUtils.js'

const FIELD_LABELS = {
  materialItemNome: 'Nome',
  fabricanteNome: 'Fabricante',
  validadeDias: 'Validade (dias)',
  ca: 'CA',
  valorUnitario: 'Valor unitário',
  estoqueMinimo: 'Estoque mínimo',
  ativo: 'Status',
  descricao: 'Descrição',
  grupoMaterial: 'Grupo de material',
  numeroCalcado: 'Número de calçado',
  numeroVestimenta: 'Número de vestimenta',
  numeroEspecifico: 'Número específico',
  chaveUnica: 'Chave única',
  caracteristicaEpi: 'Características',
  caracteristicas: 'Características',
  caracteristicas_epi: 'Características',
  cores: 'Cores',
  corMaterial: 'Cor principal',
}

const SELECTION_FIELDS = new Set(['caracteristicaEpi', 'caracteristicas', 'caracteristicas_epi', 'cores'])

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
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

const formatChange = (registro) => {
  if (Array.isArray(registro?.camposAlterados) && registro.camposAlterados.length > 0) {
    return registro.camposAlterados
      .map(({ campo, de, para }) => {
        const label = FIELD_LABELS[campo] ?? campo
        const antigo = formatValue(campo, de)
        const novo = formatValue(campo, para)
        return `${label}: "${antigo}" -> "${novo}"`
      })
      .join('; ')
  }

  if (registro?.valorUnitario !== null && registro?.valorUnitario !== undefined) {
    const numero = Number(registro.valorUnitario)
    if (!Number.isNaN(numero)) {
      return `Valor unitário registrado: ${formatCurrency(numero)}`
    }
  }

  return 'Sem alterações registradas'
}

export function MateriaisHistoricoTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="materiais-history-list">
      {registros.map((registro) => {
        const data = registro.dataRegistro ?? registro.criadoEm
        return (
          <li key={registro.id}>
            <span>{formatDateTime(data)}</span>
            <span>{registro.usuarioResponsavel || '-'}</span>
            <span>{formatChange(registro)}</span>
          </li>
        )
      })}
    </ul>
  )
}
