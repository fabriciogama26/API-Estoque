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
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { resolveIndicadorValor } from '../utils/indicadores.js'

import '../styles/DashboardPage.css'

const initialFilters = () => ({
  ano: String(new Date().getFullYear()),
  unidade: 'todas',
})

const EMPTY_STATE = {
  resumo: null,
  tendencia: [],
  tipos: [],
  partesLesionadas: [],
  cargos: [],
  agentes: [],
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
  const [availableYears, setAvailableYears] = useState([])
  const [availableUnits, setAvailableUnits] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (params) => {
    if (!isSupabaseConfigured()) {
      setError('Configuração do Supabase não encontrada. Verifique as variáveis de ambiente.')
      setDashboardData(EMPTY_STATE)
      setAvailableYears([])
      setAvailableUnits([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
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
        setAvailableYears([])
        setAvailableUnits([])
        return
      }

      const resumo = normalizeResumo(data.resumo ?? data.cards ?? data.indicadores ?? data.resumo_indicadores)
      const tendencia = normalizeArray(data.tendencia ?? data.serie_mensal ?? data.mensal)
      const tipos = normalizeArray(data.tipos ?? data.distribuicao_tipos ?? data.por_tipo)
      const partes = normalizeArray(data.partes_lesionadas ?? data.partes ?? data.distribuicao_partes)
      const cargos = normalizeArray(data.cargos ?? data.distribuicao_cargos ?? data.por_cargo)
      const agentes = normalizeArray(data.agentes ?? data.distribuicao_agentes ?? data.por_agente)

      const anos = Array.isArray(data.anos_disponiveis ?? data.anos)
        ? (data.anos_disponiveis ?? data.anos).map(String)
        : []
      const unidades = Array.isArray(data.unidades_disponiveis ?? data.unidades)
        ? data.unidades_disponiveis ?? data.unidades
        : []

      setDashboardData({
        resumo,
        tendencia,
        tipos,
        partesLesionadas: partes,
        cargos,
        agentes,
      })
      setAvailableYears(anos)
      setAvailableUnits(unidades)
    } catch (err) {
      setError(err.message)
      setDashboardData(EMPTY_STATE)
      setAvailableYears([])
      setAvailableUnits([])
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
    <div className="page dashboard-page">
      <PageHeader
        title="Dashboard de Acidentes"
        icon={<AlertIcon size={28} />}
        description="Monitoramento de indicadores de SST a partir dos dados consolidados no Supabase."
      />

      <section className="card">
        <FiltrosDashboard
          filters={filters}
          anos={availableYears.length ? availableYears : undefined}
          unidades={availableUnits.length ? availableUnits : undefined}
          onChange={handleFilterChange}
          onSubmit={handleSubmit}
          onReset={handleReset}
          isLoading={isLoading}
        />
      </section>

      {error ? (
        <section className="card">
          <div className="dashboard-card__empty">{error}</div>
        </section>
      ) : null}

      <DashboardCards indicadores={dashboardData.resumo ?? {}} helperText={helperText ?? undefined} />

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart dashboard-card--chart-lg">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <TrendIcon size={20} /> <span>Tendência mensal</span>
            </h2>
          </header>
          <ChartTendencia data={dashboardData.tendencia} />
        </section>

        <section className="card dashboard-card--chart">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <PieIcon size={20} /> <span>Distribuição por tipo</span>
            </h2>
          </header>
          <ChartTipos data={dashboardData.tipos} />
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <section className="card dashboard-card--chart">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <BarsIcon size={20} /> <span>Parte lesionada</span>
            </h2>
          </header>
          <ChartPartesLesionadas data={dashboardData.partesLesionadas} />
        </section>

        <section className="card dashboard-card--chart">
          <header className="card__header dashboard-card__header">
            <h2 className="dashboard-card__title">
              <BarsIcon size={20} /> <span>Acidentes por cargo</span>
            </h2>
          </header>
          <ChartCargos data={dashboardData.cargos} />
        </section>
      </div>

      <section className="card dashboard-card--chart">
        <header className="card__header dashboard-card__header">
          <h2 className="dashboard-card__title">
            <PieIcon size={20} /> <span>Agente causador</span>
          </h2>
        </header>
        <ChartAgentes data={dashboardData.agentes} />
      </section>
    </div>
  )
}
