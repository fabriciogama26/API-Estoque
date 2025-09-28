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
            <th>Setor</th>
            <th>Local</th>
            <th>CAT</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {acidentes.map((acidente) => {
            const isEditing = editingId === acidente.id
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
                <td>{acidente.setor || '-'}</td>
                <td>{acidente.local || '-'}</td>
                <td>{acidente.cat || '-'}</td>
                <td>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => onEdit(acidente)}
                    disabled={isSaving}
                  >
                    {isEditing && isSaving ? 'Salvando...' : 'Editar'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
