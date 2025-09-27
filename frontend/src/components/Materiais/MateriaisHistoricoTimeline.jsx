import { formatCurrency } from '../../utils/MateriaisUtils.js'

export function MateriaisHistoricoTimeline({ registros }) {
  if (!registros?.length) {
    return null
  }

  return (
    <ul className="history-list">
      {registros.map((registro) => (
        <li key={registro.id}>
          <span>{new Date(registro.dataRegistro).toLocaleString('pt-BR')}</span>
          <span>{formatCurrency(registro.valorUnitario)}</span>
          <span>{registro.usuarioResponsavel}</span>
        </li>
      ))}
    </ul>
  )
}
