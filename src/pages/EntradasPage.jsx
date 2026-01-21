import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { EntryIcon, EditIcon, HistoryIcon, CancelIcon } from '../components/icons.jsx'
import { EntradasHistoryModal } from '../components/Entradas/EntradasHistoryModal.jsx'
import { EntradaDetailsModal } from '../components/Entradas/Modal/EntradaDetailsModal.jsx'
import { EntradaCancelModal } from '../components/Entradas/Modal/EntradaCancelModal.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { EntradasProvider, useEntradasContext } from '../context/EntradasContext.jsx'
import { formatCurrency, formatDisplayDate, formatMaterialSummary, normalizeSearchValue } from '../utils/entradasUtils.js'
import { formatDisplayDateTime } from '../utils/saidasUtils.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import '../styles/MateriaisPage.css'

function EntradasContent() {
  const [searchParams] = useSearchParams()
  const {
    form,
    filters,
    entradas,
    centrosCusto,
    materiaisMap,
    registeredOptions,
    centroCustoFilterOptions,
    resolveCentroCustoLabel,
    statusOptions,
    isSaving,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    filteredEntradas,
    paginatedEntradas,
    load,
    handleChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleMaterialInputChange,
    handleMaterialSelect,
    handleMaterialFocus,
    handleMaterialBlur,
    handleMaterialClear,
    materialSearchValue,
    materialSuggestions,
    shouldShowMaterialDropdown,
    isSearchingMaterials,
    materialSearchError,
    hasCentrosCusto,
    isEditing,
    cancelEdit,
    startEditEntrada,
    openHistory,
    historyState,
    closeHistory,
    cancelState,
    openCancelModal,
    closeCancelModal,
    handleCancelSubmit,
    isEntradaCancelada,
    setCancelState,
  } = useEntradasContext()

  const [detalheEntrada, setDetalheEntrada] = useState(null)

  useEffect(() => {
    const centroParam = (searchParams.get('centroEstoque') || searchParams.get('centroCusto') || '').trim()
    if (!centroParam) return
    if (isEditing) return
    if (!hasCentrosCusto) return

    const currentCentro = (form.centroCusto || '').toString().trim()
    const alreadyValid = (centrosCusto || []).some(
      (item) => String(item?.id ?? item?.nome ?? '').trim() === currentCentro,
    )
    if (alreadyValid) {
      return
    }

    const normalizedCentro = normalizeSearchValue(centroParam)
    const centro = (centrosCusto || []).find((item) => {
      const value = String(item?.id ?? item?.nome ?? '').trim()
      const nome = String(item?.nome ?? '').trim()
      return value === centroParam || normalizeSearchValue(nome) === normalizedCentro
    })

    if (!centro) return

    handleChange({ target: { name: 'centroCusto', value: String(centro.id ?? centro.nome) } })
  }, [centrosCusto, form.centroCusto, handleChange, hasCentrosCusto, isEditing, searchParams])

  useEffect(() => {
    const materialIdParam = (searchParams.get('materialId') || '').trim()
    if (!materialIdParam) return
    if (isEditing) return
    if (form.materialId) return
    const material = materiaisMap.get(materialIdParam)
    if (material) {
      handleMaterialSelect(material)
    }
  }, [form.materialId, handleMaterialSelect, isEditing, materiaisMap, searchParams])

  const handleOpenDetalhes = (entrada) => {
    if (!entrada) {
      return
    }
    setDetalheEntrada(entrada)
  }

  const handleCloseDetalhes = () => {
    setDetalheEntrada(null)
  }

  const detalheMaterial = detalheEntrada ? materiaisMap.get(detalheEntrada.materialId) : null
  const detalheCentroCustoLabel = detalheEntrada
    ? resolveCentroCustoLabel(detalheEntrada) || detalheEntrada.centroCusto || '-'
    : '-'
  const detalheCadastradoEm =
    detalheEntrada?.criadoEm ||
    detalheEntrada?.created_at ||
    detalheEntrada?.create_at ||
    detalheEntrada?.createdAt ||
    detalheEntrada?.dataEntrada ||
    ''
  const detalheRegistradoPor =
    detalheEntrada?.usuarioResponsavelNome ||
    detalheEntrada?.usuarioResponsavel ||
    detalheEntrada?.usuarioResponsavelId ||
    ''
  const detalheValorUnitario = Number(detalheMaterial?.valorUnitario ?? 0)
  const detalheValorTotal = detalheValorUnitario * Number(detalheEntrada?.quantidade ?? 0)
  const detalheMaterialResumo = detalheMaterial ? formatMaterialSummary(detalheMaterial) : ''
  const detalheMaterialId = detalheMaterial?.id || detalheEntrada?.materialId || ''
  const detalheDescricaoMaterial = detalheMaterial?.descricao || 'Nao informado'
  const detalheStatusLabel = detalheEntrada?.statusNome || detalheEntrada?.status || 'Nao informado'
  const detalheAtualizadoEm = detalheEntrada?.atualizadoEm || detalheEntrada?.atualizado_em || ''
  const detalheUsuarioEdicao =
    detalheEntrada?.usuarioEdicaoNome || detalheEntrada?.usuarioEdicao || detalheEntrada?.usuarioEdicaoId || ''

  return (
    <div className="stack">
      <PageHeader
        icon={<EntryIcon size={28} />}
        title="Entradas"
        subtitle="Registre novas entradas e mantenha rastreabilidade do estoque."
        actions={<HelpButton topic="entradas" />}
      />

      <section className="card">
        <header className="card__header">
          <h2>{isEditing ? 'Editando...' : 'Registrar entrada'}</h2>
        </header>
        <form className={`form${isEditing ? ' form--editing' : ''}`} onSubmit={handleSubmit}>
          <div className="form__grid form__grid--two">
          <label className="field">
            <span>Centro de estoque <span className="asterisco">*</span></span>
            <select
              name="centroCusto"
              value={form.centroCusto}
              onChange={handleChange}
              required
              disabled={!hasCentrosCusto}
            >
              <option value="">
                {hasCentrosCusto ? 'Selecione um centro de estoque' : 'Nenhum centro de estoque cadastrado'}
              </option>
              {centrosCusto.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field autocomplete">
            <span>Material <span className="asterisco">*</span> </span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={materialSearchValue}
                onChange={handleMaterialInputChange}
                onFocus={handleMaterialFocus}
                onBlur={handleMaterialBlur}
                placeholder={form.centroCusto ? 'Digite para buscar materiais' : 'Selecione o centro de estoque primeiro'}
                disabled={!form.centroCusto}
                required
              />
              {materialSearchValue ? (
                <button type="button" className="autocomplete__clear" onClick={handleMaterialClear} disabled={!form.centroCusto}>
                  &times;
                </button>
              ) : null}
              {shouldShowMaterialDropdown ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingMaterials ? <p className="autocomplete__feedback">Buscando materiais...</p> : null}
                  {!isSearchingMaterials && materialSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{materialSearchError}</p>
                  ) : null}
                  {!isSearchingMaterials && !materialSearchError && materialSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhum material encontrado.</p>
                  ) : null}
                  {materialSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleMaterialSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatMaterialSummary(item)}</span>
                      <span className="autocomplete__secondary">ID: {item.nomeId || item.id}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field">
            <span>Quantidade <span className="asterisco">*</span></span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>Data da entrada <span className="asterisco">*</span></span>
            <input type="date" name="dataEntrada" value={form.dataEntrada} onChange={handleChange} required />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? (isEditing ? 'Salvando...' : 'Registrando...') : isEditing ? 'Salvar alterações' : 'Registrar entrada'}
          </button>
          {isEditing ? (
            <button type="button" className="button button--ghost" onClick={cancelEdit} disabled={isSaving}>
              Cancelar edição
            </button>
          ) : null}
        </div>
        </form>
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Filtros</h2>
        </header>
        <form className="form form--inline" onSubmit={handleFilterSubmit}>
          <label className="field">
            <span>Buscar</span>
            <input name="termo" value={filters.termo} onChange={handleFilterChange} placeholder="Buscar por material" />
          </label>
          <label className="field">
            <span>Registrado por</span>
            <select name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {registeredOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Centro de estoque</span>
            <select name="centroCusto" value={filters.centroCusto} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {centroCustoFilterOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {statusOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Data inicial</span>
            <input type="date" name="dataInicio" value={filters.dataInicio} onChange={handleFilterChange} />
          </label>
          <label className="field">
            <span>Data final</span>
            <input type="date" name="dataFim" value={filters.dataFim} onChange={handleFilterChange} />
          </label>
          <div className="form__actions">
            <button type="submit" className="button button--ghost">
              Aplicar
            </button>
            <button type="button" className="button button--ghost" onClick={handleFilterClear}>
              Limpar
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Historico de entradas</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => load(filters, { refreshCatalogs: true })}
            disabled={isLoading}
          >
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && entradas.length === 0 ? <p className="feedback">Nenhuma entrada registrada.</p> : null}
        {entradas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Centro de estoque</th>
                  <th>Material</th>
                  <th>Descricao</th>
                  <th>Quantidade</th>
                  <th>Status</th>
                  <th>Registrado por</th>
                  <th>Cadastrado em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntradas.map((entrada) => {
                  const material = materiaisMap.get(entrada.materialId)
                  const centroCustoLabel = resolveCentroCustoLabel(entrada) || '-'
                  const materialResumo = material ? formatMaterialSummary(material) : 'Material removido'
                  const materialIdLabel = material?.id || entrada.materialId || 'Não informado'
                  const descricaoMaterial = material?.descricao || 'Não informado'
                  const registradoPor =
                    entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || entrada.usuarioResponsavelId || 'Nao informado'
                  const cadastradoEm =
                    entrada.criadoEm ||
                    entrada.created_at ||
                    entrada.create_at ||
                    entrada.createdAt ||
                    entrada.dataEntrada ||
                    entrada.data_entrada
                  const cadastradoEmLabel = cadastradoEm ? formatDisplayDateTime(cadastradoEm) : 'Nao informado'
                  const statusLabel = entrada.statusNome || entrada.status || 'Nao informado'
                  return (
                    <tr key={entrada.id} className={isEntradaCancelada(entrada) ? 'data-table__row--muted' : ''}>
                      <td>{centroCustoLabel}</td>
                      <td>
                        <strong>{materialResumo}</strong>
                        <p className="data-table__muted">ID: {materialIdLabel}</p>
                      </td>
                      <td>{descricaoMaterial}</td>
                      <td>{entrada.quantidade}</td>
                      <td>{statusLabel}</td>
                      <td>{registradoPor}</td>
                      <td>{cadastradoEmLabel}</td>
                      <td>
                        <div className="table-actions materiais-data-table__actions">
                          <button
                            type="button"
                            className="materiais-table-action-button"
                            onClick={() => handleOpenDetalhes(entrada)}
                            aria-label={`Ver detalhes da entrada ${entrada.id}`}
                            title="Ver detalhes"
                          >
                            <Eye size={16} strokeWidth={1.8} />
                          </button>
                          {!isEntradaCancelada(entrada) ? (
                            <>
                              <button
                                type="button"
                                className="materiais-table-action-button"
                                onClick={() => startEditEntrada(entrada)}
                                aria-label={`Editar entrada ${entrada.id}`}
                                title="Editar entrada"
                              >
                                <EditIcon size={16} />
                              </button>
                              <button
                                type="button"
                                className="materiais-table-action-button"
                                onClick={() => openHistory(entrada)}
                                aria-label={`Historico da entrada ${entrada.id}`}
                                title="Histórico da entrada"
                              >
                                <HistoryIcon size={16} />
                              </button>
                              <button
                                type="button"
                                className="materiais-table-action-button materiais-table-action-button--danger"
                                onClick={() => openCancelModal(entrada)}
                                aria-label={`Cancelar entrada ${entrada.id}`}
                                title="Cancelar entrada"
                              >
                                <CancelIcon size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="materiais-table-action-button"
                              onClick={() => openHistory(entrada)}
                              aria-label={`Historico da entrada ${entrada.id}`}
                              title="Histórico da entrada"
                            >
                              <HistoryIcon size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <TablePagination
          totalItems={filteredEntradas.length}
          pageSize={TABLE_PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>
      <EntradaDetailsModal
        open={Boolean(detalheEntrada)}
        entrada={detalheEntrada}
        materialResumo={detalheMaterialResumo}
        materialId={detalheMaterialId}
        descricaoMaterial={detalheDescricaoMaterial}
        centroCustoLabel={detalheCentroCustoLabel}
        dataEntrada={detalheEntrada?.dataEntrada}
        statusLabel={detalheStatusLabel}
        valorUnitario={detalheValorUnitario}
        valorTotal={detalheValorTotal}
        registradoPor={detalheRegistradoPor}
        cadastradoEm={detalheCadastradoEm}
        atualizadoEm={detalheAtualizadoEm}
        usuarioEdicao={detalheUsuarioEdicao}
        onClose={handleCloseDetalhes}
        formatCurrency={formatCurrency}
        formatDisplayDate={formatDisplayDate}
        formatDisplayDateTime={formatDisplayDateTime}
      />
      <EntradaCancelModal
        state={cancelState}
        onClose={closeCancelModal}
        onConfirm={handleCancelSubmit}
        onMotivoChange={(value) => setCancelState((prev) => ({ ...prev, motivo: value }))}
        isSaving={cancelState.isSubmitting}
      />
            <EntradasHistoryModal state={historyState} onClose={closeHistory} />
    </div>
  )
}

export function EntradasPage() {
  return (
    <EntradasProvider>
      <EntradasContent />
    </EntradasProvider>
  )
}
