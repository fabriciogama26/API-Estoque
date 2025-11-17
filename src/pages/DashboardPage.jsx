import { useEffect, useMemo, useState } from 'react'
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

const chartInfoMessages = {
  entradas: 'Comparativo mensal entre entradas e saídas considerando os filtros atuais.',
  valor: 'Evolução do valor financeiro movimentado (entradas x saídas) no período filtrado.',
  estoqueMaterial: 'Ranking dos materiais com maior volume de saídas dentro do período filtrado.',
  estoqueCategoria: 'Categorias dos materiais que mais geraram saídas no período.',
  topFabricantes: 'Fabricantes com maior movimentação (entradas + saídas) dentro do período.',
  topCentros: 'Total de EPIs entregues por centro de serviço de acordo com as saídas filtradas.',
  topSetores: 'Total de entregas por setor considerando as saídas filtradas.',
  topPessoas: 'Colaboradores que mais receberam EPIs no período filtrado.',
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

function resolveSetorDisplay(saida = {}) {
  const candidatos = [
    saida.setorNome,
    saida.setor,
    saida.pessoa?.setor,
    saida.pessoa?.centroServico,
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

function resolvePessoaDisplay(saida = {}) {
  const candidatos = [
    saida.pessoa?.nome,
    saida.pessoaNome,
    saida.nome,
  ]
  for (const candidato of candidatos) {
    const texto = sanitizeDisplayText(candidato)
    if (texto) {
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

function ChartInfoButton({ infoKey, label }) {
  const message = chartInfoMessages[infoKey]
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

function normalizeSearchValue(value) {
  const texto = sanitizeDisplayText(value)
  if (!texto) {
    return ''
  }
  const normalized =
    typeof texto.normalize === 'function' ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : texto
  return normalized.toLowerCase()
}

function normalizarTermo(termo) {
  return normalizeSearchValue(termo)
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
    .map((parte) => normalizeSearchValue(parte))
    .filter(Boolean)
    .join(' ')
  return partes.includes(termoNormalizado)
}

function combinaSaidaComTermo(saida = {}, termoNormalizado = '') {
  if (!termoNormalizado) return true
  const campos = [
    saida.nome,
    saida.pessoa?.nome,
    saida.pessoa?.matricula,
    saida.pessoa?.cargo,
    saida.pessoa?.centroServico,
    saida.pessoa?.setor,
    saida.pessoa?.local,
    saida.pessoaNome,
    saida.centroServico,
    saida.centroServicoNome,
    saida.setor,
    saida.setorNome,
    saida.local,
    saida.material?.nome,
    saida.material?.materialItemNome,
    saida.material?.fabricante,
    saida.material?.fabricanteNome,
    saida.material?.resumo,
    saida.material?.grupoMaterialNome,
    saida.material?.grupoMaterial,
    saida.material?.categoria,
  ]
  const corpus = campos.map((campo) => normalizeSearchValue(campo)).filter(Boolean).join(' ')
  return corpus.includes(termoNormalizado)
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
  return lista.filter((item) => {
    if (
      item?.pessoa ||
      item?.pessoaId ||
      item?.centroServico ||
      item?.setor ||
      item?.local ||
      item?.pessoaNome
    ) {
      return combinaSaidaComTermo(item, termoNormalizado)
    }
    return combinaComTermo(item.material ?? item, termoNormalizado)
  })
}

function montarTopMateriaisSaida(saidas = [], termoNormalizado) {
  const materiais = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material
    if (!material) {
      return
    }
    const nome = formatEstoqueMaterialLabel(material)
    const chave = material.id || nome
    const descricao = material.resumo || [material.nome, resolveFabricanteDisplay(material)].filter(Boolean).join(' | ')
    const atual = materiais.get(chave) ?? {
      materialId: material.id ?? chave,
      nome,
      descricao: descricao || nome,
      filtro: nome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    materiais.set(chave, atual)
  })
  return Array.from(materiais.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

function montarTopCategoriasSaida(saidas = [], termoNormalizado) {
  const categorias = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material
    const categoria =
      material?.grupoMaterialNome ||
      material?.grupoMaterial ||
      material?.categoria ||
      material?.grupo ||
      'Nao classificado'
    const atual = categorias.get(categoria) ?? {
      categoria,
      nome: categoria,
      filtro: categoria,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    categorias.set(categoria, atual)
  })
  return Array.from(categorias.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

function montarRankingFabricantes(saidas = [], termoNormalizado) {
  const fabricantes = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const material = saida.material ?? {}
    const nome = resolveFabricanteDisplay(material)
    const chave = material.fabricante || nome || 'Nao informado'
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
    atual.quantidade += Number(saida.quantidade ?? 0)
    fabricantes.set(chave, atual)
  })

  return Array.from(fabricantes.values()).sort((a, b) => b.quantidade - a.quantidade)
}

function montarTopCentrosServico(saidas = [], termoNormalizado) {
  const centros = new Map()

  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const centroNome = resolveCentroServicoDisplay(saida)
    const centroId = saida.centroServicoId || saida.setorId || centroNome
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

function montarTopSetores(saidas = [], termoNormalizado) {
  const setores = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const setorNome = resolveSetorDisplay(saida)
    const setorId = saida.setorId || setorNome
    const atual = setores.get(setorId) ?? {
      id: setorId,
      nome: setorNome,
      descricao: setorNome,
      filtro: setorNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    setores.set(setorId, atual)
  })
  return Array.from(setores.values())
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

function montarTopPessoas(saidas = [], termoNormalizado) {
  const pessoas = new Map()
  saidas.forEach((saida) => {
    if (!combinaSaidaComTermo(saida, termoNormalizado)) {
      return
    }
    const pessoaNome = resolvePessoaDisplay(saida)
    const pessoaId = saida.pessoaId || pessoaNome
    const atual = pessoas.get(pessoaId) ?? {
      id: pessoaId,
      nome: pessoaNome,
      descricao: pessoaNome,
      filtro: pessoaNome,
      quantidade: 0,
    }
    atual.quantidade += Number(saida.quantidade ?? 0)
    pessoas.set(pessoaId, atual)
  })
  return Array.from(pessoas.values())
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

  const entradasDetalhadasFiltradas = useMemo(
    () => filtrarPorTermo(data?.entradasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado]
  )

  const saidasDetalhadasFiltradas = useMemo(
    () => filtrarPorTermo(data?.saidasDetalhadas ?? [], termoNormalizado),
    [data, termoNormalizado]
  )

  const calcularQuantidadeTotal = (lista) =>
    lista.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const calcularValorTotal = (lista) =>
    lista.reduce(
      (acc, item) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
      0
    )

  const resumoEntradas = useMemo(() => ({
    quantidade: calcularQuantidadeTotal(entradasDetalhadasFiltradas),
    valor: calcularValorTotal(entradasDetalhadasFiltradas),
  }), [entradasDetalhadasFiltradas])

  const resumoSaidas = useMemo(() => ({
    quantidade: calcularQuantidadeTotal(saidasDetalhadasFiltradas),
    valor: calcularValorTotal(saidasDetalhadasFiltradas),
  }), [saidasDetalhadasFiltradas])

  const seriesHistorica = useMemo(() => {
    return agruparPorPeriodo(entradasDetalhadasFiltradas, saidasDetalhadasFiltradas)
  }, [entradasDetalhadasFiltradas, saidasDetalhadasFiltradas])

  const valorMovimentadoSeries = useMemo(
    () => seriesHistorica.map(({ periodo, valorEntradas, valorSaidas }) => ({ periodo, valorEntradas, valorSaidas })),
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

  const topSetores = useMemo(
    () => montarTopSetores(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
  )

  const topPessoas = useMemo(
    () => montarTopPessoas(saidasDetalhadasFiltradas, ''),
    [saidasDetalhadasFiltradas],
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

  const topSetoresTop = useMemo(
    () => topSetores.slice(0, 8),
    [topSetores],
  )

  const topPessoasTop = useMemo(
    () => topPessoas.slice(0, 8),
    [topPessoas],
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
      tooltip: 'Quantidade total de registros de entrada e saida no periodo filtrado.',
      icon: MovementIcon,
      tone: 'blue',
    },
    {
      id: 'valor',
      title: 'Valor movimentado',
      value: formatCurrency(totalValorMovimentado),
      helper: `${formatCurrency(resumoEntradas.valor)} em entradas / ${formatCurrency(resumoSaidas.valor)} em saidas`,
      tooltip: 'Soma do valor financeiro das entradas e saidas considerando o valor unitario dos materiais.',
      icon: RevenueIcon,
      tone: 'green',
    },
    {
      id: 'estoque',
      title: 'Em estoque / Saída',
      value: `${totalItensEstoque} / ${resumoSaidas.quantidade}`,
      helper: 'Disponivel agora / Saidas no periodo filtrado.',
      tooltip:
        'Mostra a quantidade fisica em estoque seguida do total de saidas registradas considerando os filtros aplicados.',
      icon: StockIcon,
      tone: 'purple',
    },
    {
      id: 'alertas',
      title: 'Alertas ativos',
      value: materiaisEmAlerta,
      helper: materiaisEmAlerta ? 'Atencao: revisar estoque minimo' : 'Tudo dentro do esperado',
      tooltip: 'Materiais cujo estoque esta abaixo do minimo configurado.',
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
      title: 'Top materiais',
      render: () => (
        <EstoquePorMaterialChart
          data={estoquePorMaterial}
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
    topSetores: {
      title: 'Top setores',
      render: () => (
        <EstoquePorMaterialChart
          data={topSetores}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'setor')}
        />
      ),
    },
    topPessoas: {
      title: 'Top pessoas',
      render: () => (
        <EstoquePorMaterialChart
          data={topPessoas}
          height={520}
          onItemClick={(item) => handleChartSelect(item?.filtro || item?.nome, 'pessoa')}
        />
      ),
    },
  }), [seriesHistorica, valorMovimentadoSeries, estoquePorMaterial, estoquePorCategoria, rankingFabricantes, topCentrosServico, topSetores, topPessoas])

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
          <span>Busca</span>
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
        {highlightCards.map(({ id, title, value, helper, tooltip, icon: IconComponent, tone }) => (
          <article
            key={id}
            className={`dashboard-insight-card dashboard-insight-card--${tone}${
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

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="entradas" label="Informacoes sobre o grafico Entradas x Saidas" />
              <h2 className="dashboard-card__title"><BarsIcon size={20} /> <span>Entradas x Saidas</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('entradas')} aria-label="Expandir gráfico Entradas x Saidas">
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
              <h2 className="dashboard-card__title"><RevenueIcon size={20} /> <span>Valor movimentado</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('valor')} aria-label="Expandir gráfico Valor movimentado">
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer chartFilter={chartFilter} onClear={clearChartFilter}>
            <ValorMovimentadoChart
              data={valorMovimentadoSeries}
              valueFormatter={formatCurrency}
            />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="estoqueMaterial" label="Informacoes sobre o grafico Top materiais" />
              <h2 className="dashboard-card__title"><StockIcon size={20} /> <span>Top materiais</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('estoqueMaterial')} aria-label="Expandir gráfico Top materiais">
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
              <h2 className="dashboard-card__title"><BarsIcon size={20} /> <span>Top categorias</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('estoqueCategoria')} aria-label="Expandir gráfico Top categorias">
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
              <h2 className="dashboard-card__title"><TrendIcon size={20} /> <span>Top fabricantes</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topFabricantes')} aria-label="Expandir gráfico Top fabricantes">
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
              <h2 className="dashboard-card__title"><DashboardIcon size={20} /> <span>Top centro de serviços</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topCentros')} aria-label="Expandir gráfico Top centro de serviços">
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
              <h2 className="dashboard-card__title"><BarsIcon size={20} /> <span>Top setores</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topSetores')} aria-label="Expandir gráfico Top setores">
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
              <h2 className="dashboard-card__title"><PersonIcon size={20} /> <span>Top pessoas</span></h2>
            </div>
            <div className="dashboard-card__actions">
              <button type="button" className="dashboard-card__expand" onClick={() => openChartModal('topPessoas')} aria-label="Expandir gráfico Top pessoas">
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
              <button type="button" className="chart-modal__close" onClick={closeChartModal} aria-label="Fechar gráfico expandido">
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
    </div>
  )
}



