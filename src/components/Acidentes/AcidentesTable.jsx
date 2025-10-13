import { Pencil } from 'lucide-react'

const formatDate = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

const formatNumber = (value) => {
  if (value === null || value === undefined) {
    return '-'
  }
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return '-'
  }
  return numeric
}

export function AcidentesTable({ acidentes, onEdit, editingId, isSaving }) {
  if (!acidentes.length) {
    return <p className="feedback">Nenhum acidente registrado.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Matricula</th>
            <th>Cargo</th>
            <th>Data</th>
            <th>Dias perdidos</th>
            <th>Dias debitados</th>
            <th>Tipo</th>
            <th>Agente</th>
            <th>Centro de servico</th>
            <th>Local</th>
            <th>HHT</th>
            <th>CAT</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {acidentes.map((acidente) => {
            const isEditing = editingId === acidente.id
            const disableEdit = isEditing || isSaving
            return (
              <tr key={acidente.id}>
                <td>
                  <strong>{acidente.nome}</strong>
                  {acidente.parteLesionada ? (
                    <div className="data-table__muted">Parte lesionada: {acidente.parteLesionada}</div>
                  ) : null}
                  {acidente.lesao ? (
                    <div className="data-table__muted">Lesao: {acidente.lesao}</div>
                  ) : null}
                </td>
                <td>{acidente.matricula || '-'}</td>
                <td>{acidente.cargo || '-'}</td>
                <td>{formatDate(acidente.data)}</td>
                <td>{formatNumber(acidente.diasPerdidos)}</td>
                <td>{formatNumber(acidente.diasDebitados)}</td>
                <td>{acidente.tipo || '-'}</td>
                <td>{acidente.agente || '-'}</td>
                <td>{(acidente.centroServico ?? acidente.setor) || '-'}</td>
                <td>{acidente.local || '-'}</td>
                <td>{formatNumber(acidente.hht)}</td>
                <td>{acidente.cat || '-'}</td>
                <td>
                  <div className="pessoas-data-table__actions">
                    <button
                      type="button"
                      className="pessoas-table-action-button"
                      onClick={() => onEdit(acidente)}
                      disabled={disableEdit}
                      aria-label={disableEdit ? 'Editando acidente' : `Editar ${acidente.nome}`}
                    >
                      <Pencil size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
