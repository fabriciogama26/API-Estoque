import { PageHeader } from '../components/PageHeader.jsx'
import { ExitIcon, EditIcon, HistoryIcon, CancelIcon } from '../components/icons.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { SaidasHistoryModal } from '../components/Saidas/SaidasHistoryModal.jsx'
import { SaidasProvider, useSaidasContext } from '../context/SaidasContext.jsx'
import '../styles/MateriaisPage.css'

function SaidasContent() {
  const {
    form,
    filters,
    saidas,
    pessoas,
    materiais,
    centrosCustoOptions,
    centrosServicoOptions,
    editingSaida,
    isSaving,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    historyState,
    cancelState,
    materialSearchValue,
    materialSuggestions,
    materialDropdownOpen,
    isSearchingMaterials,
    materialSearchError,
    materialEstoque,
    materialEstoqueLoading,
    materialEstoqueError,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    isSaidaCancelada,
    load,
    handleChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    cancelEditSaida,
    startEditSaida,
    openHistory,
    closeHistory,
    openCancelModal,
    closeCancelModal,
    handleCancelSubmit,
    handleMaterialInputChange,
    handleMaterialSelect,
    handleMaterialFocus,
    handleMaterialBlur,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    resetFormState,
    paginatedSaidas,
    saidasFiltradas,
    formatCurrency,
    formatDisplayDate,
    formatDisplayDateTime,
    formatMaterialSummary,
    formatPessoaSummary,
    formatPessoaDetail,
    setCancelState,
  } = useSaidasContext()

  return (
    <div className="stack">
      <PageHeader
        icon={<ExitIcon size={28} />}
        title="Saidas"
        subtitle="Registre entregas de EPIs e acompanhe o historico."
      />

      <form className="card form" onSubmit={handleSubmit}>
        <h2>Registrar saida</h2>
        <div className="form__grid form__grid--two">
          <label className="field autocomplete">
            <span>Pessoa*</span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={pessoaSearchValue}
                onChange={handlePessoaInputChange}
                onFocus={handlePessoaFocus}
                onBlur={handlePessoaBlur}
                placeholder="Digite para buscar colaborador"
                required
              />
              {pessoaSearchValue ? (
                <button type="button" className="autocomplete__clear" onClick={() => resetFormState()}>
                  &times;
                </button>
              ) : null}
              {pessoaDropdownOpen &&
              !form.pessoaId &&
              (isSearchingPessoas || pessoaSearchError || pessoaSuggestions.length > 0) ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingPessoas ? <p className="autocomplete__feedback">Buscando pessoas...</p> : null}
                  {!isSearchingPessoas && pessoaSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{pessoaSearchError}</p>
                  ) : null}
                  {!isSearchingPessoas && !pessoaSearchError && pessoaSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhuma pessoa encontrada.</p>
                  ) : null}
                  {pessoaSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handlePessoaSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatPessoaSummary(item)}</span>
                      <span className="autocomplete__secondary">{formatPessoaDetail(item)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

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
                <button type="button" className="autocomplete__clear" onClick={() => resetFormState()}>
                  &times;
                </button>
              ) : null}
              {materialDropdownOpen &&
              !form.materialId &&
              (isSearchingMaterials || materialSearchError || materialSuggestions.length > 0) ? (
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
            <span>Centro de estoque</span>
            <select name="centroCusto" value={form.centroCusto} onChange={handleChange}>
              <option value="">Selecione</option>
              {centrosCustoOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Centro de serviço</span>
            <select name="centroServico" value={form.centroServico} onChange={handleChange}>
              <option value="">Selecione</option>
              {centrosServicoOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Data da entrega*</span>
            <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} required />
          </label>

          {materialEstoqueLoading ? <p className="feedback">Consultando estoque...</p> : null}
          {materialEstoqueError ? <p className="feedback feedback--error">{materialEstoqueError}</p> : null}
          {materialEstoque ? (
            <p className="feedback">
              Saldo atual: {materialEstoque.quantidade ?? 0} | Min: {materialEstoque.estoqueMinimo ?? 0} | Valor unit.:{' '}
              {formatCurrency(materialEstoque.valorUnitario ?? 0)}
            </p>
          ) : null}
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? (editingSaida ? 'Salvando...' : 'Registrando...') : editingSaida ? 'Salvar alteracoes' : 'Registrar saida'}
          </button>
          {editingSaida ? (
            <button type="button" className="button button--ghost" onClick={cancelEditSaida} disabled={isSaving}>
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>

      <form className="form form--inline" onSubmit={handleFilterSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input name="termo" value={filters.termo} onChange={handleFilterChange} placeholder="Buscar por pessoa ou material" />
        </label>
        <label className="field">
          <span>Registrado por</span>
          <input name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange} placeholder="ID ou nome" />
        </label>
        <label className="field">
          <span>Centro de estoque</span>
          <input name="centroCusto" value={filters.centroCusto} onChange={handleFilterChange} placeholder="Centro de estoque" />
        </label>
        <label className="field">
          <span>Centro de serviço</span>
          <input name="centroServico" value={filters.centroServico} onChange={handleFilterChange} placeholder="Centro de serviço" />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="registrado">Registrado</option>
            <option value="cancelado">Cancelado</option>
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
          <h2>Historico de saídas</h2>
          <button type="button" className="button button--ghost" onClick={() => load(filters, { resetPage: true })} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && saidas.length === 0 ? <p className="feedback">Nenhuma saída registrada.</p> : null}
        {saidas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>Centro de estoque</th>
                  <th>Centro de serviço</th>
                  <th>Data</th>
                  <th>Registrado por</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSaidas.map((saida) => {
                  const pessoa = pessoas.find((p) => p.id === saida.pessoaId)
                  const material = materiais.find((m) => m.id === saida.materialId)
                  const statusLower = (saida.status || '').toString().trim().toLowerCase()
                  const registradoPor = saida.usuarioResponsavelUsername || saida.usuarioResponsavelNome || saida.usuarioResponsavel || 'Nao informado'
                  return (
                    <tr key={saida.id} className={isSaidaCancelada(saida) ? 'data-table__row--muted' : ''}>
                      <td>
                        <strong>{formatPessoaSummary(pessoa) || saida.pessoaId || 'Pessoa removida'}</strong>
                        <p className="data-table__muted">{formatPessoaDetail(pessoa)}</p>
                      </td>
                      <td>
                        <strong>{formatMaterialSummary(material) || saida.materialId || 'Material removido'}</strong>
                        <p className="data-table__muted">
                          ID: {material?.id || saida.materialId || 'Nao informado'} | Valor unit.:{' '}
                          {formatCurrency(material?.valorUnitario ?? 0)}
                        </p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>{saida.centroCusto || saida.centroCustoId || '-'}</td>
                      <td>{saida.centroServico || saida.centroServicoId || '-'}</td>
                      <td>{formatDisplayDateTime(saida.dataEntrega)}</td>
                      <td>{registradoPor}</td>
                      <td className={statusLower === 'cancelado' ? 'text-muted' : ''}>{saida.status || 'registrado'}</td>
                      <td>
                        <div className="table-actions materiais-data-table__actions">
                          {!isSaidaCancelada(saida) ? (
                            <button
                              type="button"
                              className="materiais-table-action-button"
                              onClick={() => startEditSaida(saida)}
                              aria-label={`Editar saida ${saida.id}`}
                              title="Editar saida"
                            >
                              <EditIcon size={16} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="materiais-table-action-button"
                            onClick={() => openHistory(saida)}
                            aria-label={`Historico da saida ${saida.id}`}
                            title="Historico da saida"
                          >
                            <HistoryIcon size={16} />
                          </button>
                          {!isSaidaCancelada(saida) ? (
                          <button
                            type="button"
                            className="materiais-table-action-button materiais-table-action-button--danger"
                            onClick={() => openCancelModal(saida)}
                            aria-label={`Cancelar saida ${saida.id}`}
                            title="Cancelar saida"
                          >
                              <CancelIcon size={16} />
                            </button>
                          ) : null}
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
          totalItems={saidasFiltradas.length}
          pageSize={TABLE_PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>

      <SaidasHistoryModal state={historyState} onClose={closeHistory} />
      {cancelState.open ? (
        <div className="modal__overlay" role="dialog" aria-modal="true" onClick={closeCancelModal}>
          <div className="modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="modal__header">
              <h3>Cancelar saída</h3>
              <button type="button" className="modal__close" onClick={closeCancelModal} aria-label="Fechar">
                <CancelIcon size={18} />
              </button>
            </header>
            <div className="modal__body">
              <p>Informe um motivo para cancelamento:</p>
              <textarea
                rows={3}
                value={cancelState.motivo}
                onChange={(e) => setCancelState((prev) => ({ ...prev, motivo: e.target.value }))}
              />
              {cancelState.error ? <p className="feedback feedback--error">{cancelState.error}</p> : null}
            </div>
            <footer className="modal__footer">
              <button type="button" className="button button--ghost" onClick={closeCancelModal} disabled={cancelState.isSubmitting}>
                Fechar
              </button>
              <button type="button" className="button button--danger" onClick={handleCancelSubmit} disabled={cancelState.isSubmitting}>
                {cancelState.isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function SaidasPage() {
  return (
    <SaidasProvider>
      <SaidasContent />
    </SaidasProvider>
  )
}
