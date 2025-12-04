import { PageHeader } from '../components/PageHeader.jsx'
import { EntryIcon, EditIcon, HistoryIcon } from '../components/icons.jsx'
import { EntradasHistoryModal } from '../components/Entradas/EntradasHistoryModal.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { EntradasProvider, useEntradasContext } from '../context/EntradasContext.jsx'
import { formatCurrency, formatDisplayDate, formatMaterialSummary } from '../utils/entradasUtils.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import '../styles/MateriaisPage.css'

function EntradasContent() {
  const {
    form,
    filters,
    entradas,
    centrosCusto,
    materiaisMap,
    registeredOptions,
    centroCustoFilterOptions,
    resolveCentroCustoLabel,
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
    startEditEntrada,
    openHistory,
    historyState,
    closeHistory,
  } = useEntradasContext()

  return (
    <div className="stack">
      <PageHeader
        icon={<EntryIcon size={28} />}
        title="Entradas"
        subtitle="Registre novas entradas e mantenha rastreabilidade do estoque."
        actions={<HelpButton topic="entradas" />}
      />

      <form className="card form" onSubmit={handleSubmit}>
        <h2>Registrar entrada</h2>
        <div className="form__grid form__grid--two">
          <label className="field autocomplete">
            <span>Material*</span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={materialSearchValue}
                onChange={handleMaterialInputChange}
                onFocus={handleMaterialFocus}
                onBlur={handleMaterialBlur}
                placeholder="Digite para buscar materiais"
                required
              />
              {materialSearchValue ? (
                <button type="button" className="autocomplete__clear" onClick={handleMaterialClear}>
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
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
          <label className="field">
            <span>Centro de estoque*</span>
            {hasCentrosCusto ? (
              <select name="centroCusto" value={form.centroCusto} onChange={handleChange} required>
                <option value="">Selecione um centro de estoque</option>
                {centrosCusto.map((item) => (
                  <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                    {item.nome}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="centroCusto"
                value={form.centroCusto}
                onChange={handleChange}
                required
                placeholder="Informe o centro de estoque"
              />
            )}
          </label>
          <label className="field">
            <span>Data da entrada*</span>
            <input type="date" name="dataEntrada" value={form.dataEntrada} onChange={handleChange} required />
          </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? (isEditing ? 'Salvando...' : 'Registrando...') : isEditing ? 'Salvar alteracoes' : 'Registrar entrada'}
          </button>
        </div>
      </form>

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
                  <th>Material</th>
                  <th>Descricao</th>
                  <th>Quantidade</th>
                  <th>Centro de estoque</th>
                  <th>Valor total</th>
                  <th>Data</th>
                  <th>Registrado por</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntradas.map((entrada) => {
                  const material = materiaisMap.get(entrada.materialId)
                  const valorUnitario = Number(material?.valorUnitario ?? 0)
                  const total = valorUnitario * Number(entrada.quantidade ?? 0)
                  const centroCustoLabel = resolveCentroCustoLabel(entrada) || '-'
                  const materialResumo = material ? formatMaterialSummary(material) : 'Material removido'
                  const materialIdLabel = material?.id || entrada.materialId || 'Nao informado'
                  const descricaoMaterial = material?.descricao || 'Nao informado'
                  return (
                    <tr key={entrada.id}>
                      <td>
                        <strong>{materialResumo}</strong>
                        <p className="data-table__muted">ID: {materialIdLabel}</p>
                      </td>
                      <td>{descricaoMaterial}</td>
                      <td>{entrada.quantidade}</td>
                      <td>{centroCustoLabel}</td>
                      <td>{formatCurrency(total)}</td>
                      <td>{formatDisplayDate(entrada.dataEntrada)}</td>
                      <td>{entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || 'Nao informado'}</td>
                      <td>
                        <div className="table-actions materiais-data-table__actions">
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
                            title="Historico da entrada"
                          >
                            <HistoryIcon size={16} />
                          </button>
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
