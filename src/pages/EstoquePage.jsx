import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon, RefreshIcon, SpreadsheetIcon } from '../components/icons.jsx'
import { EstoqueFilters } from '../components/Estoque/Filters/EstoqueFilters.jsx'
import { EstoqueAlerts } from '../components/Estoque/Alerts/EstoqueAlerts.jsx'
import { EstoqueSummary } from '../components/Estoque/Summary/EstoqueSummary.jsx'
import { EstoqueList } from '../components/Estoque/List/EstoqueList.jsx'
import { EstoqueProvider, useEstoqueContext } from '../context/EstoqueContext.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { downloadEstoqueCsv } from '../utils/estoqueUtils.js'

import '../styles/EstoquePage.css'

export function EstoquePage() {
  return (
    <EstoqueProvider>
      <EstoquePageContent />
    </EstoqueProvider>
  )
}

function EstoquePageContent() {
  const {
    filters,
    handleFilterChange,
    applyFilters,
    resetFilters,
    centrosCustoDisponiveis,
    error,
    alertasPaginados,
    alertasPage,
    totalAlertasPages,
    setAlertasPage,
    alertasPageSize,
    totalAlertas,
    summaryCards,
    paginatedItens,
    itensPage,
    setItensPage,
    itensFiltrados,
    itensFiltradosBase,
    minStockDrafts,
    minStockErrors,
    savingMinStock,
    handleMinStockChange,
    handleMinStockSave,
  } = useEstoqueContext()

  const handleSubmit = (event) => {
    event.preventDefault()
    applyFilters()
  }

  const handleExportCsv = () => {
    const now = new Date()
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    const filename = `estoque-atual-${localDate}.csv`
    downloadEstoqueCsv(itensFiltradosBase, { filename })
  }

  const handleRefresh = () => {
    applyFilters()
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<InventoryIcon size={28} />}
        title="Estoque atual"
        subtitle="Consulte saldo por material, valor total e alertas de estoque minimo."
        actions={<HelpButton topic="estoque" />}
      />

      <EstoqueFilters
        filters={filters}
        centrosCusto={centrosCustoDisponiveis}
        onSubmit={handleSubmit}
        onChange={handleFilterChange}
        onClear={resetFilters}
      />

      <section className="card">
        <header className="card__header">
          <h2>Resumo</h2>
        </header>
        <EstoqueSummary cards={summaryCards} />
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Alertas de estoque</h2>
        </header>
        <EstoqueAlerts
          alertas={alertasPaginados}
          alertasPage={alertasPage}
          totalAlertasPages={totalAlertasPages}
          onPageChange={setAlertasPage}
          pageSize={alertasPageSize}
          totalAlertas={totalAlertas}
        />
      </section>

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <section className="card">
        <header className="card__header">
          <h2>Estoque materiais</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleExportCsv}
              aria-label="Exportar estoque atual em CSV"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <SpreadsheetIcon size={16} />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleRefresh}
              aria-label="Atualizar lista de estoque"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshIcon size={16} />
              <span>Atualizar</span>
            </button>
          </div>
        </header>
        <EstoqueList
          itens={paginatedItens}
          pageSize={10}
          currentPage={itensPage}
          totalItems={itensFiltrados.length}
          onPageChange={setItensPage}
          minStockDrafts={minStockDrafts}
          minStockErrors={minStockErrors}
          savingMinStock={savingMinStock}
          onMinStockChange={handleMinStockChange}
          onMinStockSave={handleMinStockSave}
        />
      </section>
    </div>
  )
}
