import { useMemo } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import {
  DashboardIcon,
  MovementIcon,
  RevenueIcon,
  StockIcon,
  AlertIcon,
  BarsIcon,
  TrendIcon,
  ExpandIcon,
  CancelIcon,
  InfoIcon,
  PersonIcon,
} from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { EntradasSaidasChart, ValorMovimentadoChart } from '../components/charts/EntradasSaidasChart.jsx'
import { EstoquePorMaterialChart } from '../components/charts/EstoqueCharts.jsx'
import { EstoquePorCategoriaChart } from '../components/charts/EstoqueCategoriaChart.jsx'
import { DashboardEstoqueProvider, useDashboardEstoqueContext } from '../context/DashboardEstoqueContext.jsx'

import '../styles/DashboardPage.css'

function ChartInfoButton({ infoKey, label }) {
  const message = useDashboardEstoqueContext().chartInfoMessages[infoKey]
  if (!message) {
    return null
  }
  return (
    <button type="button" className="summary-tooltip dashboard-card__info" aria-label={label}>
      <InfoIcon size={14} />
      <span>{message}</span>
    </button>
  )
}

function ChartFilterBadge({ active, onClear }) {
  if (!active) {
    return null
  }
  return (
    <button type="button" className="chart-filter-inline" onClick={onClear}>
      <CancelIcon size={13} />
      Limpar
    </button>
  )
}

function ChartContainer({ chartFilter, onClear, children }) {
  return (
    <div className="dashboard-chart-container">
      <ChartFilterBadge active={Boolean(chartFilter)} onClear={onClear} />
      {children}
    </div>
  )
}

function FiltersForm() {
  const { filters, handleChange, handleSubmit, handleClear } = useDashboardEstoqueContext()
  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Periodo inicial</span>
          <input type="month" name="periodoInicio" value={filters.periodoInicio} onChange={handleChange} />
        </label>
        <label className="field">
          <span>Periodo final</span>
          <input
            type="month"
            name="periodoFim"
            value={filters.periodoFim}
            onChange={handleChange}
            min={filters.periodoInicio || undefined}
          />
        </label>
        <label className="field">
          <span>Busca</span>
          <input name="termo" value={filters.termo} onChange={handleChange} placeholder="ex: bota, 3M, luva" />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--primary">
            Aplicar filtros
          </button>
          <button type="button" className="button button--ghost" onClick={handleClear}>
            Limpar filtros
          </button>
        </div>
      </form>
    </section>
  )
}

function Highlights() {
  const { highlightCards } = useDashboardEstoqueContext()
  return (
    <div className="dashboard-highlights">
      {highlightCards.map(({ id, title, value, helper, tooltip, icon: IconComponent, tone }) => (
        <article
          key={id}
          className={`dashboard-insight-card dashboard-insight-card--${tone || 'slate'}${
            tooltip ? ' dashboard-insight-card--has-tooltip' : ''
          }`}
        >
          {tooltip ? (
            <div className="summary-tooltip summary-tooltip--floating" role="tooltip">
              <InfoIcon size={16} />
              <span>{tooltip}</span>
            </div>
          ) : null}
          <header className="dashboard-insight-card__header">
            <p className="dashboard-insight-card__title">{title}</p>
            <span className="dashboard-insight-card__avatar">
              <IconComponent size={22} />
            </span>
          </header>
          <strong className="dashboard-insight-card__value">{value}</strong>
          <span className="dashboard-insight-card__helper">{helper}</span>
        </article>
      ))}
    </div>
  )
}

