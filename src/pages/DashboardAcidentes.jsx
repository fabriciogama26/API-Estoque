import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { AlertIcon, BarsIcon, PieIcon, TrendIcon } from '../components/icons.jsx'
import { DashboardCards } from '../components/DashboardCards.jsx'
import { ChartTendencia } from '../components/charts/ChartTendencia.jsx'
import { ChartTipos } from '../components/charts/ChartTipos.jsx'
import { ChartPartesLesionadas } from '../components/charts/ChartPartesLesionadas.jsx'
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
          cargos = [],
          agentes = [],
          options = {},
        } = resultado ?? {}

        setDashboardData({
          resumo,
          tendencia,
          tipos,
          partesLesionadas,
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

      const resumo = normalizeResumo(data.resumo ?? data.cards ?? data.indicadores ?? data.resumo_indicadores)
      const tendencia = normalizeArray(data.tendencia ?? data.serie_mensal ?? data.mensal)
      const tipos = normalizeArray(data.tipos ?? data.distribuicao_tipos ?? data.por_tipo)
      const partes = normalizeArray(data.partes_lesionadas ?? data.partes ?? data.distribuicao_partes)
      const cargos = normalizeArray(data.cargos ?? data.distribuicao_cargos ?? data.por_cargo)
      const agentes = normalizeArray(data.agentes ?? data.distribuicao_agentes ?? data.por_agente)

      setDashboardData({
        resumo,
        tendencia,
        tipos,
        partesLesionadas: partes,
        cargos,
        agentes,
      })
      setFilterOptions({ ...EMPTY_FILTER_OPTIONS })
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
            <h2 className="dashboard-card__title">
              <TrendIcon size={20} /> <span>Tendencia mensal</span>
            </h2>
          </header>
          <div className="dashboard-chart-container">
            <ChartTendencia data={dashboardData.tendencia} />
          </div>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <PieIcon size={20} /> <span>Distribuicao por tipo</span>
            </h2>
          </header>
          <div className="dashboard-chart-container">
            <ChartTipos data={dashboardData.tipos} />
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <BarsIcon size={20} /> <span>Parte lesionada</span>
            </h2>
          </header>
          <div className="dashboard-chart-container">
            <ChartPartesLesionadas data={dashboardData.partesLesionadas} />
          </div>
        </section>

        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <BarsIcon size={20} /> <span>Acidentes por cargo</span>
            </h2>
          </header>
          <div className="dashboard-chart-container">
            <ChartCargos data={dashboardData.cargos} />
          </div>
        </section>
      </div>

      <section className="card dashboard-card--wide">
        <header className="card__header dashboard-card__header">
          <h2 className="dashboard-card__title">
            <PieIcon size={20} /> <span>Agente causador</span>
          </h2>
        </header>
        <div className="dashboard-chart-container">
          <ChartAgentes data={dashboardData.agentes} />
        </div>
      </section>
    </div>
  )
}
