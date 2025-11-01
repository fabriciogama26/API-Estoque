import { useEffect, useMemo, useState } from 'react'
import { Pencil, History as HistoryIcon } from 'lucide-react'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'

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

export function AcidentesTable({ acidentes, onEdit, onHistory, editingId, isSaving, historyState }) {
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
              <th>Data</th>
              <th>Dias perdidos</th>
              <th>Dias debitados</th>
              <th>Agente</th>
              <th>Tipo</th>
              <th>Lesoes</th>
              <th>Partes lesionadas</th>
              <th>Local</th>
              <th>HHT</th>
              <th>CAT</th>
              <th>CID</th>
              <th>Acao</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAcidentes.map((acidente) => {
              const isEditing = editingId === acidente.id
              const disableEdit = isEditing || isSaving
              const isHistoryLoading = Boolean(
                historyState?.isLoading && historyState?.acidente?.id === acidente.id
              )
              const disableHistory = isSaving || isHistoryLoading || typeof onHistory !== 'function'
              const partesSelecionadas = Array.isArray(acidente.partesLesionadas)
                ? acidente.partesLesionadas.filter(Boolean)
                : acidente.parteLesionada
                  ? [acidente.parteLesionada]
                  : []
              const lesoesSelecionadas = Array.isArray(acidente.lesoes)
                ? acidente.lesoes.filter(Boolean)
                : acidente.lesao
                  ? [acidente.lesao]
                  : []
              const agentesSelecionados = Array.isArray(acidente.agentes)
                ? acidente.agentes.filter(Boolean)
                : acidente.agente
                  ? [acidente.agente]
                  : []
              const tiposSelecionados = Array.isArray(acidente.tipos)
                ? acidente.tipos.filter(Boolean)
                : acidente.tipo
                  ? [acidente.tipo]
                  : []
              return (
                <tr key={acidente.id}>
                  <td>
                    <strong>{acidente.nome}</strong>
                  </td>
                  <td>{acidente.matricula || '-'}</td>
                  <td>{formatDate(acidente.data)}</td>
                  <td>{formatNumber(acidente.diasPerdidos)}</td>
                  <td>{formatNumber(acidente.diasDebitados)}</td>
                  <td>{agentesSelecionados.length ? agentesSelecionados.join(', ') : '-'}</td>
                  <td>{tiposSelecionados.length ? tiposSelecionados.join(', ') : '-'}</td>
                  <td>{lesoesSelecionadas.length ? lesoesSelecionadas.join(', ') : '-'}</td>
                  <td>{partesSelecionadas.length ? partesSelecionadas.join(', ') : '-'}</td>
                  <td>{acidente.local || '-'}</td>
                  <td>{formatNumber(acidente.hht)}</td>
                  <td>{acidente.cat || '-'}</td>
                  <td>{acidente.cid || '-'}</td>
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
                      {typeof onHistory === 'function' ? (
                        <button
                          type="button"
                          className="pessoas-table-action-button"
                          onClick={() => onHistory(acidente)}
                          disabled={disableHistory}
                          aria-label={`Ver historico de edicao de ${acidente.nome}`}
                        >
                          <HistoryIcon size={16} strokeWidth={1.8} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
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
