import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatInteger } from '../utils/estoqueUtils.js'
import { useAuth } from './AuthContext.jsx'
import { usePermissions } from './PermissionsContext.jsx'
import { fetchReposicaoItens } from '../services/reposicaoApi.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { isLocalMode } from '../config/runtime.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { useEstoque } from '../hooks/useEstoque.js'
import { useEstoqueFiltro, ALERTAS_PAGE_SIZE, ITENS_PAGE_SIZE } from '../hooks/useEstoqueFiltro.js'

const EstoqueContext = createContext(null)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REPOSICAO_VAZIA = { status: 'idle', porMaterial: new Map(), politica: null, calculadoEm: null, error: null }

const INITIAL_FILTERS = {
  periodoInicio: '',
  periodoFim: '',
  termo: '',
  centroCusto: '',
  quantidadeMax: '',
  estoqueMinimo: '',
  apenasAlertas: false,
  apenasSaidas: false,
  apenasZerado: false,
  movimentacaoPeriodo: false,
}

export function EstoqueProvider({ children }) {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('estoque')
  const { ownerId, permissions, isMaster, isAdmin, canAccessPath } = usePermissions()
  const [reposicao, setReposicao] = useState(REPOSICAO_VAZIA)
  const ownerRpcId = UUID_PATTERN.test(String(ownerId || '')) ? ownerId : null
  const reposicaoDisponivel = !isLocalMode && isSupabaseConfigured()
  const canEditMinimo =
    isLocalMode || isMaster || isAdmin || (Array.isArray(permissions) && permissions.includes('estoque.write'))
  const canVerAnalise = typeof canAccessPath === 'function' ? canAccessPath('/analise-estoque') : false

  // Minimos sugerido/efetivo vem da mesma RPC da aba Compra, em uma unica chamada (sem calculo no React).
  const loadReposicao = useCallback(async () => {
    if (!reposicaoDisponivel || !ownerRpcId) {
      setReposicao(REPOSICAO_VAZIA)
      return
    }
    setReposicao((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const data = await fetchReposicaoItens(ownerRpcId)
      const porMaterial = new Map((Array.isArray(data?.itens) ? data.itens : []).map((item) => [String(item.material_id), item]))
      setReposicao({
        status: 'ready',
        porMaterial,
        politica: data?.politica || null,
        calculadoEm: data?.calculado_em || null,
        error: null,
      })
    } catch (err) {
      setReposicao({ ...REPOSICAO_VAZIA, status: 'error', error: err.message })
      reportError(err, { area: 'load_reposicao', ownerId: ownerRpcId })
    }
  }, [ownerRpcId, reposicaoDisponivel, reportError])

  useEffect(() => {
    loadReposicao()
  }, [loadReposicao])

  const estoqueState = useEstoque(
    INITIAL_FILTERS,
    () => user?.id || user?.user?.id || user?.name || user?.username || 'sistema',
    (err, ctx) => reportError(err, { area: 'load_estoque', ...ctx }),
  )
  const filtroState = useEstoqueFiltro(INITIAL_FILTERS, estoqueState.estoque, estoqueState.estoqueBase)

  const handleMinStockSave = async (item, motivo = null) => {
    const ok = await estoqueState.handleMinStockSave(
      item,
      filtroState.filters,
      (err, ctx) => reportError(err, { area: 'salvar_estoque_minimo', ...ctx }),
      motivo,
    )
    if (ok) {
      await loadReposicao()
    }
    return ok
  }

  const applyFilters = async (nextFilters = null) => {
    if (nextFilters) {
      filtroState.setFilters(nextFilters)
    }
    const params = nextFilters ?? filtroState.filters
    filtroState.applyDraftFilters(params)
    await Promise.all([estoqueState.load({ ...params }, { force: true }), loadReposicao()])
  }
  const resetFilters = async () => {
    filtroState.resetFiltersState()
    await estoqueState.load({ ...INITIAL_FILTERS }, { force: true })
  }

  // Cards da politica de reposicao: somam apenas os itens visiveis com os filtros aplicados.
  const summaryCards = useMemo(() => {
    const pronto = reposicao.status === 'ready'
    const indisponivelHint = reposicao.status === 'loading' ? 'Calculando...' : 'Indisponivel no momento'
    let valorCompra = 0
    let itensCompra = 0
    let semConsumo = 0
    let divergentes = 0
    if (pronto) {
      filtroState.itensFiltrados.forEach((item) => {
        const politica = reposicao.porMaterial.get(String(item.materialId ?? ''))
        if (!politica) return
        const valor = Number(politica.valor_compra_sugerida || 0)
        if (Number(politica.compra_sugerida_qtd || 0) > 0) {
          itensCompra += 1
          valorCompra += valor
        }
        if (politica.situacao === 'sem_consumo_recente') semConsumo += 1
        else if (politica.divergencia_manual) divergentes += 1
      })
    }
    const link = canVerAnalise ? { label: 'Ver na Analise (aba Compra)', to: '/analise-estoque?aba=compra' } : null
    return [
      ...filtroState.summaryCards,
      {
        id: 'compraRecomendada',
        title: 'Compra recomendada',
        value: pronto ? formatCurrency(valorCompra) : '-',
        hint: pronto ? `${formatInteger(itensCompra)} materiais pela politica de reposicao` : indisponivelHint,
        tooltip:
          'Compra sugerida pela politica de reposicao (mesmo calculo da aba Compra da Analise de Estoque): repoe ate o maximo efetivo os materiais em ruptura ou abaixo do minimo efetivo. Materiais sem consumo recente ficam fora.',
        icon: 'CR',
        accent: 'violet',
        link,
      },
      {
        id: 'revisarMinimos',
        title: 'Revisar mínimos',
        value: pronto ? formatInteger(semConsumo + divergentes) : '-',
        hint: pronto
          ? `${formatInteger(semConsumo)} sem consumo | ${formatInteger(divergentes)} divergentes do sugerido`
          : indisponivelHint,
        tooltip:
          'Materiais com minimo cadastrado que merecem revisao: sem nenhuma saida na janela da politica (fora da compra) ou com minimo cadastrado muito diferente do sugerido pelo consumo. Nao geram compra.',
        icon: 'RM',
        accent: 'amber',
        link,
      },
    ]
  }, [canVerAnalise, filtroState.itensFiltrados, filtroState.summaryCards, reposicao])

  const handleFilterChange = (event) => {
    filtroState.handleChange(event)
  }

  const value = {
    // dados
    estoque: estoqueState.estoque,
    estoqueBase: estoqueState.estoqueBase,
    error: estoqueState.error,
    // filtros
    filters: filtroState.filters,
    setFilters: filtroState.setFilters,
    handleFilterChange,
    applyFilters,
    resetFilters,
    centrosCustoDisponiveis: filtroState.centrosCustoDisponiveis,
    summaryCards,
    // alertas
    alertasPaginados: filtroState.alertasPaginados,
    alertasPage: filtroState.alertasPage,
    totalAlertasPages: filtroState.totalAlertasPages,
    setAlertasPage: filtroState.setAlertasPage,
    totalAlertas: filtroState.alertasFiltrados.length,
    // itens
    paginatedItens: filtroState.paginatedItens,
    itensFiltrados: filtroState.itensFiltrados,
    itensFiltradosBase: filtroState.itensFiltradosBase,
    itensPage: filtroState.itensPage,
    totalItensPages: filtroState.totalItensPages,
    setItensPage: filtroState.setItensPage,
    // minimo estoque
    minStockDrafts: estoqueState.minStockDrafts,
    minStockErrors: estoqueState.minStockErrors,
    savingMinStock: estoqueState.savingMinStock,
    handleMinStockChange: estoqueState.handleMinStockChange,
    handleMinStockSave,
    isLoading: estoqueState.isLoading,
    // politica de reposicao (minimo sugerido/efetivo)
    reposicao,
    canEditMinimo,
    canVerAnalise,
    // tamanhos de pagina
    alertasPageSize: ALERTAS_PAGE_SIZE,
    itensPageSize: ITENS_PAGE_SIZE,
  }

  return <EstoqueContext.Provider value={value}>{children}</EstoqueContext.Provider>
}

export function useEstoqueContext() {
  const ctx = useContext(EstoqueContext)
  if (!ctx) {
    throw new Error('useEstoqueContext deve ser usado dentro de EstoqueProvider')
  }
  return ctx
}