function ChartsGrid() {
  const {
    chartFilter,
    applyChartFilter,
    clearChartFilter,
    expandedChartId,
    setExpandedChartId,
    seriesHistorica,
    valorMovimentadoSeries,
    estoquePorMaterialTop,
    estoquePorCategoria,
    rankingFabricantesTop,
    topCentrosServicoTop,
    topSetoresTop,
    topPessoasTop,
    formatPeriodoLabel,
    formatCurrency,
  } = useDashboardEstoqueContext()

  const handleChartSelect = (value, source) => {
    applyChartFilter(value, source)
    if (expandedChartId) {
      setExpandedChartId(null)
    }
  }

  const chartModalConfig = useMemo(
    () => ({
      entradas: {
        title: 'Entradas x Saidas',
        render: () => (
          <EntradasSaidasChart data={seriesHistorica} labelFormatter={formatPeriodoLabel} height={520} />
        ),
      },
      valor: {
        title: 'Valor movimentado',
        render: () => (
          <ValorMovimentadoChart data={valorMovimentadoSeries} valueFormatter={formatCurrency} height={520} />
        ),
      },
      estoqueMaterial: {
        title: 'Top materiais',
        render: () => (
          <EstoquePorMaterialChart
            data={estoquePorMaterialTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
          />
        ),
      },
      estoqueCategoria: {
        title: 'Top categorias',
        render: () => (
          <EstoquePorCategoriaChart
            data={estoquePorCategoria}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome || item?.categoria, 'categoria')}
          />
        ),
      },
      topFabricantes: {
        title: 'Top fabricantes',
        render: () => (
          <EstoquePorMaterialChart
            data={rankingFabricantesTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'fabricante')}
          />
        ),
      },
      topCentros: {
        title: 'Top centro de serviÃ§os',
        render: () => (
          <EstoquePorMaterialChart
            data={topCentrosServicoTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
          />
        ),
      },
      topSetores: {
        title: 'Top setores',
        render: () => (
          <EstoquePorMaterialChart
            data={topSetoresTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
          />
        ),
      },
      topPessoas: {
        title: 'Top pessoas',
        render: () => (
          <EstoquePorMaterialChart
            data={topPessoasTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
          />
        ),
      },
    }),
    [
      estoquePorCategoria,
      estoquePorMaterialTop,
      expandedChartId,
      formatCurrency,
      formatPeriodoLabel,
      rankingFabricantesTop,
      seriesHistorica,
      topCentrosServicoTop,
      topPessoasTop,
      topSetoresTop,
      valorMovimentadoSeries,
    ],
  )

  const activeChart = expandedChartId ? chartModalConfig[expandedChartId] : null
  const closeChartModal = () => setExpandedChartId(null)

  return (
    <>
      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="entradas" label="Informacoes sobre o grafico Entradas x Saidas" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Entradas x Saidas</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('entradas')}
                aria-label="Expandir grafico Entradas x Saidas"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EntradasSaidasChart data={seriesHistorica} labelFormatter={formatPeriodoLabel} />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="valor" label="Informacoes sobre o grafico Valor movimentado" />
              <h2 className="dashboard-card__title">
                <RevenueIcon size={20} /> <span>Valor movimentado</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('valor')}
                aria-label="Expandir grafico Valor movimentado"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <ValorMovimentadoChart data={valorMovimentadoSeries} valueFormatter={formatCurrency} />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="estoqueMaterial" label="Informacoes sobre o grafico Top materiais" />
              <h2 className="dashboard-card__title">
                <StockIcon size={20} /> <span>Top materiais</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('estoqueMaterial')}
                aria-label="Expandir grafico Top materiais"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={estoquePorMaterialTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="estoqueCategoria" label="Informacoes sobre o grafico Top categorias" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Top categorias</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('estoqueCategoria')}
                aria-label="Expandir grafico Top categorias"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorCategoriaChart
              data={estoquePorCategoria}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome || item?.categoria, 'categoria')}
            />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="topFabricantes" label="Informacoes sobre o grafico Top fabricantes" />
              <h2 className="dashboard-card__title">
                <TrendIcon size={20} /> <span>Top fabricantes</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topFabricantes')}
                aria-label="Expandir grafico Top fabricantes"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={rankingFabricantesTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'fabricante')}
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="topCentros" label="Informacoes sobre o grafico Top centro de servicos" />
              <h2 className="dashboard-card__title">
                <DashboardIcon size={20} /> <span>Top centro de serviÃ§os</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topCentros')}
                aria-label="Expandir grafico Top centro de serviÃ§os"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={topCentrosServicoTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
            />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="topSetores" label="Informacoes sobre o grafico Top setores" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Top setores</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topSetores')}
                aria-label="Expandir grafico Top setores"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={topSetoresTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="topPessoas" label="Informacoes sobre o grafico Top pessoas" />
              <h2 className="dashboard-card__title">
                <PersonIcon size={20} /> <span>Top pessoas</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topPessoas')}
                aria-label="Expandir grafico Top pessoas"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={topPessoasTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
            />
          </ChartContainer>
        </section>
      </div>

      {activeChart ? (
        <div className="chart-modal__overlay" role="dialog" aria-modal="true" onClick={closeChartModal}>
          <div className="chart-modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="chart-modal__header">
              <h3 className="chart-modal__title">{activeChart.title}</h3>
              <button
                type="button"
                className="chart-modal__close"
                onClick={closeChartModal}
                aria-label="Fechar grafico expandido"
              >
                <CancelIcon size={18} />
              </button>
            </header>
            <div className="chart-modal__body">
              <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
                {activeChart.render()}
              </ChartContainer>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function DashboardPage() {
  return (
    <DashboardEstoqueProvider>
      <div className="stack">
        <PageHeader
          icon={<DashboardIcon size={28} />}
          title="Dashboard de Estoque"
          subtitle="Monitore indicadores de movimentação e estoque para agir rapidamente."
          actions={<HelpButton topic="dashboard" />}
        />
        <FiltersForm />
        <Highlights />
        <ChartsGrid />
      </div>
    </DashboardEstoqueProvider>
  )
}
