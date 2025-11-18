import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon, BarsIcon, PieIcon, TrendIcon, InfoIcon, ExpandIcon, CancelIcon } from '../components/icons.jsx'
import { DashboardCards } from '../components/DashboardCards.jsx'
import { ChartTendencia } from '../components/charts/ChartTendencia.jsx'
import { ChartTipos } from '../components/charts/ChartTipos.jsx'
import { ChartPartesLesionadas } from '../components/charts/ChartPartesLesionadas.jsx'
import { ChartLesoes } from '../components/charts/ChartLesoes.jsx'
import { ChartCargos } from '../components/charts/ChartCargos.jsx'
import { ChartAgentes } from '../components/charts/ChartAgentes.jsx'
import { FiltrosDashboard } from '../components/FiltrosDashboard.jsx'
import { dataClient } from '../services/dataClient.js'
import { isLocalMode } from '../config/runtime.js'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { resolveIndicadorValor } from '../utils/indicadores.js'

import '../styles/DashboardPage.css'

const CURRENT_YEAR = new Date().getFullYear()

const initialFilters = () => ({
  ano: String(CURRENT_YEAR),
  unidade: 'todas',
  periodoInicio: `${CURRENT_YEAR}-01`,
  periodoFim: `${CURRENT_YEAR}-12`,
  centroServico: '',
  tipo: '',
  lesao: '',
  parteLesionada: '',
  agente: '',
  cargo: '',
})

const EMPTY_STATE = {
  resumo: null,
  tendencia: [],
  tipos: [],
  partesLesionadas: [],
  lesoes: [],
  cargos: [],
  agentes: [],
}

const EMPTY_FILTER_OPTIONS = {
  centrosServico: [],
  tipos: [],
  lesoes: [],
  partesLesionadas: [],
  agentes: [],
  cargos: [],
}

const CHART_INFO_MESSAGES = {
  tendencia:
    'Combina o total mensal de acidentes com as taxas de frequencia/gravidade calculadas a partir do HHT informado nas fichas.',
  tipos: 'Mostra a proporcao de cada tipo de acidente registrado para o periodo filtrado.',
  partes: 'Agrupa as partes lesionadas principais selecionadas em cada acidente.',
  lesoes: 'Distribui as lesoes principais registradas nas fichas (considera multiplas lesoes).',
  cargos: 'Total de acidentes em relacao ao cargo informado na ficha do colaborador.',
  agentes: 'Distribuicao dos agentes causadores (considera multiplos agentes por acidente).',
}

const normalizeList = (values = []) => {
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((value) => (value === undefined || value === null ? '' : String(value).trim()))
    .filter(Boolean)
}

async function fetchRemoteFilterOptions() {
  try {
    const { data, error } = await supabase.rpc('rpc_acidentes_filtros')
    if (error) {
      throw error
    }
    const payload = Array.isArray(data) && data.length ? data[0] : {}
    return {
      centrosServico: normalizeList(payload?.centros_servico ?? payload?.centros ?? []),
      tipos: normalizeList(payload?.tipos ?? []),
      lesoes: normalizeList(payload?.lesoes ?? []),
      partesLesionadas: normalizeList(payload?.partes ?? payload?.partes_lesionadas ?? []),
      agentes: normalizeList(payload?.agentes ?? []),
      cargos: normalizeList(payload?.cargos ?? []),
    }
  } catch (err) {
    console.warn('Falha ao carregar filtros remotos de acidentes.', err)
    return { ...EMPTY_FILTER_OPTIONS }
  }
}

function normalizeResumo(data) {
  if (!data) {
    return null
  }

  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  if (typeof data === 'object') {
    return data
  }

  return null
}

function normalizeArray(data) {
  if (Array.isArray(data)) {
    return data
  }
  if (!data) {
    return []
  }
  return []
}

