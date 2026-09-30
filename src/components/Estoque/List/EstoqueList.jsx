import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TablePagination } from '../../TablePagination.jsx'
import { formatCurrency, formatDateTimeValue, formatInteger } from '../../../utils/estoqueUtils.js'
import { EntryIcon, ExitIcon, NotificationIcon, SaveIcon } from '../../icons.jsx'
import { listSaidas } from '../../../services/saidasService.js'
import { EstoqueSaidaModal } from '../Modal/EstoqueSaidaModal.jsx'
import { EstoqueMinStockModal } from '../Modal/EstoqueMinStockModal.jsx'
import { EstoqueCorrectionModal } from '../Modal/EstoqueCorrectionModal.jsx'
import { NaoCalculavelInfo } from '../../AnaliseEstoque/NaoCalculavelInfo.jsx'
import { usePermissions } from '../../../context/PermissionsContext.jsx'
import {
  formatBaseCalculo,
  formatCoberturaMeses,
  formatFonteRegra,
  formatQuantidadeOuNaoCalculavel,
  formatSituacaoReposicao,
  toNumberOrNull,
} from '../../../utils/reposicaoUtils.js'

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
  reposicao,
  canEditMinimo = true,
  canVerAnalise = false,
  onCorrectionSubmitted,
}) {
  const navigate = useNavigate()
  const { permissions, isAdmin, isMaster } = usePermissions()
  const canRequestCorrection = isAdmin || isMaster || permissions.includes('estoque.correcao.solicitar')
  const [minStockModal, setMinStockModal] = useState({ open: false, item: null })
  const [correctionModal, setCorrectionModal] = useState({ open: false, item: null })
  const [saidaModal, setSaidaModal] = useState({
    open: false,
    item: null,
    registros: [],
    isLoading: false,
    error: null,
    filtroMes: '',
    page: 1,
  })
  const minStockInputRef = useRef(null)
  const [minStockMotivo, setMinStockMotivo] = useState('')
  const reposicaoPorMaterial = reposicao?.porMaterial instanceof Map ? reposicao.porMaterial : new Map()
  const reposicaoStatus = reposicao?.status || 'idle'

  const closeMinStockModal = () => setMinStockModal({ open: false, item: null })
  const openMinStockModal = (item) => {
    setMinStockMotivo('')
    setMinStockModal({ open: true, item })
    const initialValue =
      item.estoqueMinimo !== undefined && item.estoqueMinimo !== null ? String(item.estoqueMinimo) : ''
    onMinStockChange(item.materialId, initialValue)
  }

  const closeSaidaModal = () =>
    setSaidaModal({ open: false, item: null, registros: [], isLoading: false, error: null, filtroMes: '', page: 1 })

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

    setSaidaModal((prev) => ({ ...prev, isLoading: true, error: null, registros: [], item, page: 1 }))
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
      setSaidaModal((prev) => ({ ...prev, registros, isLoading: false, page: 1 }))
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
      page: 1,
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
  const saidaPage = saidaModal.page || 1
  const saidaPageSize = 5

  const handleModalSave = async () => {
    if (!modalItem || modalIsSaving) return
    const ok = await onMinStockSave(modalItem, minStockMotivo.trim() || null)
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
          const politicaItem = reposicaoPorMaterial.get(String(materialId)) || null
          const minimoCadastrado = toNumberOrNull(item.estoqueMinimo)

          return (
            <article
              key={item.materialId}
              className={`estoque-list__item${item.alerta ? ' estoque-list__item--alert' : ''}`}
            >
              {item.alerta ? (
                <div className="estoque-list__item-alert">
                  <span className="estoque-list__item-alert-label">⚠️ Estoque Baixo</span>
                  <span className="estoque-list__item-alert-deficit">
                    Necessário repor {deficitQuantidade} ({formatCurrency(item.valorReposicao)}) | limite:{' '}
                    {item.limiteOrigem ? formatFonteRegra(item.limiteOrigem).toLowerCase() : 'mínimo cadastrado'}
                  </span>
                </div>
              ) : null}
              {item.correcoesPendentes?.map((correcao) => (
                <button
                  key={correcao.id}
                  type="button"
                  className="feedback feedback--warning"
                  onClick={() => navigate(`/estoque/correcoes?materialId=${encodeURIComponent(materialId)}`)}
                  title={`Solicitação ${correcao.id}`}
                >
                  🔒 Correção física pendente — Sistema: {formatInteger(correcao.saldoSistema)} | Físico informado:{' '}
                  {formatInteger(correcao.quantidadeFisica)} | Diferença: {correcao.diferenca > 0 ? '+' : ''}{formatInteger(correcao.diferenca)}
                </button>
              ))}

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
                  {item.semMovimentacao ? (
                    <p className="estoque-list__item-sem-movimentacao">
                      Sem movimentação registrada: saldo zero, sem alerta. Revise o mínimo na Análise de Estoque.
                    </p>
                  ) : null}
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
                          {canRequestCorrection ? <button
                            type="button"
                            className="estoque-list__action-button"
                            onClick={() => navigate(`/estoque/correcoes?materialId=${encodeURIComponent(materialId)}`)}
                            aria-label="Correção de Estoque Físico"
                            title="Correção de Estoque Físico"
                          >🔒</button> : null}
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
                          {canEditMinimo ? (
                            <button
                              type="button"
                              className="estoque-list__action-button"
                              onClick={() => openMinStockModal(item)}
                              disabled={isSavingMin}
                              aria-label="Alterar mínimo cadastrado"
                              title="Alterar mínimo cadastrado"
                            >
                              <SaveIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <dl className="estoque-list__reposicao" aria-label="Minimos do material">
                <div>
                  <dt>Mínimo cadastrado</dt>
                  <dd>{minimoCadastrado && minimoCadastrado > 0 ? formatInteger(minimoCadastrado) : 'Não cadastrado'}</dd>
                </div>
                <div>
                  <dt>Mínimo sugerido</dt>
                  <dd>
                    {politicaItem
                      ? toNumberOrNull(politicaItem.minimo_automatico) === null
                        ? <NaoCalculavelInfo />
                        : formatQuantidadeOuNaoCalculavel(politicaItem.minimo_automatico)
                      : reposicaoStatus === 'loading'
                        ? 'Calculando...'
                        : 'Indisponível'}
                  </dd>
                </div>
                <div>
                  <dt>Mínimo efetivo</dt>
                  <dd>
                    {politicaItem
                      ? toNumberOrNull(politicaItem.minimo_efetivo) === null
                        ? <NaoCalculavelInfo tipo="limite" />
                        : formatQuantidadeOuNaoCalculavel(politicaItem.minimo_efetivo)
                      : '-'}
                    {politicaItem ? <small>{formatFonteRegra(politicaItem.fonte_regra)}</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>Cobertura</dt>
                  <dd>
                    {politicaItem
                      ? toNumberOrNull(politicaItem.cobertura_atual_meses) === null
                        ? <NaoCalculavelInfo />
                        : formatCoberturaMeses(politicaItem.cobertura_atual_meses)
                      : '-'}
                    {politicaItem ? <small>{formatBaseCalculo(politicaItem.base_calculo)}</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>Situação</dt>
                  <dd>
                    {politicaItem ? formatSituacaoReposicao(politicaItem.situacao) : '-'}
                    {politicaItem?.prioridade ? <small>{politicaItem.prioridade}</small> : null}
                  </dd>
                </div>
                {politicaItem?.divergencia_manual ? (
                  <div className="estoque-list__reposicao-aviso">
                    <dt>Diferença</dt>
                    <dd>
                      Cadastrado {politicaItem.divergencia_manual === 'manual_acima' ? 'acima' : 'abaixo'} do sugerido (
                      {formatInteger(politicaItem.divergencia_pct)}%)
                    </dd>
                  </div>
                ) : null}
                {canVerAnalise && politicaItem ? (
                  <div className="estoque-list__reposicao-link">
                    <button type="button" className="button button--ghost button--compact" onClick={() => navigate('/analise-estoque?aba=compra')}>
                      Ver análise de compra
                    </button>
                  </div>
                ) : null}
              </dl>

              <div className="estoque-list__item-body">
                {fieldError ? <span className="estoque-list__item-error">{fieldError}</span> : null}
              </div>
            </article>
          )
        })}
      </div>

      <EstoqueSaidaModal
        open={hasSaidaModal}
        item={saidaModalItem}
        registros={saidaRegistros}
        isLoading={saidaIsLoading}
        error={saidaError}
        filtroMes={saidaModal.filtroMes}
        onFilterChange={handleSaidaFilterChange}
        onFilterSubmit={handleSaidaFilterSubmit}
        onFilterClear={handleSaidaFilterClear}
        page={saidaPage}
        pageSize={saidaPageSize}
        onPageChange={(page) => setSaidaModal((prev) => ({ ...prev, page }))}
        onClose={closeSaidaModal}
        formatDateTimeValue={formatDateTimeValue}
        formatInteger={formatInteger}
      />

      <EstoqueMinStockModal
        open={minStockModal.open}
        item={modalItem}
        draftValue={modalDraftValue}
        error={modalError}
        isSaving={modalIsSaving}
        inputRef={minStockInputRef}
        onClose={closeMinStockModal}
        onChange={(value) => onMinStockChange(modalMaterialId, value)}
        onSave={handleModalSave}
        motivo={minStockMotivo}
        onMotivoChange={setMinStockMotivo}
        politicaItem={modalMaterialId ? reposicaoPorMaterial.get(String(modalMaterialId)) || null : null}
      />

      <EstoqueCorrectionModal
        open={correctionModal.open}
        item={correctionModal.item}
        onClose={() => setCorrectionModal({ open: false, item: null })}
        onSubmitted={onCorrectionSubmitted}
      />

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
