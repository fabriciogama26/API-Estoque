import { TablePagination } from '../../TablePagination.jsx'
import { CancelIcon } from '../../icons.jsx'

export function EstoqueSaidaModal({
  open,
  item,
  registros,
  isLoading,
  error,
  filtroMes,
  onFilterChange,
  onFilterSubmit,
  onFilterClear,
  page,
  pageSize,
  onPageChange,
  onClose,
  formatDateTimeValue,
  formatInteger,
}) {
  if (!open || !item) {
    return null
  }

  const totalItems = registros?.length || 0
  const totalPages = totalItems > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1
  const paginaAtual = page || 1
  const paginaSaidas = registros.slice((paginaAtual - 1) * pageSize, paginaAtual * pageSize)

  return (
    <div
      className="estoque-saida-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da ultima saida"
      onClick={onClose}
    >
      <div className="estoque-saida-modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="estoque-saida-modal__header">
          <div>
            <p className="estoque-saida-modal__eyebrow">Ultima saida</p>
            <h3 className="estoque-saida-modal__title">{item.resumo || item.nome || 'Material'}</h3>
          </div>
          <button type="button" className="estoque-saida-modal__close" onClick={onClose} aria-label="Fechar">
            <CancelIcon size={18} />
          </button>
        </header>

        <form className="estoque-saida-modal__filters" onSubmit={onFilterSubmit}>
          <label className="field">
            <span>Mes/ano</span>
            <input
              type="month"
              value={filtroMes}
              onChange={onFilterChange}
              aria-label="Filtrar por mes e ano"
            />
          </label>
          <div className="estoque-saida-modal__filters-actions">
            <button type="submit" className="button button--primary" disabled={isLoading}>
              Filtrar
            </button>
            <button type="button" className="button button--ghost" onClick={onFilterClear} disabled={isLoading}>
              Limpar
            </button>
          </div>
        </form>

        {isLoading ? (
          <p className="feedback">Carregando saidas...</p>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : totalItems === 0 ? (
          <p className="feedback">Nenhuma saida encontrada.</p>
        ) : (
          <>
            <table className="estoque-saida-modal__table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Quantidade</th>
                  <th>Data</th>
                  <th>Autorizado por</th>
                </tr>
              </thead>
              <tbody>
                {paginaSaidas.map((registro) => {
                  const nome =
                    registro?.pessoa?.nome ||
                    registro?.pessoaNome ||
                    registro?.nome ||
                    'Nao informado'
                  const matricula = registro?.pessoa?.matricula || registro?.pessoaMatricula || '-'
                  const quantidade = formatInteger(registro?.quantidade ?? 0)
                  const dataEntrega = formatDateTimeValue(registro?.dataEntrega || registro?.data_entrega)
                  const autorizado =
                    registro?.usuarioResponsavelNome ||
                    registro?.usuarioResponsavel ||
                    registro?.usuario_responsavel ||
                    'Nao informado'
                  return (
                    <tr key={registro.id || `${registro.materialId}-${registro.dataEntrega}-${quantidade}`}>
                      <td>
                        <div className="estoque-saida-modal__cell-main">{nome}</div>
                        <div className="estoque-saida-modal__cell-sub">Matricula: {matricula || '-'}</div>
                      </td>
                      <td>
                        <div className="estoque-saida-modal__cell-main">{quantidade}</div>
                      </td>
                      <td>
                        <div className="estoque-saida-modal__cell-main">{dataEntrega}</div>
                      </td>
                      <td>
                        <div className="estoque-saida-modal__cell-main">{autorizado}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="estoque-saida-modal__pagination">
                <TablePagination
                  currentPage={paginaAtual}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
