import { HhtMensalTableRow } from './HhtMensalTableRow.jsx'

export function HhtMensalTable({ registros, onEdit, onHistory, onDelete, onDetails, isSaving, editingId }) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return <p className="feedback">Nenhum registro encontrado.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Mes referência</th>
            <th>Centro de servico</th>
            <th>Status</th>
            <th>Modo</th>
            <th>HHT final</th>
            <th>Registrado por</th>
            <th>Cadastrado em</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <HhtMensalTableRow
              key={registro.id}
              registro={registro}
              onEdit={onEdit}
              onHistory={onHistory}
              onDetails={onDetails}
              onDelete={onDelete}
              isSaving={isSaving}
              isEditing={editingId === registro.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
