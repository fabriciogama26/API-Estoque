import { useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { ExitIcon, EditIcon, HistoryIcon, CancelIcon } from '../components/icons.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { SaidasHistoryModal } from '../components/Saidas/SaidasHistoryModal.jsx'
import { SaidasProvider, useSaidasContext } from '../context/SaidasContext.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import '../styles/MateriaisPage.css'

function SaidasContent() {
  const [searchParams] = useSearchParams()
  const [detalheState, setDetalheState] = useState({ open: false, saida: null, pessoa: null, material: null })
  const {
    form,
    filters,
    saidas,
    pessoas,
    materiais,
    centrosEstoqueOptions,
    statusOptions,
    centroEstoqueFilterOptions,
    centroServicoFilterOptions,
    registradoPorFilterOptions,
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
    formatDisplayDateSimple,
    formatDisplayDate,
    formatDisplayDateTime,
    formatMaterialSummary,
    formatPessoaSummary,
    formatPessoaDetail,
    trocaPrazoFilterOptions,
    setCancelState,
  } = useSaidasContext()

  useEffect(() => {
    const centroParam = (searchParams.get('centroEstoque') || searchParams.get('centroEstoqueId') || '').trim()
    if (!centroParam) return
    if (editingSaida) return
    if (form.centroEstoqueId) return

    const normalizedCentro = centroParam.toLowerCase()
    const centro = (centrosEstoqueOptions || []).find((item) => {
      const value = String(item?.id ?? item?.nome ?? '').trim()
      const nome = String(item?.nome ?? '').trim()
      return value === centroParam || nome.toLowerCase() === normalizedCentro
    })
    if (centro) {
      handleChange({ target: { name: 'centroEstoqueId', value: String(centro.id ?? centro.nome) } })
    }
  }, [centrosEstoqueOptions, editingSaida, form.centroEstoqueId, handleChange, searchParams])

  useEffect(() => {
    const materialIdParam = (searchParams.get('materialId') || '').trim()
    if (!materialIdParam) return
    if (editingSaida) return
    if (!form.centroEstoqueId) return
    if (form.materialId) return
    const material = materiais.find((item) => String(item?.id) === materialIdParam)
    if (material) {
      handleMaterialSelect(material)
    }
  }, [editingSaida, form.centroEstoqueId, form.materialId, handleMaterialSelect, materiais, searchParams])

  const handleOpenDetalhes = (saida) => {
    const pessoa = pessoas.find((p) => p.id === saida.pessoaId)
    const material = materiais.find((m) => m.id === saida.materialId)
    setDetalheState({ open: true, saida, pessoa, material })
  }

  const handleCloseDetalhes = () => {
    setDetalheState({ open: false, saida: null, pessoa: null, material: null })
  }

  const resolveCentroEstoqueNome = (valor) => {
    if (!valor) return '-'
    const found = centrosEstoqueOptions.find((c) => String(c.id) === String(valor))
    return found?.nome || valor
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<ExitIcon size={28} />}
        title="Saídas"
        subtitle="Registre entregas de EPIs e acompanhe o histórico."
        actions={<HelpButton topic="saidas" />}
      />

      <section className="card">
        <header className="card__header">
          <h2>{editingSaida ? 'Editando...' : 'Registrar saída'}</h2>
        </header>
        <form className={`form${editingSaida ? ' form--editing' : ''}`} onSubmit={handleSubmit}>
          <div className="form__grid form__grid--two">
          <label className="field autocomplete">
            <span>Pessoa <span className="asterisco">*</span></span>
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

          <label className="field">
            <span>Centro de estoque <span className="asterisco">*</span></span>
            <select name="centroEstoqueId" value={form.centroEstoqueId} onChange={handleChange} required>
              <option value="">Selecione</option>
              {centrosEstoqueOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field autocomplete">
            <span>Material <span className="asterisco">*</span></span>
            <div className="autocomplete__control">
              <input
                className="autocomplete__input"
                value={materialSearchValue}
                onChange={handleMaterialInputChange}
                onFocus={handleMaterialFocus}
                onBlur={handleMaterialBlur}
                placeholder="Digite para buscar materiais"
                disabled={!form.centroEstoqueId}
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
                      <span className="autocomplete__secondary">
                        ID: {item.nomeId || item.id}
                        {item.ca ? ` | CA: ${item.ca}` : ''}
                      </span>
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

          <label className="field field--accent">
            <span>Em estoque</span>
            <input
              value={
                materialEstoqueLoading
                  ? 'Consultando...'
                  : form.materialId
                  ? materialEstoque?.quantidade ?? 0
                  : ''
              }
              readOnly
              disabled
            />
          </label>

          <label className="field">
            <span>Centro de Custo</span>
            <input
              name="centroCusto"
              value={form.centroCusto}
              onChange={handleChange}
              placeholder="Centro de custo do colaborador"
              readOnly
              required
            />
          </label>

          <label className="field">
            <span>Centro de serviço</span>
            <input
              name="centroServico"
              value={form.centroServico}
              onChange={handleChange}
              placeholder="Centro de serviço do colaborador"
              readOnly
              required
            />
          </label>

          <label className="field">
            <span>Data da entrega <span className="asterisco">*</span></span>
            <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} required />
          </label>

          {materialEstoqueLoading ? <p className="feedback">Consultando estoque...</p> : null}
          {materialEstoqueError ? <p className="feedback feedback--error">{materialEstoqueError}</p> : null}
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving
              ? editingSaida
                ? 'Salvando...'
                : 'Registrando...'
              : editingSaida
              ? 'Salvar alterações'
              : 'Registrar saída'}
          </button>
          {editingSaida ? (
            <button type="button" className="button button--ghost" onClick={cancelEditSaida} disabled={isSaving}>
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
            <input
              name="termo"
              value={filters.termo}
              onChange={handleFilterChange}
              placeholder="Buscar por pessoa ou material"
            />
          </label>
          <label className="field">
            <span>Registrado por</span>
            <select name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {registradoPorFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {statusOptions.map((opt) => (
                <option key={opt.id ?? opt.label} value={opt.id ?? opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prazo de troca</span>
            <select name="trocaPrazo" value={filters.trocaPrazo} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {trocaPrazoFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
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
          <h2>Lista de saídas</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => load(filters, { resetPage: true })}
            disabled={isLoading}
          >
            Atualizar
          </button>
        </header>
        <div className="saidas-legend" aria-label="Legenda das datas de troca">
          <div className="saidas-legend__item">
            <span className="saidas-legend__dot saidas-legend__dot--limite" aria-hidden="true" />
            <span>Data limite</span>
          </div>
          <div className="saidas-legend__item">
            <span className="saidas-legend__dot saidas-legend__dot--alerta" aria-hidden="true" />
            <span>7 dias para o limite da troca</span>
          </div>
          <div className="saidas-legend__item">
            <span className="saidas-legend__dot saidas-legend__dot--atrasada" aria-hidden="true" />
            <span>Limite passado</span>
          </div>
        </div>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && saidas.length === 0 ? <p className="feedback">Nenhuma saída registrada.</p> : null}
        {saidas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table data-table--saidas">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>Data entrega</th>
                  <th>Status</th>
                  <th>Registrado por</th>
                  <th>Cadastrado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSaidas.map((saida) => {
                  const pessoa = pessoas.find((p) => p.id === saida.pessoaId)
                  const material = materiais.find((m) => m.id === saida.materialId)
                  const statusLower = (saida.status || '').toString().trim().toLowerCase()
                  const registradoPor =
                    saida.usuarioResponsavelUsername ||
                    saida.usuarioResponsavelNome ||
                    saida.usuarioResponsavel ||
                    'Não informado'
                  const trocaStatus = saida.trocaPrazo
                  const rowClassName = [
                    isSaidaCancelada(saida) ? 'data-table__row--muted' : '',
                    trocaStatus ? `data-table__row--troca-${trocaStatus.variant}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <tr
                      key={saida.id}
                      className={rowClassName}
                title={
                  trocaStatus && saida.dataTroca
                    ? `${trocaStatus.label} (${formatDisplayDateSimple(saida.dataTroca)})`
                    : undefined
                }
                    >
                      <td>
                        <strong>{formatPessoaSummary(pessoa) || saida.pessoaId || 'Pessoa removida'}</strong>
                        <p className="data-table__muted">{formatPessoaDetail(pessoa)}</p>
                      </td>
                      <td>
                        <strong>{formatMaterialSummary(material) || saida.materialId || 'Material removido'}</strong>
                        <p className="data-table__muted">
                          ID: {material?.id || saida.materialId || 'Não informado'} | Valor unit.:{' '}
                          {formatCurrency(material?.valorUnitario ?? 0)}
                        </p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>
                        {formatDisplayDateTime(saida.dataEntrega)}
                        <p className="data-table__muted">
                          {saida.dataTroca
                            ? `Troca: ${formatDisplayDateSimple(saida.dataTroca)}`
                            : 'Troca: não informada'}
                          {trocaStatus ? ` - ${trocaStatus.label}` : ''}
                        </p>
                      </td>
                      <td className={statusLower === 'cancelado' ? 'text-muted' : ''}>{saida.status || 'Registrado'}</td>
                      <td>{registradoPor}</td>
                      <td>{saida.criadoEm ? formatDisplayDateTime(saida.criadoEm) : '-'}</td>
                      <td>
                        <div className="table-actions materiais-data-table__actions">
                          <button
                      type="button"
                      className="materiais-table-action-button"
                      onClick={() => handleOpenDetalhes(saida)}
                      aria-label={`Ver detalhes da sa?da ${saida.id}`}
                      title="Ver detalhes"
                    >
                      <Eye size={16} strokeWidth={1.8} />
                    </button>
                    {!isSaidaCancelada(saida) ? (
                      <button
                        type="button"
                        className="materiais-table-action-button"
                        onClick={() => startEditSaida(saida)}
                        aria-label={`Editar sa?da ${saida.id}`}
                        title="Editar sa?da"
                      >
                        <EditIcon size={16} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="materiais-table-action-button"
                      onClick={() => openHistory(saida)}
                      aria-label={`Hist?rico da sa?da ${saida.id}`}
                      title="Hist?rico da sa?da"
                    >
                      <HistoryIcon size={16} />
                    </button>
                    {!isSaidaCancelada(saida) ? (
                      <button
                        type="button"
                        className="materiais-table-action-button materiais-table-action-button--danger"
                        onClick={() => openCancelModal(saida)}
                        aria-label={`Cancelar sa?da ${saida.id}`}
                        title="Cancelar sa?da"
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
      {detalheState.open && detalheState.saida ? (
        <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={handleCloseDetalhes}>
          <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
            <header className="saida-details__header">
              <div>
                <p className="saida-details__eyebrow">ID da saída</p>
                <h3 className="saida-details__title">{detalheState.saida.id || 'ID não informado'}</h3>
              </div>
              <button type="button" className="saida-details__close" onClick={handleCloseDetalhes} aria-label="Fechar detalhes">
                <CancelIcon size={18} />
              </button>
            </header>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Dados principais</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Pessoa</span>
                  <p className="saida-details__value">
                    {formatPessoaSummary(detalheState.pessoa) || detalheState.saida.pessoaId || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Material</span>
                  <p className="saida-details__value">
                    {formatMaterialSummary(detalheState.material) || detalheState.saida.materialId || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Quantidade</span>
                  <p className="saida-details__value">{detalheState.saida.quantidade ?? '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Status</span>
                  <p className="saida-details__value">{detalheState.saida.status || 'Registrado'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Data de entrega</span>
                  <p className="saida-details__value">{formatDisplayDateTime(detalheState.saida.dataEntrega)}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Data de troca</span>
                  <p className="saida-details__value">
                    {detalheState.saida.dataTroca ? formatDisplayDateTime(detalheState.saida.dataTroca) : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Centros</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Centro de estoque</span>
                  <p className="saida-details__value">
                    {resolveCentroEstoqueNome(detalheState.saida.centroEstoque || detalheState.saida.centroEstoqueId)}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Centro de custo</span>
                  <p className="saida-details__value">
                    {detalheState.saida.centroCusto || detalheState.saida.centroCustoId || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Centro de serviço</span>
                  <p className="saida-details__value">
                    {detalheState.saida.centroServico || detalheState.saida.centroServicoId || '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Registro</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Registrado por</span>
                  <p className="saida-details__value">
                    {detalheState.saida.usuarioResponsavelNome ||
                      detalheState.saida.usuarioResponsavel ||
                      detalheState.saida.usuarioResponsavelId ||
                      'Não informado'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Cadastrado em</span>
                  <p className="saida-details__value">
                    {detalheState.saida.criadoEm ? formatDisplayDateTime(detalheState.saida.criadoEm) : '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Atualizado em</span>
                  <p className="saida-details__value">
                    {detalheState.saida.atualizadoEm ? formatDisplayDateTime(detalheState.saida.atualizadoEm) : '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Usuário edição</span>
                  <p className="saida-details__value">
                    {detalheState.saida.usuarioEdicao || detalheState.saida.usuarioEdicaoId || '-'}
                  </p>
                </div>
              </div>
            </div>

            <footer className="saida-details__footer">
              <button type="button" className="button button--ghost" onClick={handleCloseDetalhes}>
                Fechar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
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
                className="modal__textarea"
                rows={3}
                value={cancelState.motivo}
                onChange={(e) => setCancelState((prev) => ({ ...prev, motivo: e.target.value }))}
                placeholder="Descreva o motivo do cancelamento"
              />
              {cancelState.error ? <p className="feedback feedback--error">{cancelState.error}</p> : null}
            </div>
            <footer className="modal__footer">
              <button type="button" className="button button--ghost" onClick={closeCancelModal} disabled={cancelState.isSubmitting}>
                Fechar
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={handleCancelSubmit}
                disabled={cancelState.isSubmitting || !cancelState.motivo.trim()}
              >
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
