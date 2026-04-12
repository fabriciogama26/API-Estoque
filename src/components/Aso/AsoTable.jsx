import { useEffect, useMemo, useState } from 'react'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { AsoActions } from './AsoActions.jsx'
import { buildAsoRowClassName, formatDate, formatDateTime, resolveAsoStatusMeta } from '../../utils/asoUtils.js'

const PAGE_SIZE = TABLE_PAGE_SIZE

export function AsoTable({
  asos,
  editingId,
  isSaving,
  onEdit,
  onHistory,
  onDetails,
  onRegisterExam,
}) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(asos.length / PAGE_SIZE))
    setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages))
  }, [asos.length])

  const paginated = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return asos.slice(startIndex, startIndex + PAGE_SIZE)
  }, [asos, currentPage])

  if (!asos.length) {
    return <p className="feedback">Nenhum ASO cadastrado ainda.</p>
  }

  return (
    <>
      <div className="saidas-legend" aria-label="Legenda dos vencimentos de ASO">
        <div className="saidas-legend__item">
          <span className="saidas-legend__dot saidas-legend__dot--alerta" aria-hidden="true" />
          <span>60 a 31 dias</span>
        </div>
        <div className="saidas-legend__item">
          <span className="saidas-legend__dot aso-legend__dot--30" aria-hidden="true" />
          <span>30 a 16 dias</span>
        </div>
        <div className="saidas-legend__item">
          <span className="saidas-legend__dot aso-legend__dot--15" aria-hidden="true" />
          <span>15 a 1 dia</span>
        </div>
        <div className="saidas-legend__item">
          <span className="saidas-legend__dot saidas-legend__dot--limite" aria-hidden="true" />
          <span>Vence hoje</span>
        </div>
        <div className="saidas-legend__item">
          <span className="saidas-legend__dot saidas-legend__dot--atrasada" aria-hidden="true" />
          <span>Vencido</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table data-table--saidas">
          <thead>
            <tr>
              <th>Funcionario</th>
              <th>Matricula</th>
              <th>Tipo de exame</th>
              <th>Data do exame</th>
              <th>Proximo vencimento</th>
              <th>Dias para vencer</th>
              <th>Status</th>
              <th>Cadastrado em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((aso) => {
              const status = resolveAsoStatusMeta(aso.statusVencimento)
              return (
                <tr key={aso.id} className={buildAsoRowClassName(aso)}>
                  <td>
                    <strong>{aso.funcionario || aso.nome || '-'}</strong>
                    <p className="data-table__muted">{[aso.centroServico, aso.setor, aso.cargo].filter(Boolean).join(' | ') || '-'}</p>
                  </td>
                  <td>{aso.matricula || '-'}</td>
                  <td>{aso.tipoExame || '-'}</td>
                  <td>{formatDate(aso.dataExame)}</td>
                  <td>{formatDate(aso.proximoVencimento)}</td>
                  <td>{aso.diasParaVencer === null ? '-' : aso.diasParaVencer}</td>
                  <td>
                    <span className={`status-chip aso-status-chip aso-status-chip--${status.variant}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>{formatDateTime(aso.criadoEm)}</td>
                  <td>
                    <AsoActions
                      aso={aso}
                      isEditing={editingId === aso.id}
                      isSaving={isSaving}
                      onEdit={onEdit}
                      onHistory={onHistory}
                      onDetails={onDetails}
                      onRegisterExam={onRegisterExam}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        totalItems={asos.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}
