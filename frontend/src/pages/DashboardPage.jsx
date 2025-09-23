import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { api } from '../services/api.js'
import { EntradasSaidasChart, ValorMovimentadoChart } from '../components/charts/EntradasSaidasChart.jsx'
import { EstoquePorMaterialChart, MateriaisMaisUsadosChart } from '../components/charts/EstoqueCharts.jsx'
import { EstoquePorCategoriaChart } from '../components/charts/EstoqueCategoriaChart.jsx'

const initialFilters = {
  ano: new Date().getFullYear(),
  mes: '',
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
  if (!periodo) {
    return ''
  }
  const [ano, mes] = periodo.split('-')
  if (!mes) {
    return ano
  }
  return `${mes.padStart(2, '0')}/${ano}`
}

function normalizarTermo(termo) {
  return termo ? termo.trim().toLowerCase() : ''
}

function combinaComTermo(material = {}, termoNormalizado = '') {
  if (!termoNormalizado) {
    return true
  }
  const alvo = `${material.nome || ''} ${material.fabricante || ''}`.toLowerCase()
  return alvo.includes(termoNormalizado)
}

function agruparPorPeriodo(entradas = [], saidas = []) {
  const mapa = new Map()

  entradas.forEach((item) => {
    const data = new Date(item.dataEntrada)
    if (Number.isNaN(data.getTime())) {
      return
    }
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, {
        periodo: key,
        entradas: 0,
        valorEntradas: 0,
        saidas: 0,
        valorSaidas: 0,
      })
    }

    const atual = mapa.get(key)
    const valorUnitario = Number(item.material?.valorUnitario ?? 0)
    const quantidade = Number(item.quantidade ?? 0)

    atual.entradas += quantidade
    atual.valorEntradas = Number((atual.valorEntradas + quantidade * valorUnitario).toFixed(2))
  })

  saidas.forEach((item) => {
    const data = new Date(item.dataEntrega)
    if (Number.isNaN(data.getTime())) {
      return
    }
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    const key = `${ano}-${String(mes).padStart(2, '0')}`

    if (!mapa.has(key)) {
      mapa.set(key, {
        periodo: key,
        entradas: 0,
        valorEntradas: 0,
        saidas: 0,
        valorSaidas: 0,
      })
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
  if (!termoNormalizado) {
    return lista
  }
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
    if (!combinaComTermo(item, termoNormalizado)) {
      return
    }
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
      const response = await api.estoque.dashboard({
        ano: params.ano || undefined,
        mes: params.mes || undefined,
      })
      setData(response)
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

  const termoNormalizado = useMemo(() => normalizarTermo(filters.termo), [filters.termo])

  const entradasFiltradas = useMemo(
    () => filtrarPorTermo(data?.entradasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const saidasFiltradas = useMemo(
    () => filtrarPorTermo(data?.saidasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const seriesHistorica = useMemo(
    () => agruparPorPeriodo(entradasFiltradas, saidasFiltradas),
    [entradasFiltradas, saidasFiltradas],
  )

  const resumoEntradas = useMemo(() => ({
    quantidade: entradasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0),
    valor: entradasFiltradas.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.material?.valorUnitario ?? 0),
      0,
    ),
  }), [entradasFiltradas])

  const resumoSaidas = useMemo(() => ({
    quantidade: saidasFiltradas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0),
    valor: saidasFiltradas.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.material?.valorUnitario ?? 0),
      0,
    ),
  }), [saidasFiltradas])

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

  const alertasQtd = data?.estoqueAtual?.alertas?.length ?? 0

  return (
    <div className="stack">
      <PageHeader
        title="Dashboard"
        subtitle="Monitore indicadores de movimentacao e estoque para agir rapidamente."
      />

      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Ano</span>
          <input type="number" name="ano" value={filters.ano} onChange={handleChange} placeholder="2025" />
        </label>
        <label className="field">
          <span>Mes</span>
          <input type="number" min="1" max="12" name="mes" value={filters.mes} onChange={handleChange} placeholder="1" />
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

      <div className="dashboard-metrics">
        <section className="metric metric--compact">
          <span className="metric__label">Entradas</span>
          <strong className="metric__value">{resumoEntradas.quantidade}</strong>
          <span className="metric__description">Valor total: {formatCurrency(resumoEntradas.valor)}</span>
        </section>
        <section className="metric metric--compact">
          <span className="metric__label">Saidas</span>
          <strong className="metric__value">{resumoSaidas.quantidade}</strong>
          <span className="metric__description">Valor total: {formatCurrency(resumoSaidas.valor)}</span>
        </section>
        
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2>Entradas x Saidas</h2>
          </header>
          <EntradasSaidasChart data={seriesHistorica} labelFormatter={formatPeriodoLabel} />
        </section>

        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2>Valor movimentado</h2>
          </header>
          <ValorMovimentadoChart data={seriesHistorica.map(({ periodo, valorEntradas, valorSaidas }) => ({ periodo, valorEntradas, valorSaidas }))} valueFormatter={formatCurrency} />
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2>Estoque por material</h2>
          </header>
          <EstoquePorMaterialChart data={estoquePorMaterial.slice(0, 8)} />
        </section>
        <section className="card card--chart card--chart-lg">
          <header className="card__header">
            <h2>Estoque por categoria</h2>
          </header>
          <EstoquePorCategoriaChart data={estoquePorCategoria} />
        </section>
      </div>

      <section className="card card--wide">
        <header className="card__header">
          <h2>Top materiais movimentados</h2>
        </header>
        <MateriaisMaisUsadosChart data={rankingMateriais.slice(0, 8)} />
      </section>
    </div>
  )
}

