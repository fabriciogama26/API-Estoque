import { TablePagination } from '../../TablePagination.jsx'
import { formatCurrency, formatDateTimeValue } from '../../../utils/estoqueUtils.js'

export function EstoqueAlerts({
  alertas,
  alertasPage,
  totalAlertasPages,
  onPageChange,
  pageSize,
  totalAlertas,
}) {
  if (!alertas.length) {
    return <p className="feedback">Nenhum alerta no periodo.</p>
  }

  return (
    <>
      <div className="estoque-alert-grid">
        {alertas.map((alerta, index) => {
          const deficit = Number(alerta.deficitQuantidade ?? 0)
          const centrosLabel =
            alerta.centrosCusto && alerta.centrosCusto.length
              ? alerta.centrosCusto.join(', ')
              : 'Sem centro de estoque'
          const resumo = alerta.resumo || alerta.nome || alerta.fabricante || 'Material sem descrição'
          const idLabel = alerta.materialId || '---'
          const cardKey = `${alerta.materialId || 'alerta'}-${index}`
          return (
            <article key={cardKey} className="estoque-alert-card">
              <div className="estoque-alert-card__header">
                <span className="estoque-alert-card__badge">Alerta</span>
                <small>{formatDateTimeValue(alerta.ultimaAtualizacao)}</small>
              </div>
              <p className="estoque-alert-card__estoque">
                Estoque atual: <strong>{alerta.estoqueAtual}</strong> | Minimo:{' '}
                <strong>{alerta.estoqueMinimo}</strong>
              </p>
              <p className="estoque-alert-card__id-inline">ID: {idLabel}</p>
              <p className="estoque-alert-card__descricao">{resumo}</p>
              <p className="estoque-alert-card__centro">Centro de estoque: {centrosLabel}</p>
              {deficit > 0 ? (
                <p className="estoque-alert-card__deficit">
                  Faltam {deficit} ({formatCurrency(alerta.valorReposicao)})
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
      {totalAlertas > pageSize ? (
        <div className="estoque-alerts-pagination">
          <TablePagination
            currentPage={alertasPage}
            totalItems={totalAlertas}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </>
  )
}
