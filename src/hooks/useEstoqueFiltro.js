import { useEffect, useMemo, useState } from 'react'
import {
  filterEstoqueItens,
  parsePeriodoRange,
  uniqueSorted,
  formatDateTimeValue,
  formatCurrency,
  formatInteger,
} from '../utils/estoqueUtils.js'

export const ALERTAS_PAGE_SIZE = 6
export const ITENS_PAGE_SIZE = 10

export function useEstoqueFiltro(initialFilters, estoque) {
  const [filters, setFilters] = useState(initialFilters)
  const [alertasPage, setAlertasPage] = useState(1)
  const [itensPage, setItensPage] = useState(1)

  const periodoFiltro = useMemo(
    () => parsePeriodoRange(filters.periodoInicio, filters.periodoFim || filters.periodoInicio),
    [filters.periodoInicio, filters.periodoFim],
  )

  const centrosCustoDisponiveis = useMemo(
    () => uniqueSorted(estoque.itens.flatMap((item) => item.centrosCusto ?? [])),
    [estoque.itens],
  )

  const itensFiltrados = useMemo(
    () => filterEstoqueItens(estoque.itens, filters, periodoFiltro),
    [estoque.itens, filters, periodoFiltro],
  )

  const alertasFiltrados = useMemo(
    () => itensFiltrados.filter((item) => item.alerta),
    [itensFiltrados],
  )

  const totalAlertasPages =
    alertasFiltrados.length > 0 ? Math.max(1, Math.ceil(alertasFiltrados.length / ALERTAS_PAGE_SIZE)) : 1

  const alertasPaginados = useMemo(() => {
    const start = (alertasPage - 1) * ALERTAS_PAGE_SIZE
    return alertasFiltrados.slice(start, start + ALERTAS_PAGE_SIZE)
  }, [alertasFiltrados, alertasPage])

  const totalItensPages =
    itensFiltrados.length > 0 ? Math.max(1, Math.ceil(itensFiltrados.length / ITENS_PAGE_SIZE)) : 1

  const paginatedItens = useMemo(() => {
    const start = (itensPage - 1) * ITENS_PAGE_SIZE
    return itensFiltrados.slice(start, start + ITENS_PAGE_SIZE)
  }, [itensFiltrados, itensPage])

  const totalValorSaldo = itensFiltrados.reduce((acc, item) => acc + Number(item.valorTotal ?? 0), 0)
  const resumoFiltrado = useMemo(() => {
    const saldoQuantidade = itensFiltrados.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0),
      0
    )
    const valorReposicao = itensFiltrados.reduce((acc, item) => acc + Number(item.valorReposicao ?? 0), 0)
    const ultimaAtualizacao = itensFiltrados
      .map((item) => (item.ultimaAtualizacao ? new Date(item.ultimaAtualizacao) : null))
      .filter((data) => data && !Number.isNaN(data.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null
    return {
      saldoQuantidade,
      valorReposicao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
    }
  }, [itensFiltrados])

  const summaryCards = useMemo(
    () => [
      {
        id: 'totalValor',
        title: 'Total em estoque',
        value: formatCurrency(totalValorSaldo),
        hint: 'Valor do saldo (entradas - saidas)',
        tooltip:
          'Saldo financeiro considerando apenas a quantidade disponivel (entradas - saidas) multiplicada pelo valor unitario.',
        icon: 'R$',
        accent: 'sky',
      },
      {
        id: 'valorReposicao',
        title: 'Valor para reposição',
        value: formatCurrency(resumoFiltrado.valorReposicao),
        hint: 'Diferenca entre minimo e saldo atual',
        tooltip: 'Diferenca entre estoque minimo configurado e saldo atual dos itens filtrados.',
        icon: 'VR',
        accent: 'white',
      },
      {
        id: 'totalItens',
        title: 'Estoque total atual',
        value: formatInteger(resumoFiltrado.saldoQuantidade),
        hint: 'Quantidade liquida (entradas - saidas)',
        tooltip: 'Quantidade disponivel neste momento, desconsiderando itens ja entregues ou cancelados.',
        icon: '#',
        accent: 'mint',
      },
      {
        id: 'ultimaAtualizacao',
        tooltip: 'Momento da ultima movimentacao registrada nos itens filtrados.',
        title: 'Última movimentação',
        value: formatDateTimeValue(resumoFiltrado.ultimaAtualizacao),
        hint:
          alertasFiltrados.length > 0
            ? `${alertasFiltrados.length} alertas ativos`
            : 'Estoque atualizado',
        icon: 'CLK',
        accent: 'peach',
      },
    ],
    [alertasFiltrados.length, resumoFiltrado.saldoQuantidade, resumoFiltrado.valorReposicao, resumoFiltrado.ultimaAtualizacao, totalValorSaldo],
  )

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFilters((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  useEffect(() => {
    setAlertasPage(1)
  }, [alertasFiltrados.length])

  useEffect(() => {
    setAlertasPage((prev) => {
      if (prev > totalAlertasPages) {
        return totalAlertasPages
      }
      return prev
    })
  }, [totalAlertasPages])

  useEffect(() => {
    setItensPage(1)
  }, [filters.termo, filters.centroCusto, filters.periodoInicio, filters.periodoFim, filters.estoqueMinimo, filters.apenasAlertas])

  useEffect(() => {
    setItensPage((prev) => {
      if (prev > totalItensPages) {
        return totalItensPages
      }
      if (prev < 1) {
        return 1
      }
      return prev
    })
  }, [totalItensPages])

  const handleSubmit = (event, loadFn) => {
    event.preventDefault()
    if (typeof loadFn === 'function') {
      loadFn({ ...filters })
    }
  }

  const handleClear = (loadFn) => {
    setFilters({ ...initialFilters })
    if (typeof loadFn === 'function') {
      loadFn({ ...initialFilters })
    }
  }

  return {
    filters,
    setFilters,
    handleChange,
    handleSubmit,
    handleClear,
    centrosCustoDisponiveis,
    periodoFiltro,
    itensFiltrados,
    alertasFiltrados,
    alertasPage,
    setAlertasPage,
    alertasPaginados,
    totalAlertasPages,
    paginatedItens,
    itensFiltrados,
    itensPage,
    totalItensPages,
    setItensPage,
    summaryCards,
  }
}
