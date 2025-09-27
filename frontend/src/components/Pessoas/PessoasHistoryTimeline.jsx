import { formatDateTime } from '../../utils/PessoasUtils.js'

function formatChange(registro) {
  if (!Array.isArray(registro?.camposAlterados) || registro.camposAlterados.length === 0) {
    return 'Sem alteracoes registradas'
  }
  return registro.camposAlterados
    .map(({ campo, de, para }) => `${campo}: "${de || '-'}" -> "${para || '-'}"`)
    .join('; ')
}

export function PessoasHistoryTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="history-list">
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
