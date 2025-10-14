import { formatDate, formatDateTime } from '../../utils/PessoasUtils.js'

const FIELD_LABELS = {
  nome: 'Nome',
  matricula: 'Matricula',
  centroServico: 'Centro de servico',
  cargo: 'Cargo',
  dataAdmissao: 'Data de admissao',
  tipoExecucao: 'Tipo Execucao',
}

function formatValue(campo, valor) {
  if (!valor) {
    return '-'
  }
  if (campo === 'dataAdmissao') {
    return formatDate(valor)
  }
  return valor
}

function formatChange(registro) {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return 'Sem alteracoes registradas'
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      return `${label}: "${formatValue(campo, de)}" -> "${formatValue(campo, para)}"`
    })
    .join('; ')
}

export function PessoasHistoryTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="pessoas-history-list">
      {registros
        .slice()
        .sort((a, b) => new Date(b.dataEdicao) - new Date(a.dataEdicao))
        .map((registro) => (
          <li key={registro.id}>
            <span>{formatDateTime(registro.dataEdicao)}</span>
            <span>{registro.usuarioResponsavel || '-'}</span>
            <span>{formatChange(registro)}</span>
          </li>
        ))}
    </ul>
  )
}
