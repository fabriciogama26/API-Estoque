import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { DashboardIcon, MovementIcon, RevenueIcon, StockIcon, AlertIcon, BarsIcon, PieIcon, TrendIcon } from '../components/icons.jsx'
import { api } from '../services/api.js'
import { EntradasSaidasChart, ValorMovimentadoChart } from '../components/charts/EntradasSaidasChart.jsx'
import { EstoquePorMaterialChart, MateriaisMaisUsadosChart } from '../components/charts/EstoqueCharts.jsx'
import { EstoquePorCategoriaChart } from '../components/charts/EstoqueCategoriaChart.jsx'
import '../styles/DashboardPage.css'

const currentYear = new Date().getFullYear()

const initialFilters = {
  periodoInicio: `${currentYear}-01`,
  periodoFim: `${currentYear}-12`,
  termo: '',
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
  const alvo = `${material.nome || ''} ${material.fabricante || ''}`.toLowerCase()
  return alvo.includes(termoNormalizado)
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
      nome: `${item.nome} - ${item.fabricante}`,
      quantidade: Number(item.quantidade ?? 0),
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
}

function montarCategorias(itens = [], termoNormalizado) {
  const categorias = new Map()
  itens.forEach((item) => {
    if (!combinaComTermo(item, termoNormalizado)) return
    const categoria = item.nome?.split(' ')[0] || 'Nao classificado'
    const atual = categorias.get(categoria) ?? { categoria, quantidade: 0 }
    atual.quantidade += Number(item.quantidade ?? 0)
    categorias.set(categoria, atual)
  })

  return Array.from(categorias.values()).sort((a, b) => b.quantidade - a.quantidade)
}

function montarRanking(data = [], termoNormalizado) {
  return data
    .filter((item) => combinaComTermo(item, termoNormalizado))
    .map((item) => ({
      materialId: item.materialId,
      nome: `${item.nome} - ${item.fabricante}`,
      totalQuantidade: item.totalQuantidade,
    }))
    .sort((a, b) => b.totalQuantidade - a.totalQuantidade)
}

export function DashboardPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

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
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const handleClear = () => {
    setFilters(initialFilters)
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

  const estoquePorMaterial = useMemo(
    () => montarEstoquePorMaterial(data?.estoqueAtual?.itens ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const estoquePorCategoria = useMemo(
    () => montarCategorias(data?.estoqueAtual?.itens ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const rankingMateriais = useMemo(
    () => montarRanking(data?.materiaisMaisMovimentados ?? [], termoNormalizado),
    [data, termoNormalizado],
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
      title: 'Movimentacoes',
      value: totalMovimentacoes,
      helper: `${resumoEntradas.quantidade} entradas / ${resumoSaidas.quantidade} saidas`,
      icon: MovementIcon,
      tone: 'blue',
    },
    {
      id: 'valor',
      title: 'Valor movimentado',
      value: formatCurrency(totalValorMovimentado),
      helper: `${formatCurrency(resumoEntradas.valor)} em entradas`,
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

  return (
    <div className="stack">
      <PageHeader
        icon={<DashboardIcon size={28} />}
        title="Dashboard"
        subtitle="Monitore indicadores de movimentacao e estoque para agir rapidamente."
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

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <div className="dashboard-highlights">
        {highlightCards.map(({ id, title, value, helper, icon: IconComponent, tone }) => (
          <article key={id} className={`insight-card insight-card--${tone}`}>
            <header className="insight-card__header">
              <p className="insight-card__title">{title}</p>
              <span className="insight-card__avatar">
                <IconComponent size={22} />
              </span>
            </header>
            <strong className="insight-card__value">{value}</strong>
            <span className="insight-card__helper">{helper}</span>
          </article>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2 className="card__title"><BarsIcon size={20} /> <span>Entradas x Saidas</span></h2>
          </header>
          <div className="chart-container">
            <EntradasSaidasChart data={seriesHistorica} labelFormatter={formatPeriodoLabel} />
          </div>
        </section>

        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2 className="card__title"><RevenueIcon size={20} /> <span>Valor movimentado</span></h2>
          </header>
          <div className="chart-container">
            <ValorMovimentadoChart
              data={seriesHistorica.map(({ periodo, valorEntradas, valorSaidas }) => ({ periodo, valorEntradas, valorSaidas }))}
              valueFormatter={formatCurrency}
            />
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2 className="card__title"><StockIcon size={20} /> <span>Estoque por material</span></h2>
          </header>
          <div className="chart-container">
            <EstoquePorMaterialChart data={estoquePorMaterial.slice(0, 8)} />
          </div>
        </section>

        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2 className="card__title"><PieIcon size={20} /> <span>Estoque por categoria</span></h2>
          </header>
          <div className="chart-container">
            <EstoquePorCategoriaChart data={estoquePorCategoria} />
          </div>
        </section>
      </div>

      <section className="card card--wide">
        <header className="card__header">
          <h2 className="card__title"><TrendIcon size={20} /> <span>Top materiais movimentados</span></h2>
        </header>
        <div className="chart-container">
          <MateriaisMaisUsadosChart data={rankingMateriais.slice(0, 8)} />
        </div>
      </section>
    </div>
  )
}



