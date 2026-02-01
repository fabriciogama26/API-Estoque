import { useMemo, useState } from 'react'
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
import { ParetoChart } from '../components/charts/ParetoChart.jsx'
import { DashboardEstoqueProvider, useDashboardEstoqueContext } from '../context/DashboardEstoqueContext.jsx'
import { ChartExpandModal } from '../components/Dashboard/ChartExpandModal.jsx'
import { formatNumber } from '../utils/inventoryReportUtils.js'

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

function DashboardActions() {
  const { handleGenerateReport, reportLoading } = useDashboardEstoqueContext()
  return (
    <>
      <button
        type="button"
        className="button button--primary"
        onClick={handleGenerateReport}
        disabled={reportLoading}
      >
        {reportLoading ? 'Gerando relatorio...' : 'Gerar relatorio'}
      </button>
      <HelpButton topic="dashboard" />
    </>
  )
}

function ReportFeedback() {
  const { reportStatus } = useDashboardEstoqueContext()
  if (!reportStatus) {
    return null
  }
  return <p className={`feedback feedback--${reportStatus.type}`}>{reportStatus.message}</p>
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
    estoquePorCategoria,
    estoquePorMaterialTop,
    paretoQuantidadeTop,
    paretoRiscoTop,
    paretoFinanceiroTop,
    rankingFabricantesTop,
    topCentrosServicoTop,
    topSetoresTop,
    topPessoasTop,
    topTrocasMateriaisTop,
    topTrocasSetoresTop,
    topTrocasPessoasTop,
    formatPeriodoLabel,
    formatCurrency,
  } = useDashboardEstoqueContext()

  const [trocaViews, setTrocaViews] = useState({
    materiais: false,
    setores: false,
    pessoas: false,
  })

  const toggleTrocaView = (key) => {
    setTrocaViews((prev) => ({ ...prev, [key]: !prev[key] }))
  }


  const materiaisChart = {
    active: trocaViews.materiais,
    title: trocaViews.materiais ? 'Top materiais (trocas)' : 'Top materiais',
    infoKey: trocaViews.materiais ? 'topTrocasMateriais' : 'estoqueMaterial',
    data: trocaViews.materiais ? topTrocasMateriaisTop : estoquePorMaterialTop,
  }
  const setoresChart = {
    active: trocaViews.setores,
    title: trocaViews.setores ? 'Top setores (trocas)' : 'Top setores',
    infoKey: trocaViews.setores ? 'topTrocasSetores' : 'topSetores',
    data: trocaViews.setores ? topTrocasSetoresTop : topSetoresTop,
  }
  const pessoasChart = {
    active: trocaViews.pessoas,
    title: trocaViews.pessoas ? 'Top pessoas (trocas)' : 'Top pessoas',
    infoKey: trocaViews.pessoas ? 'topTrocasPessoas' : 'topPessoas',
    data: trocaViews.pessoas ? topTrocasPessoasTop : topPessoasTop,
  }

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
        title: materiaisChart.title,
        render: () => (
          <EstoquePorMaterialChart
            data={materiaisChart.data}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
          />
        ),
      },
      paretoQuantidade: {
        title: 'Pareto 80/20 - Saida por quantidade',
        render: () => (
          <ParetoChart
            data={paretoQuantidadeTop}
            valueKey="quantidade"
            valueLabel="Quantidade"
            valueFormatter={formatNumber}
            height={520}
          />
        ),
      },
      paretoRisco: {
        title: 'Pareto por risco operacional',
        render: () => (
          <ParetoChart
            data={paretoRiscoTop}
            valueKey="score"
            valueLabel="Quantidade"
            valueFormatter={formatNumber}
            height={520}
          />
        ),
      },
      paretoFinanceiro: {
        title: 'Pareto financeiro - Saida por valor',
        render: () => (
          <ParetoChart data={paretoFinanceiroTop} valueKey="valorTotal" valueFormatter={formatCurrency} height={520} />
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
        title: 'Top centro de servicos',
        render: () => (
          <EstoquePorMaterialChart
            data={topCentrosServicoTop}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
          />
        ),
      },
      topSetores: {
        title: setoresChart.title,
        render: () => (
          <EstoquePorMaterialChart
            data={setoresChart.data}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
          />
        ),
      },
      topPessoas: {
        title: pessoasChart.title,
        render: () => (
          <EstoquePorMaterialChart
            data={pessoasChart.data}
            height={520}
            onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
          />
        ),
      },
    }),
    [
      estoquePorCategoria,
      expandedChartId,
      formatCurrency,
      formatNumber,
      formatPeriodoLabel,
      materiaisChart,
      paretoFinanceiroTop,
      paretoQuantidadeTop,
      paretoRiscoTop,
      pessoasChart,
      rankingFabricantesTop,
      seriesHistorica,
      setoresChart,
      topCentrosServicoTop,
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
              <ChartInfoButton
                infoKey={materiaisChart.infoKey}
                label={`Informacoes sobre o grafico ${materiaisChart.title}`}
              />
              <h2 className="dashboard-card__title">
                <StockIcon size={20} /> <span>{materiaisChart.title}</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className={`dashboard-card__toggle${materiaisChart.active ? ' dashboard-card__toggle--active' : ''}`}
                onClick={() => toggleTrocaView('materiais')}
                aria-pressed={materiaisChart.active}
              >
                Troca
              </button>
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('estoqueMaterial')}
                aria-label={`Expandir grafico ${materiaisChart.title}`}
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={materiaisChart.data}
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
              <ChartInfoButton infoKey="paretoQuantidade" label="Informacoes sobre o grafico Pareto 80/20" />
              <h2 className="dashboard-card__title">
                <TrendIcon size={20} /> <span>Pareto 80/20 - Saida por quantidade</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('paretoQuantidade')}
                aria-label="Expandir grafico Pareto 80/20"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <ParetoChart
              data={paretoQuantidadeTop}
              valueKey="quantidade"
              valueLabel="Quantidade"
              valueFormatter={formatNumber}
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="paretoRisco" label="Informacoes sobre o grafico Pareto por risco" />
              <h2 className="dashboard-card__title">
                <AlertIcon size={20} /> <span>Pareto por risco operacional</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('paretoRisco')}
                aria-label="Expandir grafico Pareto por risco"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <ParetoChart
              data={paretoRiscoTop}
              valueKey="score"
              valueLabel="Quantidade"
              valueFormatter={formatNumber}
            />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="paretoFinanceiro" label="Informacoes sobre o grafico Pareto financeiro" />
              <h2 className="dashboard-card__title">
                <RevenueIcon size={20} /> <span>Pareto financeiro - Saida por valor</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('paretoFinanceiro')}
                aria-label="Expandir grafico Pareto financeiro"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <ParetoChart data={paretoFinanceiroTop} valueKey="valorTotal" valueFormatter={formatCurrency} />
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
                <DashboardIcon size={20} /> <span>Top centro de servicos</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topCentros')}
                aria-label="Expandir grafico Top centro de servicos"
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
              <ChartInfoButton
                infoKey={setoresChart.infoKey}
                label={`Informacoes sobre o grafico ${setoresChart.title}`}
              />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>{setoresChart.title}</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className={`dashboard-card__toggle${setoresChart.active ? ' dashboard-card__toggle--active' : ''}`}
                onClick={() => toggleTrocaView('setores')}
                aria-pressed={setoresChart.active}
              >
                Troca
              </button>
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topSetores')}
                aria-label={`Expandir grafico ${setoresChart.title}`}
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={setoresChart.data}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton
                infoKey={pessoasChart.infoKey}
                label={`Informacoes sobre o grafico ${pessoasChart.title}`}
              />
              <h2 className="dashboard-card__title">
                <PersonIcon size={20} /> <span>{pessoasChart.title}</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className={`dashboard-card__toggle${pessoasChart.active ? ' dashboard-card__toggle--active' : ''}`}
                onClick={() => toggleTrocaView('pessoas')}
                aria-pressed={pessoasChart.active}
              >
                Troca
              </button>
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => setExpandedChartId('topPessoas')}
                aria-label={`Expandir grafico ${pessoasChart.title}`}
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <EstoquePorMaterialChart
              data={pessoasChart.data}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
            />
          </ChartContainer>
        </section>
      </div>

      <ChartExpandModal open={Boolean(activeChart)} title={activeChart?.title} onClose={closeChartModal}>
        <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
          {activeChart?.render()}
        </ChartContainer>
      </ChartExpandModal>
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
          actions={<DashboardActions />}
        />
        <FiltersForm />
        <ReportFeedback />
        <Highlights />
        <ChartsGrid />
      </div>
    </DashboardEstoqueProvider>
  )
}
