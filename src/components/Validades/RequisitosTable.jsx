import { useEffect, useMemo, useState } from 'react'
import ListChecksIcon from 'lucide-react/dist/esm/icons/list-checks.js'
import PowerIcon from 'lucide-react/dist/esm/icons/power.js'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { EditIcon, HistoryIcon } from '../icons.jsx'
import { formatNumber, formatValidade, resolveCategoriaLabel, resolveTipoLabel } from '../../utils/validadesUtils.js'

export function RequisitosTable({ requisitos, podeGerenciar, onEdit, onRegras, onHistorico, onInativar, onAtivar }) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(requisitos.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages))
  }, [requisitos.length])

  const pagina = useMemo(() => {
    const inicio = (currentPage - 1) * TABLE_PAGE_SIZE
    return requisitos.slice(inicio, inicio + TABLE_PAGE_SIZE)
  }, [currentPage, requisitos])

  if (!requisitos.length) {
    return <p className="feedback">Nenhum requisito cadastrado ainda.</p>
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Requisito</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Validade</th>
              <th>Regras</th>
              <th>Exigidos</th>
              <th>Pendentes</th>
              <th>Vencidos</th>
              <th>Situacao</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {pagina.map((item) => (
              <tr key={item.id} className={item.ativo ? '' : 'validades-row--inativo'}>
                <td>
                  <strong>{item.nome}</strong>
                  <p className="data-table__muted">{item.codigo || '-'}</p>
                </td>
                <td>{resolveCategoriaLabel(item.categoria)}</td>
                <td>{resolveTipoLabel(item.tipo)}</td>
                <td>{formatValidade(item)}</td>
                <td>{formatNumber(item.regras_ativas)}</td>
                <td>{formatNumber(item.colaboradores_exigidos)}</td>
                <td>{formatNumber(item.pendentes)}</td>
                <td>{formatNumber(item.vencidos)}</td>
                <td>
                  <span className={`status-chip validades-status-chip validades-status-chip--${item.ativo ? 'ok' : 'pending'}`}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <div className="materiais-data-table__actions">
                    <button
                      type="button"
                      className="materiais-table-action-button"
                      onClick={() => onEdit(item)}
                      disabled={!podeGerenciar}
                      title="Editar"
                      aria-label={`Editar requisito ${item.nome}`}
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="materiais-table-action-button"
                      onClick={() => onRegras(item)}
                      title="Aplicabilidade (quem precisa)"
                      aria-label={`Aplicabilidade do requisito ${item.nome}`}
                    >
                      <ListChecksIcon size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="materiais-table-action-button"
                      onClick={() => onHistorico(item)}
                      title="Historico"
                      aria-label={`Historico do requisito ${item.nome}`}
                    >
                      <HistoryIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className={`materiais-table-action-button${item.ativo ? ' materiais-table-action-button--danger' : ''}`}
                      onClick={() => (item.ativo ? onInativar(item) : onAtivar(item))}
                      disabled={!podeGerenciar}
                      title={item.ativo ? 'Inativar' : 'Ativar'}
                      aria-label={`${item.ativo ? 'Inativar' : 'Ativar'} requisito ${item.nome}`}
                    >
                      <PowerIcon size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={requisitos.length}
        pageSize={TABLE_PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}
