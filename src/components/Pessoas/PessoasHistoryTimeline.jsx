import { formatDateTime } from '../../utils/PessoasUtils.js'

const FIELD_LABELS = {
  nome: 'Nome',
  matricula: 'Matricula',
  centroServico: 'Centro de servico',
  cargo: 'Cargo',
}

function formatChange(registro) {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return 'Sem alteracoes registradas'
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => {
      const label = FIELD_LABELS[campo] ?? campo
      return `${label}: "${de || '-'}" -> "${para || '-'}"`
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
