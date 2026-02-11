import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDashboardAcidentes } from '../services/dashboardAcidentesApi.js'
import {
  initialDashboardFilters,
  EMPTY_DASHBOARD_STATE,
  EMPTY_FILTER_OPTIONS,
} from '../utils/dashboardAcidentesUtils.js'
import { resolveIndicadorValor } from '../utils/indicadores.js'

export function useDashboardAcidentes(onError) {
  const [filters, setFilters] = useState(() => initialDashboardFilters())
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD_STATE)
  const [filterOptions, setFilterOptions] = useState(() => ({ ...EMPTY_FILTER_OPTIONS }))
  const [error, setError] = useState(null)
  const [expandedChartId, setExpandedChartId] = useState(null)
  const lastKeyRef = useRef(null)
  const dataRef = useRef(EMPTY_DASHBOARD_STATE)
  const optionsRef = useRef({ ...EMPTY_FILTER_OPTIONS })
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (params) => {
      const key = JSON.stringify(params || {})
      if (lastKeyRef.current === key) {
        return
      }
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setError(null)
      try {
        const resultado = await fetchDashboardAcidentes(params)
        if (requestId !== requestIdRef.current) {
          return
        }
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

        const nextData = {
          resumo,
          tendencia,
          tipos,
          partesLesionadas,
          lesoes: Array.isArray(lesoes) ? lesoes : [],
          cargos,
          agentes,
        }
        const nextOptions = {
          centrosServico: Array.isArray(options.centrosServico) ? options.centrosServico : [],
          tipos: Array.isArray(options.tipos) ? options.tipos : [],
          lesoes: Array.isArray(options.lesoes) ? options.lesoes : [],
          partesLesionadas: Array.isArray(options.partesLesionadas) ? options.partesLesionadas : [],
          agentes: Array.isArray(options.agentes) ? options.agentes : [],
          cargos: Array.isArray(options.cargos) ? options.cargos : [],
        }

        const currentDataKey = JSON.stringify(dataRef.current)
        const nextDataKey = JSON.stringify(nextData)
        const currentOptsKey = JSON.stringify(optionsRef.current)
        const nextOptsKey = JSON.stringify(nextOptions)

        if (currentDataKey !== nextDataKey) {
          setDashboardData(nextData)
          dataRef.current = nextData
        }
        if (currentOptsKey !== nextOptsKey) {
          setFilterOptions(nextOptions)
          optionsRef.current = nextOptions
        }
        lastKeyRef.current = key
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return
        }
        setError(err?.message ?? 'Falha ao carregar dashboard de acidentes.')
        setDashboardData(EMPTY_DASHBOARD_STATE)
        setFilterOptions({ ...EMPTY_FILTER_OPTIONS })
        if (typeof onError === 'function') {
          onError(err, { area: 'dashboard_acidentes_load' })
        }
      }
    },
    [onError],
  )

  useEffect(() => {
    load(initialDashboardFilters())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load(filters)
  }

  const handleReset = () => {
    const defaults = initialDashboardFilters()
    setFilters(defaults)
    lastKeyRef.current = null
    load(defaults)
  }

  const helperText = (() => {
    const resumo = dashboardData.resumo ?? {}
    return (
      resumo.periodo_label ||
      resumo.periodo ||
      resumo.referencia ||
      resolveIndicadorValor(resumo, ['periodo_referencia', 'periodoReferenciado']) ||
      null
    )
  })()

  return {
    filters,
    setFilters,
    handleFilterChange,
    handleSubmit,
    handleReset,
    dashboardData,
    filterOptions,
    error,
    helperText,
    expandedChartId,
    setExpandedChartId,
    load,
  }
}
