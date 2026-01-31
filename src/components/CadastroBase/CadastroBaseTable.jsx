import { useEffect, useMemo, useState } from 'react'
import { CancelIcon, EditIcon, HistoryIcon } from '../icons.jsx'
import { formatDisplayDateTime } from '../../utils/saidasUtils.js'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'

const renderStatus = (ativo) => (ativo !== false ? 'Ativo' : 'Inativo')

export function CadastroBaseTable({
  tableKey,
  items,
  isLoading,
  isSaving,
  onRefresh,
  onEdit,
  onInactivate,
  onHistory,
  centrosCustoMap,
  centrosServicoMap,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = TABLE_PAGE_SIZE || 20
  const columns = useMemo(() => {
    switch (tableKey) {
      case 'cargos':
      case 'centros_custo':
        return [
          { key: 'nome', label: 'Nome' },
          { key: 'ativo', label: 'Status' },
          { key: 'createdByUserName', label: 'Registrado por' },
          { key: 'createdAt', label: 'Cadastrado em' },
        ]
      case 'centros_servico':
        return [
          { key: 'nome', label: 'Nome' },
          { key: 'centroCustoId', label: 'Centro de custo' },
          { key: 'ativo', label: 'Status' },
          { key: 'createdByUserName', label: 'Registrado por' },
          { key: 'createdAt', label: 'Cadastrado em' },
        ]
      case 'centros_estoque':
        return [
          { key: 'nome', label: 'Nome' },
          { key: 'centroCustoId', label: 'Centro de custo' },
          { key: 'ativo', label: 'Status' },
          { key: 'createdByUserName', label: 'Registrado por' },
          { key: 'createdAt', label: 'Cadastrado em' },
        ]
      case 'setores':
        return [
          { key: 'nome', label: 'Nome' },
          { key: 'centroServicoId', label: 'Centro de servico' },
          { key: 'ativo', label: 'Status' },
          { key: 'createdByUserName', label: 'Registrado por' },
          { key: 'createdAt', label: 'Cadastrado em' },
        ]
      default:
        return [
          { key: 'nome', label: 'Nome' },
          { key: 'ativo', label: 'Status' },
          { key: 'createdByUserName', label: 'Registrado por' },
          { key: 'createdAt', label: 'Cadastrado em' },
        ]
    }
  }, [tableKey])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    setCurrentPage((prev) => {
      if (prev < 1) return 1
      if (prev > totalPages) return totalPages
      return prev
    })
  }, [items.length, pageSize])

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return items.slice(startIndex, startIndex + pageSize)
  }, [currentPage, items, pageSize])

  const renderValue = (item, column) => {
  if (column.key === 'ativo') {
      const label = renderStatus(item.ativo)
      return (
        <span className={`status-chip${item.ativo === false ? ' status-chip--cancelado' : ''}`}>{label}</span>
      )
    }
    if (column.key === 'centroCustoId') {
      return centrosCustoMap.get(item.centroCustoId) || '-'
    }
    if (column.key === 'centroServicoId') {
      return centrosServicoMap.get(item.centroServicoId) || '-'
    }
    if (column.key === 'createdAt') {
      return item.createdAt ? formatDisplayDateTime(item.createdAt) : '-'
    }
    if (column.key === 'createdByUserName') {
      return item.createdByUserName || item.createdByUserId || '-'
    }
    return item[column.key] ?? '-'
  }

  return (
    <section className="card cadastro-base__table">
      <header className="card__header">
        <h2>Lista de Cadastro Base</h2>
        {onRefresh ? (
          <button type="button" className="button button--ghost" onClick={onRefresh} disabled={isLoading}>
            Atualizar
          </button>
        ) : null}
      </header>

      {isLoading ? <p className="feedback">Carregando...</p> : null}
      {!isLoading && items.length === 0 ? <p className="feedback">Nenhum registro encontrado.</p> : null}

      {!isLoading && items.length > 0 ? (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr key={item.id} className={item.ativo !== false ? '' : 'data-table__row--inactive'}>
                  {columns.map((column) => (
                    <td key={`${item.id}-${column.key}`}>{renderValue(item, column)}</td>
                  ))}
                  <td>
                    <div className="cadastro-base-table__actions">
                      <button
                        type="button"
                        className="cadastro-base-table-action-button"
                        onClick={() => onEdit(item)}
                        disabled={isSaving}
                        aria-label={`Editar ${item.nome || 'registro'}`}
                        title="Editar"
                      >
                        <EditIcon size={16} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="cadastro-base-table-action-button"
                        onClick={() => onHistory(item)}
                        disabled={isSaving}
                        aria-label={`Ver historico de ${item.nome || 'registro'}`}
                        title="Historico"
                      >
                        <HistoryIcon size={16} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="cadastro-base-table-action-button cadastro-base-table-action-button--danger"
                        onClick={() => onInactivate(item)}
                        disabled={isSaving || item.ativo === false}
                        aria-label={`Inativar ${item.nome || 'registro'}`}
                        title="Inativar"
                      >
                        <CancelIcon size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!isLoading && items.length > 0 ? (
        <TablePagination
          totalItems={items.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </section>
  )
}
