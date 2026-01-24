import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MovementIcon, RevenueIcon, StockIcon, AlertIcon, DashboardIcon, TrendIcon } from '../components/icons.jsx'
import { fetchDashboardEstoque } from '../services/dashboardEstoqueApi.js'
import {
  initialDashboardEstoqueFilters,
  normalizarTermo,
  filtrarPorTermo,
  agruparPorPeriodo,
  formatCurrency,
  formatPeriodoLabel,
  montarTopMateriaisSaida,
  montarTopCategoriasSaida,
  montarRankingFabricantes,
  montarTopCentrosServico,
  montarTopSetores,
  montarTopPessoas,
  montarTopTrocasMateriais,
  montarTopTrocasSetores,
  montarTopTrocasPessoas,
} from '../utils/dashboardEstoqueUtils.js'

export function useDashboardEstoque(onError) {
  const [filters, setFilters] = useState(initialDashboardEstoqueFilters)
  const [appliedFilters, setAppliedFilters] = useState(initialDashboardEstoqueFilters)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [chartFilter, setChartFilter] = useState(null)
  const [expandedChartId, setExpandedChartId] = useState(null)
  const lastKeyRef = useRef(null)
  const dataRef = useRef(null)

  const notifyError = useCallback(
    (err, context = {}) => {
      setError(err?.message || 'Erro ao processar acao no dashboard de estoque.')
      if (typeof onError === 'function') {
        onError(err, context)
      }
    },
    [onError],
  )

  const load = useCallback(
    async (params = appliedFilters, { force = false } = {}) => {
      const key = JSON.stringify(params || {})
      if (!force && lastKeyRef.current === key) {
        return
      }
      try {
        const dashboard = await fetchDashboardEstoque({
          periodoInicio: params.periodoInicio || undefined,
          periodoFim: params.periodoFim || undefined,
        })
        const nextKey = JSON.stringify(dashboard || {})
        const currentKey = JSON.stringify(dataRef.current || {})
        if (force || currentKey !== nextKey) {
          setData(dashboard)
          dataRef.current = dashboard
        }
        lastKeyRef.current = key
      } catch (err) {
        setError(err.message)
        notifyError(err, { area: 'dashboard_estoque_load' })
      }
    },
    [appliedFilters, notifyError],
  )

  useEffect(() => {
    load(initialDashboardEstoqueFilters, { force: true })
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
    const next = { ...filters }
    setAppliedFilters(next)
    load(next, { force: true }).catch((err) =>
      notifyError(err, { area: 'dashboard_estoque_filter_submit' })
    )
  }

  const handleClear = () => {
    const defaults = { ...initialDashboardEstoqueFilters }
    setFilters(defaults)
    setAppliedFilters(defaults)
    setChartFilter(null)
    load(defaults, { force: true }).catch((err) =>
      notifyError(err, { area: 'dashboard_estoque_filter_clear' }),
    )
  }

  const applyChartFilter = (value, source) => {
    try {
      const texto = value?.trim()
      if (!texto) return
      setChartFilter({ source, value: texto })
      const nextFilters = { ...appliedFilters, termo: texto }
      setFilters((prev) => ({ ...prev, termo: texto }))
      setAppliedFilters(nextFilters)
      load(nextFilters, { force: true }).catch((err) =>
        notifyError(err, { area: 'dashboard_estoque_chart_filter', source }),
      )
    } catch (err) {
      notifyError(err, { area: 'dashboard_estoque_chart_filter' })
    }
  }

  const clearChartFilter = () => {
    setChartFilter(null)
    const nextFilters = { ...appliedFilters, termo: '' }
    setFilters((prev) => ({ ...prev, termo: '' }))
    setAppliedFilters(nextFilters)
    load(nextFilters, { force: true }).catch((err) =>
      notifyError(err, { area: 'dashboard_estoque_chart_filter_clear' })
    )
  }

  const termoNormalizado = useMemo(
    () => normalizarTermo(appliedFilters.termo),
    [appliedFilters.termo],
  )

  const entradasDetalhadasFiltradas = useMemo(
    () => filtrarPorTermo(data?.entradasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const saidasDetalhadasFiltradas = useMemo(
    () => filtrarPorTermo(data?.saidasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado],
  )

  const parseDateWithoutTimezone = (value) => {
    if (!value) return null
    const str = String(value).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      return Number.isNaN(date.getTime()) ? null : date
    }
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const isSaidaCancelada = (saida) => {
    const raw = (saida?.statusNome || saida?.status || '').toString().trim().toLowerCase()
    return raw === 'cancelado'
  }

  const trocaResumo = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const limiteMs = 1000 * 60 * 60 * 24
    let feitas = 0
    let atrasadas = 0
    let aVencer = 0
    saidasDetalhadasFiltradas.forEach((saida) => {
      if (!saida || isSaidaCancelada(saida)) {
        return
      }
      if (saida.isTroca) {
        feitas += 1
      }
      if (!saida.dataTroca) {
        return
      }
      const dataTroca = parseDateWithoutTimezone(saida.dataTroca)
      if (!dataTroca) {
        return
      }
      const diffDias = Math.floor((dataTroca.getTime() - hoje.getTime()) / limiteMs)
      if (diffDias < 0) {
        atrasadas += 1
      } else if (diffDias <= 7) {
        aVencer += 1
      }
    })
    return { feitas, atrasadas, aVencer }
  }, [saidasDetalhadasFiltradas])

  const calcularQuantidadeTotal = (lista) => lista.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const calcularValorTotal = (lista) =>
    lista.reduce(
      (acc, item) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
      0,
    )

  const resumoEntradas = useMemo(
    () => ({
      quantidade: calcularQuantidadeTotal(entradasDetalhadasFiltradas),
      valor: calcularValorTotal(entradasDetalhadasFiltradas),
    }),
    [entradasDetalhadasFiltradas],
  )

  const resumoSaidas = useMemo(
    () => ({
      quantidade: calcularQuantidadeTotal(saidasDetalhadasFiltradas),
      valor: calcularValorTotal(saidasDetalhadasFiltradas),
    }),
    [saidasDetalhadasFiltradas],
  )

  const totalEntradasRegistros = entradasDetalhadasFiltradas.length
  const totalSaidasRegistros = saidasDetalhadasFiltradas.length

  const seriesHistorica = useMemo(
    () => agruparPorPeriodo(entradasDetalhadasFiltradas, saidasDetalhadasFiltradas),
    [entradasDetalhadasFiltradas, saidasDetalhadasFiltradas],
  )

  const valorMovimentadoSeries = useMemo(
    () =>
      seriesHistorica.map(({ periodo, valorEntradas, valorSaidas }) => ({
        periodo,
        valorEntradas,
        valorSaidas,
      })),
    [seriesHistorica],
  )

  const estoquePorMaterial = useMemo(
    () => montarTopMateriaisSaida(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )

  const estoquePorCategoria = useMemo(
    () => montarTopCategoriasSaida(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )

  const rankingFabricantes = useMemo(
    () => montarRankingFabricantes(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )

  const topCentrosServico = useMemo(
    () => montarTopCentrosServico(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )

  const topSetores = useMemo(() => montarTopSetores(saidasDetalhadasFiltradas, ''), [saidasDetalhadasFiltradas])

  const topPessoas = useMemo(() => montarTopPessoas(saidasDetalhadasFiltradas, ''), [saidasDetalhadasFiltradas])

  const estoquePorMaterialTop = useMemo(() => estoquePorMaterial.slice(0, 8), [estoquePorMaterial])
  const rankingFabricantesTop = useMemo(() => rankingFabricantes.slice(0, 8), [rankingFabricantes])
  const topCentrosServicoTop = useMemo(() => topCentrosServico.slice(0, 8), [topCentrosServico])
  const topSetoresTop = useMemo(() => topSetores.slice(0, 8), [topSetores])
  const topPessoasTop = useMemo(() => topPessoas.slice(0, 8), [topPessoas])
  const topTrocasMateriais = useMemo(
    () => montarTopTrocasMateriais(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )
  const topTrocasSetores = useMemo(
    () => montarTopTrocasSetores(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )
  const topTrocasPessoas = useMemo(
    () => montarTopTrocasPessoas(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )
  const topTrocasMateriaisTop = useMemo(() => topTrocasMateriais.slice(0, 10), [topTrocasMateriais])
  const topTrocasSetoresTop = useMemo(() => topTrocasSetores.slice(0, 10), [topTrocasSetores])
  const topTrocasPessoasTop = useMemo(() => topTrocasPessoas.slice(0, 10), [topTrocasPessoas])

  const totalMovimentacoes = totalEntradasRegistros + totalSaidasRegistros
  const totalValorMovimentado = resumoEntradas.valor + resumoSaidas.valor
  const materiaisEmAlerta = data?.estoqueAtual?.alertas?.length ?? 0
  const totalMateriais = data?.estoqueAtual?.itens?.length ?? 0

  const highlightCards = useMemo(
    () => [
      {
        id: 'movimentacoes',
        title: 'Movimentações',
        value: totalMovimentacoes,
        helper: `${totalEntradasRegistros} entradas / ${totalSaidasRegistros} saídas`,
        icon: MovementIcon,
        tone: 'blue',
        tooltip: 'Quantidade total de registros de entrada e saída no período filtrado.',
      },
      {
        id: 'valor',
        title: 'Valor movimentado',
        value: formatCurrency(totalValorMovimentado),
        helper: `${formatCurrency(resumoEntradas.valor)} em entradas / ${formatCurrency(resumoSaidas.valor)} em saídas`,
        icon: RevenueIcon,
        tone: 'green',
        tooltip: 'Soma do valor financeiro das entradas e saídas considerando o valor unitário dos materiais.',
      },
      {
        id: 'estoque',
        title: 'Entradas / Saída',
        value: `${resumoEntradas.quantidade} / ${resumoSaidas.quantidade}`,
        helper: 'Soma das quantidades (entradas / saídas)',
        icon: StockIcon,
        tone: 'orange',
        tooltip: 'Soma das quantidades em entradas e saídas no período filtrado.',
      },
      {
        id: 'alertas',
        title: 'Alertas ativos',
        value: materiaisEmAlerta,
        helper: materiaisEmAlerta ? 'Atenção: revisar estoque mínimo' : 'Tudo dentro do esperado',
        icon: AlertIcon,
        tone: 'red',
        tooltip: 'Materiais cujo estoque está abaixo do mínimo configurado.',
      },
      {
        id: 'trocas',
        title: 'Trocas (período)',
        value: `${trocaResumo.feitas} / ${trocaResumo.atrasadas} / ${trocaResumo.aVencer}`,
        helper: 'Feitas / Atrasadas / A vencer',
        icon: TrendIcon,
        tone: 'blue',
        tooltip: 'Totais de trocas no período filtrado (feitas, atrasadas e a vencer em até 7 dias).',
      },
      {
        id: 'materiais',
        title: 'Materiais monitorados',
        value: totalMateriais,
        helper: 'Materiais com saldo > 0 ou entradas no período.',
        icon: DashboardIcon,
        tone: 'slate',
        tooltip: 'Conta materiais com saldo atual ou que tiveram entradas no período filtrado.',
      },
    ],
    [
      materiaisEmAlerta,
      resumoEntradas.valor,
      resumoEntradas.quantidade,
      resumoSaidas.quantidade,
      resumoSaidas.valor,
      totalMateriais,
      totalEntradasRegistros,
      totalMovimentacoes,
      totalValorMovimentado,
      totalSaidasRegistros,
      trocaResumo,
    ],
  )

  return {
    filters,
    setFilters,
    load,
    handleChange,
    handleSubmit,
    handleClear,
    data,
    error,
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
    topTrocasMateriaisTop,
    topTrocasSetoresTop,
    topTrocasPessoasTop,
    highlightCards,
    formatPeriodoLabel,
    formatCurrency,
  }
}
