import { useEffect, useMemo, useState } from 'react'
import { MateriaisActions } from './MateriaisActions.jsx'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { formatCurrency } from '../../utils/MateriaisUtils.js'

const PAGE_SIZE = TABLE_PAGE_SIZE

export function MateriaisTable({ materiais, onEdit, onHistory, editingId, isSaving, historyModal }) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(materiais.length / PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [materiais.length])

  const paginatedMateriais = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return materiais.slice(startIndex, startIndex + PAGE_SIZE)
  }, [materiais, currentPage])

  if (!materiais.length) {
    return <p className="feedback">Nenhum material cadastrado.</p>
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Grupo</th>
              <th>Tamanho</th>
              <th>CA</th>
              <th>Validade (dias)</th>
              <th>Valor unitario</th>
              <th>Fabricante</th>
              <th>Registrado por</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMateriais.map((material) => (
              <tr key={material.id}>
                <td>
                  <strong>{material.nome}</strong>
                </td>
                <td>{material.grupoMaterial || '-'}</td>
                <td>{material.numeroCalcado || material.numeroVestimenta || '-'}</td>
                <td>{material.ca || '-'}</td>
                <td>{material.validadeDias}</td>
                <td>{formatCurrency(material.valorUnitario)}</td>
                <td>{material.fabricante || '-'}</td>
                <td>{material.usuarioCadastro || '-'}</td>
                <td>
                  <MateriaisActions
                    material={material}
                    isEditing={editingId === material.id}
                    isSaving={isSaving}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    isHistoryLoading={
                      historyModal.isLoading && historyModal.material?.id === material.id
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={materiais.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}

