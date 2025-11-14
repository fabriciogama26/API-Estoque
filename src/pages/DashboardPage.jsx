import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { DashboardIcon, MovementIcon, RevenueIcon, StockIcon, AlertIcon, BarsIcon, TrendIcon, ExpandIcon, CancelIcon } from '../components/icons.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { EntradasSaidasChart, ValorMovimentadoChart } from '../components/charts/EntradasSaidasChart.jsx'
import { EstoquePorMaterialChart } from '../components/charts/EstoqueCharts.jsx'
import { EstoquePorCategoriaChart } from '../components/charts/EstoqueCategoriaChart.jsx'
import '../styles/DashboardPage.css'

const currentYear = new Date().getFullYear()

const initialFilters = {
  periodoInicio: `${currentYear}-01`,
  periodoFim: `${currentYear}-12`,
  termo: '',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

const sanitizeDisplayText = (value) => (value ? String(value).trim() : '')

function resolveFabricanteDisplay(material = {}) {
  const candidatos = [material.fabricanteNome, material.fabricante]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return 'Nao informado'
}

function resolveCentroServicoDisplay(saida = {}) {
  const candidatos = [
    saida.centroServicoNome,
    saida.centroServico,
    saida.setorNome,
    saida.setor,
    saida.local,
    saida.pessoa?.centroServico,
    saida.pessoa?.setor,
    saida.pessoa?.local,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto && !isLikelyUuid(texto)) {
      return texto
    }
  }
  return 'Nao informado'
}

function formatEstoqueMaterialLabel(item = {}) {
  const base = item.resumo || [item.nome, resolveFabricanteDisplay(item)].filter(Boolean).join(' | ')
  const partes = base.split('|').map((parte) => sanitizeDisplayText(parte)).filter(Boolean)
  const compacto = partes.slice(0, 3).join(' | ')
  if (compacto.length <= 55) {
    return compacto
  }
  return `${compacto.slice(0, 52)}...`
}
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function formatPeriodoLabel(periodo) {
  if (!periodo) return ''
  const [ano, mes] = periodo.split('-')
  if (!mes) return ano
  return `${mes.padStart(2, '0')}/${ano}`
}

function normalizarTermo(termo) {
  return termo ? termo.trim().toLowerCase() : ''
}

function combinaComTermo(material = {}, termoNormalizado = '') {
  if (!termoNormalizado) return true
  const partes = [
    material.nome,
    material.fabricante,
    material.fabricanteNome,
    material.resumo,
    material.grupoMaterial,
    material.grupoMaterialNome,
    material.categoria,
  ]
    .map((parte) => (parte ? String(parte).toLowerCase() : ''))
    .filter(Boolean)
    .join(' ')
  return partes.includes(termoNormalizado)
}

function agruparPorPeriodo(entradas = [], saidas = []) {
  const mapa = new Map()

  entradas.forEach((item) => {
    const data = new Date(item.dataEntrada)
    if (Number.isNaN(data.getTime())) return
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, { periodo: key, entradas: 0, valorEntradas: 0, saidas: 0, valorSaidas: 0 })
    }

    const atual = mapa.get(key)
    const valorUnitario = Number(item.material?.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)

    atual.entradas += quantidade
    atual.valorEntradas = Number((atual.valorEntradas + quantidade * valorUnitario).toFixed(2))
  })

  saidas.forEach((item) => {
    const data = new Date(item.dataEntrega)
    if (Number.isNaN(data.getTime())) return
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, { periodo: key, entradas: 0, valorEntradas: 0, saidas: 0, valorSaidas: 0 })
    }

    const atual = mapa.get(key)
    const valorUnitario = Number(item.material?.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)

    atual.saidas += quantidade
    atual.valorSaidas = Number((atual.valorSaidas + quantidade * valorUnitario).toFixed(2))
  })

  return Array.from(mapa.values()).sort((a, b) => a.periodo.localeCompare(b.periodo))
}

function filtrarPorTermo(lista = [], termoNormalizado) {
  if (!termoNormalizado) return lista
  return lista.filter((item) => combinaComTermo(item.material, termoNormalizado))
}

