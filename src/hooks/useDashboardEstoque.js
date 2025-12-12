import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MovementIcon, RevenueIcon, StockIcon, AlertIcon, DashboardIcon } from '../components/icons.jsx'
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

  const totalMovimentacoes = resumoEntradas.quantidade + resumoSaidas.quantidade
  const totalValorMovimentado = resumoEntradas.valor + resumoSaidas.valor
  const totalItensEstoque = useMemo(
    () => (data?.estoqueAtual?.itens ?? []).reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0),
    [data],
  )
  const materiaisEmAlerta = data?.estoqueAtual?.alertas?.length ?? 0
  const totalMateriais = data?.estoqueAtual?.itens?.length ?? 0

  const highlightCards = useMemo(
    () => [
      {
        id: 'movimentacoes',
        title: 'Movimentacoes',
        value: totalMovimentacoes,
        helper: `${resumoEntradas.quantidade} entradas / ${resumoSaidas.quantidade} saidas`,
        icon: MovementIcon,
        tone: 'blue',
        tooltip: 'Quantidade total de registros de entrada e saida no periodo filtrado.',
      },
      {
        id: 'valor',
        title: 'Valor movimentado',
        value: formatCurrency(totalValorMovimentado),
        helper: `${formatCurrency(resumoEntradas.valor)} em entradas / ${formatCurrency(resumoSaidas.valor)} em saidas`,
        icon: RevenueIcon,
        tone: 'green',
        tooltip: 'Soma do valor financeiro das entradas e saidas considerando o valor unitario dos materiais.',
      },
      {
        id: 'estoque',
        title: 'Em estoque / Saida',
        value: `${totalItensEstoque} / ${resumoSaidas.quantidade}`,
        helper: 'Disponivel agora / Saidas no periodo filtrado.',
        icon: StockIcon,
        tone: 'orange',
        tooltip:
          'Mostra a quantidade fisica em estoque seguida do total de saidas registradas considerando os filtros aplicados.',
      },
      {
        id: 'alertas',
        title: 'Alertas ativos',
        value: materiaisEmAlerta,
        helper: materiaisEmAlerta ? 'Atencao: revisar estoque minimo' : 'Tudo dentro do esperado',
        icon: AlertIcon,
        tone: 'red',
        tooltip: 'Materiais cujo estoque esta abaixo do minimo configurado.',
      },
      {
        id: 'materiais',
        title: 'Materiais monitorados',
        value: totalMateriais,
        helper: 'Quantidade de itens com saldo registrado.',
        icon: DashboardIcon,
        tone: 'slate',
        tooltip: 'Contagem de materiais que possuem saldo registrado no estoque.',
      },
    ],
    [materiaisEmAlerta, resumoEntradas.quantidade, resumoEntradas.valor, resumoSaidas.quantidade, resumoSaidas.valor, totalItensEstoque, totalMateriais],
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
    highlightCards,
    formatPeriodoLabel,
    formatCurrency,
  }
}