export function DashboardAcidentes() {
  const [filters, setFilters] = useState(() => initialFilters())
  const [dashboardData, setDashboardData] = useState(EMPTY_STATE)
  const [filterOptions, setFilterOptions] = useState(() => ({ ...EMPTY_FILTER_OPTIONS }))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedChartId, setExpandedChartId] = useState(null)

  const load = useCallback(async (params) => {
    if (!isLocalMode && !isSupabaseConfigured()) {
      setError('Configuracao do Supabase nao encontrada. Verifique as variaveis de ambiente.')
      setDashboardData(EMPTY_STATE)
      setFilterOptions({ ...EMPTY_FILTER_OPTIONS })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isLocalMode) {
        if (!dataClient?.acidentes?.dashboard) {
          throw new Error('Recurso local para dashboard de acidentes indisponivel.')
        }

        const resultado = await dataClient.acidentes.dashboard(params)
        const {
          resumo = null,
          tendencia = [],
          tipos = [],
          partesLesionadas = [],
          lesoes = [],
          cargos = [],
          agentes = [],
          options = {},
        } = resultado ?? {}

        setDashboardData({
          resumo,
          tendencia,
          tipos,
          partesLesionadas,
          lesoes: Array.isArray(lesoes) ? lesoes : [],
          cargos,
          agentes,
        })
        setFilterOptions({
          centrosServico: Array.isArray(options.centrosServico) ? options.centrosServico : [],
          tipos: Array.isArray(options.tipos) ? options.tipos : [],
          lesoes: Array.isArray(options.lesoes) ? options.lesoes : [],
          partesLesionadas: Array.isArray(options.partesLesionadas) ? options.partesLesionadas : [],
          agentes: Array.isArray(options.agentes) ? options.agentes : [],
          cargos: Array.isArray(options.cargos) ? options.cargos : [],
        })
        return
      }

      let query = supabase.from('vw_indicadores_acidentes').select('*')

      if (params?.ano) {
        query = query.eq('ano', Number(params.ano))
      }

      if (params?.unidade && params.unidade !== 'todas') {
        query = query.eq('unidade', params.unidade)
      }

      const { data, error: queryError } = await query.maybeSingle()

      if (queryError) {
        throw queryError
      }

      if (!data) {
        setDashboardData(EMPTY_STATE)
        setFilterOptions({ ...EMPTY_FILTER_OPTIONS })
        return
      }

      const remoteOptions = await fetchRemoteFilterOptions()

      const resumo = normalizeResumo(data.resumo ?? data.cards ?? data.indicadores ?? data.resumo_indicadores)
      const tendencia = normalizeArray(data.tendencia ?? data.serie_mensal ?? data.mensal)
      const tipos = normalizeArray(data.tipos ?? data.distribuicao_tipos ?? data.por_tipo)
      const partes = normalizeArray(data.partes_lesionadas ?? data.partes ?? data.distribuicao_partes)
      const lesoes = normalizeArray(data.lesoes ?? data.distribuicao_lesoes ?? data.por_lesao)
      const cargos = normalizeArray(data.cargos ?? data.distribuicao_cargos ?? data.por_cargo)
      const agentes = normalizeArray(data.agentes ?? data.distribuicao_agentes ?? data.por_agente)

      setDashboardData({
        resumo,
        tendencia,
        tipos,
        partesLesionadas: partes,
        lesoes,
        cargos,
        agentes,
      })
      setFilterOptions(remoteOptions)
    } catch (err) {
      setError(err?.message ?? 'Falha ao carregar dashboard de acidentes.')
      setDashboardData(EMPTY_STATE)
      setFilterOptions({ ...EMPTY_FILTER_OPTIONS })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(initialFilters())
  }, [load])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const handleReset = () => {
    const defaults = initialFilters()
    setFilters(defaults)
    load(defaults)
  }

  const helperText = useMemo(() => {
    const resumo = dashboardData.resumo ?? {}
    return (
      resumo.periodo_label ||
      resumo.periodo ||
      resumo.referencia ||
      resolveIndicadorValor(resumo, ['periodo_referencia', 'periodoReferenciado']) ||
      null
    )
  }, [dashboardData.resumo])

  const chartModalConfig = useMemo(
    () => ({
      tendencia: {
        title: 'Tendencia mensal',
        render: () => (
          <ChartTendencia
            data={dashboardData.tendencia}
            xKey="periodo"
            acidentesKey="total_acidentes"
            tfKey="taxa_frequencia"
            tgKey="taxa_gravidade"
            height={520}
          />
        ),
      },
      tipos: {
        title: 'Distribuicao por tipo',
        render: () => <ChartTipos data={dashboardData.tipos} nameKey="tipo" valueKey="total" height={480} />,
      },
      partes: {
        title: 'Parte lesionada',
        render: () => (
          <ChartPartesLesionadas
            data={dashboardData.partesLesionadas}
            nameKey="parte_lesionada"
            valueKey="total"
            height={520}
          />
        ),
      },
      lesoes: {
        title: 'Lesoes registradas',
        render: () => (
          <ChartLesoes data={dashboardData.lesoes} nameKey="lesao" valueKey="total" height={520} />
        ),
      },
      cargos: {
        title: 'Acidentes por cargo',
        render: () => <ChartCargos data={dashboardData.cargos} nameKey="cargo" valueKey="total" height={480} />,
      },
      agentes: {
        title: 'Agente causador',
        render: () => <ChartAgentes data={dashboardData.agentes} nameKey="agente" valueKey="total" height={440} />,
      },
    }),
    [dashboardData]
  )

  const activeChart = expandedChartId ? chartModalConfig[expandedChartId] : null

  const openChartModal = (chartId) => setExpandedChartId(chartId)
  const closeChartModal = () => setExpandedChartId(null)

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Dashboard de Acidentes"
        icon={<AlertIcon size={28} />}
        subtitle="Monitoramento de indicadores de SST com dados consolidados."
      />

      <FiltrosDashboard
        filters={filters}
        options={filterOptions}
        onChange={handleFilterChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        isLoading={isLoading}
      />

      {error ? <p className="feedback feedback--error">{error}</p> : null}

      <DashboardCards indicadores={dashboardData.resumo ?? {}} helperText={helperText ?? undefined} />

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="tendencia" label="Informacoes sobre tendencia mensal" />
              <h2 className="dashboard-card__title">
                <TrendIcon size={20} /> <span>Tendencia mensal</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('tendencia')}
                aria-label="Expandir grafico tendencia mensal"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartTendencia
              data={dashboardData.tendencia}
              xKey="periodo"
              acidentesKey="total_acidentes"
              tfKey="taxa_frequencia"
              tgKey="taxa_gravidade"
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="tipos" label="Informacoes sobre distribuicao por tipo" />
              <h2 className="dashboard-card__title">
                <PieIcon size={20} /> <span>Distribuicao por tipo</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('tipos')}
                aria-label="Expandir grafico distribuicao por tipo"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartTipos data={dashboardData.tipos} nameKey="tipo" valueKey="total" />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="partes" label="Informacoes sobre parte lesionada" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Parte lesionada</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('partes')}
                aria-label="Expandir grafico parte lesionada"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartPartesLesionadas
              data={dashboardData.partesLesionadas}
              nameKey="parte_lesionada"
              valueKey="total"
            />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="lesoes" label="Informacoes sobre lesoes" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Lesoes</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('lesoes')}
                aria-label="Expandir grafico de lesoes"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartLesoes data={dashboardData.lesoes} nameKey="lesao" valueKey="total" />
          </ChartContainer>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="cargos" label="Informacoes sobre acidentes por cargo" />
              <h2 className="dashboard-card__title">
                <BarsIcon size={20} /> <span>Acidentes por cargo</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('cargos')}
                aria-label="Expandir grafico acidentes por cargo"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartCargos data={dashboardData.cargos} nameKey="cargo" valueKey="total" />
          </ChartContainer>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <div className="dashboard-card__title-group">
              <ChartInfoButton infoKey="agentes" label="Informacoes sobre agentes causadores" />
              <h2 className="dashboard-card__title">
                <PieIcon size={20} /> <span>Agente causador</span>
              </h2>
            </div>
            <div className="dashboard-card__actions">
              <button
                type="button"
                className="dashboard-card__expand"
                onClick={() => openChartModal('agentes')}
                aria-label="Expandir grafico agente causador"
              >
                <ExpandIcon size={16} />
              </button>
            </div>
          </header>
          <ChartContainer>
            <ChartAgentes data={dashboardData.agentes} nameKey="agente" valueKey="total" />
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
            <div className="chart-modal__body">{activeChart.render()}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChartInfoButton({ infoKey, label }) {
  const message = CHART_INFO_MESSAGES[infoKey]
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

function ChartContainer({ children }) {
  return <div className="dashboard-chart-container dashboard-chart-container--simple">{children}</div>
}