function montarEstoquePorMaterial(itens = [], termoNormalizado) {
  return itens
    .filter((item) => combinaComTermo(item, termoNormalizado))
    .map((item) => ({
      materialId: item.materialId,
      nome: formatEstoqueMaterialLabel(item),
      descricao: item.resumo || [item.nome, resolveFabricanteDisplay(item)].filter(Boolean).join(' | '),
      filtro: item.nome || item.resumo || '',
      quantidade: Number(item.quantidade ?? 0),
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
}

function montarCategorias(itens = [], termoNormalizado) {
  const categorias = new Map()
  itens.forEach((item) => {
    if (!combinaComTermo(item, termoNormalizado)) return
    const categoria = item.nome?.split(' ')[0] || 'Nao classificado'
    const atual = categorias.get(categoria) ?? { categoria, quantidade: 0, filtro: categoria }
    atual.quantidade += Number(item.quantidade ?? 0)
    categorias.set(categoria, atual)
  })

  return Array.from(categorias.values()).sort((a, b) => b.quantidade - a.quantidade)
}

function montarRankingFabricantes(data = [], termoNormalizado) {
  const fabricantes = new Map()
  data
    .filter((item) => combinaComTermo(item, termoNormalizado))
    .forEach((item) => {
      const nome = resolveFabricanteDisplay(item)
      const chave = item.fabricante || nome || 'Nao informado'
      const atual = fabricantes.get(chave) ?? {
        id: chave,
        nome,
        descricao: nome,
        filtro: nome,
        quantidade: 0,
      }
      atual.nome = nome || atual.nome
      atual.descricao = nome || atual.descricao
      atual.filtro = nome || atual.filtro
      atual.quantidade += Number(item.totalQuantidade ?? 0)
      fabricantes.set(chave, atual)
    })

  return Array.from(fabricantes.values()).sort((a, b) => b.quantidade - a.quantidade)
}

function montarTopCentrosServico(saidas = [], termoNormalizado) {
  const centros = new Map()

  saidas.forEach((saida) => {
    const centroNome = resolveCentroServicoDisplay(saida)
    const centroId = saida.centroServicoId || saida.setorId || centroNome
    const materialMatch = combinaComTermo(saida.material ?? {}, termoNormalizado)
    const centroMatch = termoNormalizado
      ? centroNome.toLowerCase().includes(termoNormalizado)
      : true
    if (!materialMatch && !centroMatch) {
      return
    }
    const atual = centros.get(centroId) ?? {
      id: centroId,
      nome: centroNome,
      descricao: centroNome,
      filtro: centroNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    centros.set(centroId, atual)
  })

  return Array.from(centros.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export function DashboardPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chartFilter, setChartFilter] = useState(null)
  const [expandedChartId, setExpandedChartId] = useState(null)

  const load = async (params = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const dashboard = await api.estoque.dashboard({
        periodoInicio: params.periodoInicio || undefined,
        periodoFim: params.periodoFim || undefined,
      })
      setData(dashboard)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(initialFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'termo') {
      setChartFilter(null)
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const handleClear = () => {
    setFilters(initialFilters)
    setChartFilter(null)
    load(initialFilters)
  }

  const termoNormalizado = normalizarTermo(filters.termo)

  const resumoEntradas = useMemo(() => ({
    quantidade: data?.entradas?.quantidade ?? 0,
    valor: data?.entradas?.valorTotal ?? 0,
  }), [data])

  const resumoSaidas = useMemo(() => ({
    quantidade: data?.saidas?.quantidade ?? 0,
    valor: data?.saidas?.valorTotal ?? 0,
  }), [data])

  const seriesHistorica = useMemo(() => {
    const entradasDetalhadas = filtrarPorTermo(data?.entradasDetalhadas ?? [], termoNormalizado)
    const saidasDetalhadas = filtrarPorTermo(data?.saidasDetalhadas ?? [], termoNormalizado)
    return agruparPorPeriodo(entradasDetalhadas, saidasDetalhadas)
  }, [data, termoNormalizado])

  const valorMovimentadoSeries = useMemo(
    () => seriesHistorica.map(({ periodo, valorEntradas, valorSaidas }) => ({ periodo, valorEntradas, valorSaidas })),
    [seriesHistorica],
  )

  const estoquePorMaterial = useMemo(
    () => montarEstoquePorMaterial(data?.estoqueAtual?.itens ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const estoquePorCategoria = useMemo(
    () => montarCategorias(data?.estoqueAtual?.itens ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const rankingFabricantes = useMemo(
    () => montarRankingFabricantes(data?.materiaisMaisMovimentados ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const topCentrosServico = useMemo(
    () => montarTopCentrosServico(data?.saidasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const estoquePorMaterialTop = useMemo(
    () => estoquePorMaterial.slice(0, 8),
    [estoquePorMaterial],
  )

  const rankingFabricantesTop = useMemo(
    () => rankingFabricantes.slice(0, 8),
    [rankingFabricantes],
  )

  const topCentrosServicoTop = useMemo(
    () => topCentrosServico.slice(0, 8),
    [topCentrosServico],
  )

  const totalMovimentacoes = resumoEntradas.quantidade + resumoSaidas.quantidade
  const totalValorMovimentado = resumoEntradas.valor + resumoSaidas.valor
  const totalMateriais = data?.estoqueAtual?.itens?.length ?? 0
  const totalItensEstoque = useMemo(() => (
    (data?.estoqueAtual?.itens ?? []).reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  ), [data])
  const materiaisEmAlerta = data?.estoqueAtual?.alertas?.length ?? 0

  const highlightCards = [
    {
      id: 'movimentacoes',
      title: 'Movimentacões',
      value: totalMovimentacoes,
      helper: `${resumoEntradas.quantidade} entradas / ${resumoSaidas.quantidade} saidas`,
      icon: MovementIcon,
      tone: 'blue',
    },
    {
      id: 'valor',
      title: 'Valor movimentado',
      value: formatCurrency(totalValorMovimentado),
      helper: `${formatCurrency(resumoEntradas.valor)} em entradas / ${formatCurrency(resumoSaidas.valor)} em saídas`,
      icon: RevenueIcon,
      tone: 'green',
    },
    {
      id: 'estoque',
      title: 'Itens em estoque',
      value: totalItensEstoque,
      helper: `${totalMateriais} materiais rastreados`,
      icon: StockIcon,
      tone: 'purple',
    },
    {
      id: 'alertas',
      title: 'Alertas ativos',
      value: materiaisEmAlerta,
      helper: materiaisEmAlerta ? 'Atencao: revisar estoque minimo' : 'Tudo dentro do esperado',
      icon: AlertIcon,
      tone: materiaisEmAlerta ? 'orange' : 'slate',
    },
  ]

  const closeChartModal = () => setExpandedChartId(null)
  const openChartModal = (chartId) => setExpandedChartId(chartId)

  const applyChartFilter = (value, source) => {
    const texto = sanitizeDisplayText(value)
    if (!texto) return
    setChartFilter({ source, value: texto })
    setFilters((prev) => ({ ...prev, termo: texto }))
  }

  const clearChartFilter = () => {
    setChartFilter(null)
    setFilters((prev) => ({ ...prev, termo: '' }))
  }

  const handleChartSelect = (value, source) => {
    applyChartFilter(value, source)
    if (expandedChartId) {
      closeChartModal()
    }
  }

  const chartModalConfig = useMemo(() => ({
    entradas: {
      title: 'Entradas x Saidas',
      render: () => (
        <EntradasSaidasChart
          data={seriesHistorica}
          labelFormatter={formatPeriodoLabel}
          height={520}
        />
      ),
    },
    valor: {
      title: 'Valor movimentado',
      render: () => (
        <ValorMovimentadoChart
          data={valorMovimentadoSeries}
          valueFormatter={formatCurrency}
          height={520}
        />
      ),
    },
    estoqueMaterial: {
      title: 'Estoque por material',
      render: () => (
        <EstoquePorMaterialChart
          data={estoquePorMaterial}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
        />
      ),
    },
    estoqueCategoria: {
      title: 'Estoque por categoria',
      render: () => (
        <EstoquePorCategoriaChart
          data={estoquePorCategoria}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.categoria, 'categoria')}
        />
      ),
    },
    topFabricantes: {
      title: 'Top fabricantes',
      render: () => (
        <EstoquePorMaterialChart
          data={rankingFabricantes}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'fabricante')}
        />
      ),
    },
    topCentros: {
      title: 'Top centro de serviços',
      render: () => (
        <EstoquePorMaterialChart
          data={topCentrosServico}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
        />
      ),
    },
  }), [seriesHistorica, valorMovimentadoSeries, estoquePorMaterial, estoquePorCategoria, rankingFabricantes, topCentrosServico])

  const activeChart = expandedChartId ? chartModalConfig[expandedChartId] : null

  return (
    <div className="stack">
      <PageHeader
        icon={<DashboardIcon size={28} />}
        title="Dashboard de Estoque"
        subtitle="Monitore indicadores de movimentacão e estoque para agir rapidamente."
      />

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
          <span>Material ou fabricante</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleChange}
            placeholder="ex: bota, 3M, luva"
          />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isLoading}>
            {isLoading ? 'Filtrando...' : 'Aplicar filtros'}
          </button>
          <button type="button" className="button button--ghost" onClick={handleClear}>
            Limpar filtros
          </button>
        </div>
      </form>

      {chartFilter ? (
        <div className="chart-filter-indicator">
          <span>Filtro aplicado: <strong>{chartFilter.value}</strong></span>
          <button type="button" onClick={clearChartFilter}>
            <CancelIcon size={14} /> Limpar
          </button>
        </div>
      ) : null}

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <div className="dashboard-highlights">
        {highlightCards.map(({ id, title, value, helper, icon: IconComponent, tone }) => (
          <article key={id} className={`dashboard-insight-card dashboard-insight-card--${tone}`}>
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

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><BarsIcon size={20} /> <span>Entradas x Saidas</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('entradas')} aria-label="Expandir gráfico Entradas x Saidas">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <EntradasSaidasChart data={seriesHistorica} labelFormatter={formatPeriodoLabel} />
          </div>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><RevenueIcon size={20} /> <span>Valor movimentado</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('valor')} aria-label="Expandir gráfico Valor movimentado">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <ValorMovimentadoChart
              data={valorMovimentadoSeries}
              valueFormatter={formatCurrency}
            />
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><StockIcon size={20} /> <span>Estoque por material</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('estoqueMaterial')} aria-label="Expandir gráfico Estoque por material">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <EstoquePorMaterialChart
              data={estoquePorMaterialTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.descricao || item?.nome, 'material')}
            />
          </div>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><BarsIcon size={20} /> <span>Estoque por categoria</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('estoqueCategoria')} aria-label="Expandir gráfico Estoque por categoria">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <EstoquePorCategoriaChart
              data={estoquePorCategoria}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.categoria, 'categoria')}
            />
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><TrendIcon size={20} /> <span>Top fabricantes</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topFabricantes')} aria-label="Expandir gráfico Top fabricantes">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <EstoquePorMaterialChart
              data={rankingFabricantesTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'fabricante')}
            />
          </div>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title"><DashboardIcon size={20} /> <span>Top centro de serviços</span></h2>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topCentros')} aria-label="Expandir gráfico Top centro de serviços">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <div className="dashboard-chart-container">
            <EstoquePorMaterialChart
              data={topCentrosServicoTop}
              onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'centro')}
            />
          </div>
        </section>
      </div>

      {activeChart ? (
        <div className="chart-modal__overlay" role="dialog" aria-modal="true" onClick={closeChartModal}>
          <div className="chart-modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="chart-modal__header">
              <h3 className="chart-modal__title">{activeChart.title}</h3>
              <button type="button" className="chart-modal__close" onClick={closeChartModal} aria-label="Fechar gráfico expandido">
                <CancelIcon size={18} />
              </button>
            </header>
            <div className="chart-modal__body">
              <div className="dashboard-chart-container">
                {activeChart.render()}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}



