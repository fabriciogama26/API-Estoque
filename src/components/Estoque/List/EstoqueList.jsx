import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePagination } from '../../TablePagination.jsx'
import { formatCurrency, formatDateTimeValue, formatInteger } from '../../../utils/estoqueUtils.js'
import { CancelIcon, EntryIcon, ExitIcon, NotificationIcon, SaveIcon } from '../../icons.jsx'
import { listSaidas } from '../../../services/saidasService.js'

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
  const [saidaModal, setSaidaModal] = useState({
    open: false,
    item: null,
    registros: [],
    isLoading: false,
    error: null,
    filtroMes: '',
  })
  const minStockInputRef = useRef(null)

  const closeMinStockModal = () => setMinStockModal({ open: false, item: null })
  const openMinStockModal = (item) => {
    setMinStockModal({ open: true, item })
    const initialValue =
      item.estoqueMinimo !== undefined && item.estoqueMinimo !== null ? String(item.estoqueMinimo) : ''
    onMinStockChange(item.materialId, initialValue)
  }

  const closeSaidaModal = () =>
    setSaidaModal({ open: false, item: null, registros: [], isLoading: false, error: null, filtroMes: '' })

  const loadSaidas = async (item, filtroMes) => {
    if (!item) return
    const mesRef = (filtroMes || '').trim()
    let dataInicio
    let dataFim
    if (mesRef && /^\d{4}-\d{2}$/.test(mesRef)) {
      const [anoStr, mesStr] = mesRef.split('-')
      const ano = Number(anoStr)
      const mes = Number(mesStr)
      if (Number.isFinite(ano) && Number.isFinite(mes)) {
        const inicioDate = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0))
        const fimDate = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
        dataInicio = inicioDate.toISOString()
        dataFim = fimDate.toISOString()
      }
    }

    setSaidaModal((prev) => ({ ...prev, isLoading: true, error: null, registros: [], item }))
    try {
      const params = { materialId: item.materialId }
      if (dataInicio) params.dataInicio = dataInicio
      if (dataFim) params.dataFim = dataFim
      const resposta = await listSaidas(params)
      const registros = Array.isArray(resposta)
        ? resposta
        : Array.isArray(resposta?.saidas)
        ? resposta.saidas
        : Array.isArray(resposta?.registros)
        ? resposta.registros
        : []
      setSaidaModal((prev) => ({ ...prev, registros, isLoading: false }))
    } catch (err) {
      setSaidaModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Falha ao carregar saídas.',
      }))
    }
  }

  const openSaidaModal = (item) => {
    if (!item) return
    setSaidaModal({
      open: true,
      item,
      registros: [],
      isLoading: true,
      error: null,
      filtroMes: '',
    })
    loadSaidas(item, '')
  }

  const handleSaidaFilterChange = (event) => {
    const value = event.target.value
    setSaidaModal((prev) => ({ ...prev, filtroMes: value }))
  }

  const handleSaidaFilterSubmit = async (event) => {
    event.preventDefault()
    if (!saidaModal.item) return
    await loadSaidas(saidaModal.item, saidaModal.filtroMes || '')
  }

  const handleSaidaFilterClear = async () => {
    if (!saidaModal.item) return
    setSaidaModal((prev) => ({ ...prev, filtroMes: '' }))
    await loadSaidas(saidaModal.item, '')
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
  const saidaModalItem = saidaModal.item
  const saidaRegistros = saidaModal.registros || []
  const saidaIsLoading = Boolean(saidaModal.isLoading)
  const saidaError = saidaModal.error
  const hasSaidaModal = saidaModal.open && Boolean(saidaModalItem)

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
          const ultimaSaida = item.ultimaSaida
          const totalSaidasItem = Number(item.totalSaidas ?? 0)
          const hasSaida = Boolean(ultimaSaida) || totalSaidasItem > 0
          const ultimaSaidaLabel = hasSaida ? formatDateTimeValue(ultimaSaida.dataEntrega) : 'Sem saídas registradas'

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
                  <div className="estoque-list__item-heading">
                    <p className="estoque-list__item-resumo">{item.resumo || item.nome || 'Material sem descrição'}</p>
                  </div>
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
                            className={`estoque-list__action-button${hasSaida ? ' estoque-list__action-button--notify' : ''}`}
                            onClick={() => (hasSaida ? openSaidaModal(item) : null)}
                            disabled={!hasSaida}
                            aria-label={hasSaida ? 'Ver saídas do material' : 'Sem movimentação registrada'}
                            title={hasSaida ? `Última saída em ${ultimaSaidaLabel}` : 'Sem movimentação registrada'}
                          >
                            <NotificationIcon size={16} aria-hidden="true" />
                          </button>
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

      {hasSaidaModal ? (
        <div
          className="estoque-saida-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes da ultima saída"
          onClick={closeSaidaModal}
        >
          <div className="estoque-saida-modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="estoque-saida-modal__header">
              <div>
                <p className="estoque-saida-modal__eyebrow">Última saída</p>
                <h3 className="estoque-saida-modal__title">
                  {saidaModalItem?.resumo || saidaModalItem?.nome || 'Material'}
                </h3>
              </div>
              <button
                type="button"
                className="estoque-saida-modal__close"
                onClick={closeSaidaModal}
                aria-label="Fechar"
              >
                <CancelIcon size={18} />
              </button>
            </header>

            <form className="estoque-saida-modal__filters" onSubmit={handleSaidaFilterSubmit}>
              <label className="field">
                <span>Mês/ano</span>
                <input
                  type="month"
                  value={saidaModal.filtroMes}
                  onChange={handleSaidaFilterChange}
                  aria-label="Filtrar por mês e ano"
                />
              </label>
              <div className="estoque-saida-modal__filters-actions">
                <button type="submit" className="button button--primary" disabled={saidaIsLoading}>
                  Filtrar
                </button>
                <button type="button" className="button button--ghost" onClick={handleSaidaFilterClear} disabled={saidaIsLoading}>
                  Limpar
                </button>
              </div>
            </form>

            {saidaIsLoading ? (
              <p className="feedback">Carregando saídas...</p>
            ) : saidaError ? (
              <p className="feedback feedback--error">{saidaError}</p>
            ) : saidaRegistros.length === 0 ? (
              <p className="feedback">Nenhuma saída encontrada.</p>
            ) : (
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
                  {saidaRegistros.map((registro) => {
                    const nome =
                      registro?.pessoa?.nome ||
                      registro?.pessoaNome ||
                      registro?.nome ||
                      'Não informado'
                    const matricula = registro?.pessoa?.matricula || registro?.pessoaMatricula || '-'
                    const quantidade = formatInteger(registro?.quantidade ?? 0)
                    const dataEntrega = formatDateTimeValue(registro?.dataEntrega || registro?.data_entrega)
                    const autorizado =
                      registro?.usuarioResponsavelNome ||
                      registro?.usuarioResponsavel ||
                      registro?.usuario_responsavel ||
                      'Não informado'
                    return (
                      <tr key={registro.id || `${registro.materialId}-${registro.dataEntrega}-${quantidade}`}>
                        <td>
                          <div className="estoque-saida-modal__cell-main">{nome}</div>
                          <div className="estoque-saida-modal__cell-sub">Matrícula: {matricula || '-'}</div>
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
            )}
          </div>
        </div>
      ) : null}

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
