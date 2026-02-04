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
import { DashboardEstoqueProvider, useDashboardEstoqueContext } from '../context/DashboardEstoqueContext.jsx'
import { ChartExpandModal } from '../components/Dashboard/ChartExpandModal.jsx'

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
  return <HelpButton topic="dashboard" />
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
    estoquePorMaterial,
    estoquePorCategoria,
    estoquePorMaterialTop,
    rankingFabricantes,
    rankingFabricantesTop,
    topCentrosServico,
    topCentrosServicoTop,
    topSetores,
    topSetoresTop,
    topPessoas,
    topPessoasTop,
    topTrocasMateriais,
    topTrocasMateriaisTop,
    topTrocasSetores,
    topTrocasSetoresTop,
    topTrocasPessoas,
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

  const getExpandedHeight = (length) => Math.max(520, length * 38)

  const materiaisExpandedData = trocaViews.materiais ? topTrocasMateriais : estoquePorMaterial
  const setoresExpandedData = trocaViews.setores ? topTrocasSetores : topSetores
  const pessoasExpandedData = trocaViews.pessoas ? topTrocasPessoas : topPessoas

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
          <div className="chart-modal__scroll">
            <EstoquePorMaterialChart
              data={materiaisExpandedData}
              height={getExpandedHeight(materiaisExpandedData.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
            />
          </div>
        ),
      },
      estoqueCategoria: {
        title: 'Top categorias',
        render: () => (
          <div className="chart-modal__scroll">
            <EstoquePorCategoriaChart
              data={estoquePorCategoria}
              height={getExpandedHeight(estoquePorCategoria.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome || item?.categoria, 'categoria')}
            />
          </div>
        ),
      },
      topFabricantes: {
        title: 'Top fabricantes',
        render: () => (
          <div className="chart-modal__scroll">
            <EstoquePorMaterialChart
              data={rankingFabricantes}
              height={getExpandedHeight(rankingFabricantes.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'fabricante')}
            />
          </div>
        ),
      },
      topCentros: {
        title: 'Top centro de servicos',
        render: () => (
          <div className="chart-modal__scroll">
            <EstoquePorMaterialChart
              data={topCentrosServico}
              height={getExpandedHeight(topCentrosServico.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
            />
          </div>
        ),
      },
      topSetores: {
        title: setoresChart.title,
        render: () => (
          <div className="chart-modal__scroll">
            <EstoquePorMaterialChart
              data={setoresExpandedData}
              height={getExpandedHeight(setoresExpandedData.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
            />
          </div>
        ),
      },
      topPessoas: {
        title: pessoasChart.title,
        render: () => (
          <div className="chart-modal__scroll">
            <EstoquePorMaterialChart
              data={pessoasExpandedData}
              height={getExpandedHeight(pessoasExpandedData.length)}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
            />
          </div>
        ),
      },
    }),
    [
      estoquePorMaterial,
      estoquePorCategoria,
      expandedChartId,
      formatCurrency,
      formatPeriodoLabel,
      materiaisChart,
      materiaisExpandedData,
      pessoasChart,
      pessoasExpandedData,
      rankingFabricantes,
      rankingFabricantesTop,
      seriesHistorica,
      setoresChart,
      setoresExpandedData,
      topCentrosServico,
      topCentrosServicoTop,
      topPessoas,
      topSetores,
      topTrocasMateriais,
      topTrocasPessoas,
      topTrocasSetores,
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
        <Highlights />
        <ChartsGrid />
      </div>
    </DashboardEstoqueProvider>
  )
}
