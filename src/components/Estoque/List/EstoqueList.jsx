import { TablePagination } from '../../TablePagination.jsx'
import { formatCurrency, formatDateTimeValue } from '../../../utils/estoqueUtils.js'
import { SaveIcon } from '../../icons.jsx'

export function EstoqueList({
  itens,
  pageSize,
  currentPage,
  totalItems,
  onPageChange,
  minStockDrafts,
  minStockErrors,
  savingMinStock,
  onMinStockChange,
  onMinStockSave,
}) {
  if (!itens.length) {
    return <p className="feedback">Sem materiais cadastrados ou filtrados.</p>
  }

  return (
    <>
      <div className="estoque-list">
        {itens.map((item) => {
          const draftValue = minStockDrafts[item.materialId] ?? ''
          const isSavingMin = Boolean(savingMinStock[item.materialId])
          const fieldError = minStockErrors[item.materialId]
          const centrosCustoLabel =
            item.centrosCusto && item.centrosCusto.length
              ? item.centrosCusto.join(', ')
              : 'Sem centro de estoque'
          const ultimaAtualizacaoItem = formatDateTimeValue(item.ultimaAtualizacao)
          const deficitQuantidade = Number(item.deficitQuantidade ?? 0)

          return (
            <article
              key={item.materialId}
              className={`estoque-list__item${item.alerta ? ' estoque-list__item--alert' : ''}`}
            >
              {item.alerta ? (
                <div className="estoque-list__item-alert">
                  <span className="estoque-list__item-alert-label">⚠️ Estoque Baixo</span>
                  <span className="estoque-list__item-alert-deficit">
                    Necessário repor {deficitQuantidade} ({formatCurrency(item.valorReposicao)})
                  </span>
                </div>
              ) : null}

              <header className="estoque-list__item-header">
                <div className="estoque-list__item-title">
                  <p className="estoque-list__item-resumo">{item.resumo || item.nome || 'Material sem descrição'}</p>
                  <p className="estoque-list__item-centro">Centro de estoque: {centrosCustoLabel}</p>
                  <p className="estoque-list__item-atualizacao">Última atualização: {ultimaAtualizacaoItem}</p>
                  <p className="estoque-list__item-extra-info">
                    Validade (dias): {item.validadeDias ?? '-'} | CA: {item.ca || '-'}
                  </p>
                </div>

                <div className="estoque-list__item-metrics">
                  <div className="estoque-list__metric">
                    <span className="estoque-list__label">Quantidade</span>
                    <strong className="estoque-list__value">{item.quantidade}</strong>
                  </div>
                  <div className="estoque-list__metric">
                    <span className="estoque-list__label">Valor unitário</span>
                    <strong className="estoque-list__value">{formatCurrency(item.valorUnitario)}</strong>
                  </div>
                  <div className="estoque-list__metric">
                    <span className="estoque-list__label">Valor total</span>
                    <strong className="estoque-list__value">{formatCurrency(item.valorTotal)}</strong>
                  </div>
                  <div className="estoque-list__metric estoque-list__metric--min-stock">
                    <div className="estoque-list__item-min-stock">
                      <label>
                        <span>Estoque mínimo</span>
                        <input
                          type="number"
                          min="0"
                          value={draftValue}
                          onChange={(event) => onMinStockChange(item.materialId, event.target.value)}
                          disabled={isSavingMin}
                        />
                      </label>
                      <button
                        type="button"
                        className="estoque-list__item-save"
                        onClick={() => onMinStockSave(item)}
                        disabled={isSavingMin}
                        aria-label={isSavingMin ? 'Salvando' : 'Salvar'}
                        title={isSavingMin ? 'Salvando' : 'Salvar'}
                      >
                        <SaveIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </header>

              <div className="estoque-list__item-body">
                {fieldError ? <span className="estoque-list__item-error">{fieldError}</span> : null}
              </div>
            </article>
          )
        })}
      </div>

      {totalItems > pageSize ? (
        <div className="estoque-alerts-pagination">
          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </>
  )
}
