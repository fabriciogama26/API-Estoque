import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon } from '../components/icons.jsx'
import { EstoqueFilters } from '../components/Estoque/Filters/EstoqueFilters.jsx'
import { EstoqueAlerts } from '../components/Estoque/Alerts/EstoqueAlerts.jsx'
import { EstoqueSummary } from '../components/Estoque/Summary/EstoqueSummary.jsx'
import { EstoqueList } from '../components/Estoque/List/EstoqueList.jsx'
import { EstoqueProvider, useEstoqueContext } from '../context/EstoqueContext.jsx'

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
    isLoading,
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
    totalItensPages,
    setItensPage,
    itensFiltrados,
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

  return (
    <div className="stack">
      <PageHeader
        icon={<InventoryIcon size={28} />}
        title="Estoque atual"
        subtitle="Consulte saldo por material, valor total e alertas de estoque minimo."
      />

      <EstoqueFilters
        filters={filters}
        centrosCusto={centrosCustoDisponiveis}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onChange={handleFilterChange}
        onClear={resetFilters}
      />

      {error ? <p className="feedback feedback--error">{error}</p> : null}

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

      <section className="card">
        <header className="card__header">
          <h2>Resumo</h2>
        </header>
        <EstoqueSummary cards={summaryCards} />
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Estoque materiais</h2>
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
