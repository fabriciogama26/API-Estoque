import { useEffect, useMemo, useState } from 'react'
import { TablePagination } from '../../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../../config/pagination.js'
import { AcidentesTableRow } from './AcidentesTableRow.jsx'

export function AcidentesTable({
  acidentes,
  onEdit,
  onHistory,
  onDetails,
  onCancel,
  editingId,
  isSaving,
  historyState,
}) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(acidentes.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [acidentes.length])

  const paginatedAcidentes = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return acidentes.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [acidentes, currentPage])

  if (!acidentes.length) {
    return <p className="feedback">Nenhum acidente registrado.</p>
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Matricula</th>
              <th>Data do acidente</th>
              <th>Centro de servico</th>
              <th>Local</th>
              <th>CAT</th>
              <th>CID</th>
              <th>Registrado por</th>
              <th>Cadastrado em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAcidentes.map((acidente) => (
              <AcidentesTableRow
                key={acidente.id}
                acidente={acidente}
                onEdit={onEdit}
                onHistory={onHistory}
                onDetails={onDetails}
                onCancel={onCancel}
                isSaving={isSaving}
                historyState={historyState}
                isEditing={editingId === acidente.id}
              />
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={acidentes.length}
        pageSize={TABLE_PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}
