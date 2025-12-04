import { useEffect, useMemo, useState } from 'react'
import { MateriaisActions } from './MateriaisActions.jsx'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { formatCurrency } from '../../utils/MateriaisUtils.js'
import { formatDisplayDateTime } from '../../utils/saidasUtils.js'

const PAGE_SIZE = TABLE_PAGE_SIZE

export function MateriaisTable({ materiais, onEdit, onHistory, onView, editingId, isSaving, historyModal }) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(materiais.length / PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) return 1
      if (prev > totalPages) return totalPages
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
              <th>Grupo</th>
              <th>Material</th>
              <th>Descrição</th>
              <th>Valor unitário</th>
              <th>Validade (dias)</th>
              <th>Fabricante</th>
              <th>Registrado por</th>
              <th>Cadastrado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMateriais.map((material) => (
              <tr key={material.id}>
                <td>{material.grupoMaterialNome || material.grupoMaterial || '-'}</td>
                <td>
                  <strong>{material.nomeItemRelacionado || material.nome || '-'}</strong>
                </td>
                <td>
                  {material.descricao?.trim() ? (
                    <span className="materiais-table__description">{material.descricao.trim()}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{formatCurrency(material.valorUnitario)}</td>
                <td>{(material.validadeDias ?? material.validade) || '-'}</td>
                <td>{material.fabricanteNome || material.fabricante || '-'}</td>
                <td>
                  {material.usuarioCadastroUsername ||
                    material.registradoPor ||
                    material.usuarioCadastroNome ||
                    material.usuarioCadastro ||
                    '-'}
                </td>
                <td>
                  {material.criadoEm || material.created_at || material.createdAt
                    ? formatDisplayDateTime(material.criadoEm || material.created_at || material.createdAt)
                    : '-'}
                </td>
                <td>
                  <MateriaisActions
                    material={material}
                    isEditing={editingId === material.id}
                    isSaving={isSaving}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    onView={onView}
                    isHistoryLoading={historyModal.isLoading && historyModal.material?.id === material.id}
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
