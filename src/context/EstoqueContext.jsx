import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import { useEstoque } from '../hooks/useEstoque.js'
import { useEstoqueFiltro, ALERTAS_PAGE_SIZE, ITENS_PAGE_SIZE } from '../hooks/useEstoqueFiltro.js'

const EstoqueContext = createContext(null)

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
}

export function EstoqueProvider({ children }) {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('estoque')

  const estoqueState = useEstoque(
    INITIAL_FILTERS,
    () => user?.id || user?.user?.id || user?.name || user?.username || 'sistema',
    (err, ctx) => reportError(err, { area: 'load_estoque', ...ctx }),
  )
  const filtroState = useEstoqueFiltro(INITIAL_FILTERS, estoqueState.estoque)

  const handleMinStockSave = async (item) => {
    return await estoqueState.handleMinStockSave(item, filtroState.filters, (err, ctx) =>
      reportError(err, { area: 'salvar_estoque_minimo', ...ctx }),
    )
  }

  const applyFilters = async () => {
    filtroState.applyDraftFilters()
    await estoqueState.load({ ...filtroState.filters }, { force: true })
  }
  const resetFilters = async () => {
    filtroState.resetFiltersState()
    await estoqueState.load({ ...INITIAL_FILTERS }, { force: true })
  }

  const value = {
    // dados
    estoque: estoqueState.estoque,
    error: estoqueState.error,
    // filtros
    filters: filtroState.filters,
    setFilters: filtroState.setFilters,
    handleFilterChange: filtroState.handleChange,
    applyFilters,
    resetFilters,
    centrosCustoDisponiveis: filtroState.centrosCustoDisponiveis,
    summaryCards: filtroState.summaryCards,
    // alertas
    alertasPaginados: filtroState.alertasPaginados,
    alertasPage: filtroState.alertasPage,
    totalAlertasPages: filtroState.totalAlertasPages,
    setAlertasPage: filtroState.setAlertasPage,
    totalAlertas: filtroState.alertasFiltrados.length,
    // itens
    paginatedItens: filtroState.paginatedItens,
    itensFiltrados: filtroState.itensFiltrados,
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
