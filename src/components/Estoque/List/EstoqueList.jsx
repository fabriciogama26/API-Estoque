import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePagination } from '../../TablePagination.jsx'
import { formatCurrency, formatDateTimeValue } from '../../../utils/estoqueUtils.js'
import { CancelIcon, EntryIcon, ExitIcon, SaveIcon } from '../../icons.jsx'

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
  const navigate = useNavigate()
  const [minStockModal, setMinStockModal] = useState({ open: false, item: null })
  const minStockInputRef = useRef(null)

  const closeMinStockModal = () => setMinStockModal({ open: false, item: null })
  const openMinStockModal = (item) => {
    setMinStockModal({ open: true, item })
    const initialValue =
      item.estoqueMinimo !== undefined && item.estoqueMinimo !== null ? String(item.estoqueMinimo) : ''
    onMinStockChange(item.materialId, initialValue)
  }

  useEffect(() => {
    if (!minStockModal.open) return
    const raf = requestAnimationFrame(() => {
      minStockInputRef.current?.focus?.()
    })
    return () => cancelAnimationFrame(raf)
  }, [minStockModal.open])

  if (!itens.length) {
    return <p className="feedback">Sem materiais cadastrados ou filtrados.</p>
  }

  const modalItem = minStockModal.item
  const modalMaterialId = modalItem?.materialId
  const modalDraftValue = modalMaterialId ? minStockDrafts[modalMaterialId] ?? '' : ''
  const modalError = modalMaterialId ? minStockErrors[modalMaterialId] : null
  const modalIsSaving = modalMaterialId ? Boolean(savingMinStock[modalMaterialId]) : false

  const handleModalSave = async () => {
    if (!modalItem || modalIsSaving) return
    const ok = await onMinStockSave(modalItem)
    if (ok) {
      closeMinStockModal()
    }
  }

  return (
    <>
      <div className="estoque-list">
        {itens.map((item) => {
          const isSavingMin = Boolean(savingMinStock[item.materialId])
          const fieldError = minStockErrors[item.materialId]
          const centrosCustoLabel =
            item.centrosCusto && item.centrosCusto.length
              ? item.centrosCusto.join(', ')
              : 'Sem centro de estoque'
          const ultimaAtualizacaoItem = formatDateTimeValue(item.ultimaAtualizacao)
          const deficitQuantidade = Number(item.deficitQuantidade ?? 0)
          const materialId = item.materialId
          const centroEstoquePadrao =
            Array.isArray(item.centrosCusto) && item.centrosCusto.length ? String(item.centrosCusto[0]).trim() : ''

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
                  <p className="estoque-list__item-meta">
                    ID: {item.materialId || '-'} | Cor: {item.corMaterial || item.coresTexto || '-'}
                  </p>
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
                      <div className="estoque-list__actions-group" aria-label="Ações do material">
                        <span className="estoque-list__actions-title">Ações</span>
                        <div className="estoque-list__item-actions">
                        <button
                          type="button"
                          className="estoque-list__action-button"
                          onClick={() =>
                              navigate(
                                `/movimentacoes/entradas?materialId=${encodeURIComponent(materialId)}${
                                  centroEstoquePadrao
                                    ? `&centroCusto=${encodeURIComponent(centroEstoquePadrao)}&centroEstoque=${encodeURIComponent(centroEstoquePadrao)}`
                                    : ''
                                }`,
                              )
                            }
                          aria-label="Ir para Entradas"
                          title="Ir para Entradas"
                        >
                            <EntryIcon size={16} aria-hidden="true" />
                          </button>
                        <button
                          type="button"
                          className="estoque-list__action-button"
                          onClick={() =>
                              navigate(
                                `/movimentacoes/saidas?materialId=${encodeURIComponent(materialId)}${
                                  centroEstoquePadrao
                                    ? `&centroEstoque=${encodeURIComponent(centroEstoquePadrao)}`
                                    : ''
                                }`,
                              )
                            }
                          aria-label="Ir para Saídas"
                          title="Ir para Saídas"
                        >
                            <ExitIcon size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="estoque-list__action-button"
                            onClick={() => openMinStockModal(item)}
                            disabled={isSavingMin}
                            aria-label="Alterar estoque mínimo"
                            title="Alterar estoque mínimo"
                          >
                            <SaveIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
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

      {minStockModal.open && modalItem ? (
        <div
          className="estoque-min-stock-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Alterar estoque mínimo"
          onClick={closeMinStockModal}
        >
          <div className="estoque-min-stock-modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="estoque-min-stock-modal__header">
              <div>
                <p className="estoque-min-stock-modal__eyebrow">Material</p>
                <h3 className="estoque-min-stock-modal__title">{modalItem.resumo || modalItem.nome || '-'}</h3>
              </div>
              <button
                type="button"
                className="estoque-min-stock-modal__close"
                onClick={closeMinStockModal}
                aria-label="Fechar"
              >
                <CancelIcon size={18} />
              </button>
            </header>

            <div className="estoque-min-stock-modal__body">
              <label className="field">
                <span>Novo estoque mínimo</span>
                <input
                  ref={minStockInputRef}
                  type="number"
                  min="0"
                  value={modalDraftValue}
                  onChange={(event) => onMinStockChange(modalMaterialId, event.target.value)}
                  disabled={modalIsSaving}
                />
              </label>
              {modalError ? <p className="feedback feedback--error">{modalError}</p> : null}
            </div>

            <footer className="estoque-min-stock-modal__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={closeMinStockModal}
                disabled={modalIsSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleModalSave}
                disabled={modalIsSaving}
              >
                {modalIsSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

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
