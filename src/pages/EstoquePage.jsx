import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon, SaveIcon, InfoIcon } from '../components/icons.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/EstoquePage.css'

const initialFilters = {
  periodoInicio: '',
  periodoFim: '',
  termo: '',
  centroCusto: '',
  estoqueMinimo: '',
  apenasAlertas: false,
}

const ALERTAS_PAGE_SIZE = 6
const ITENS_PAGE_SIZE = 10

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

function normalizarTermo(termo) {
  return termo ? termo.trim().toLowerCase() : ''
}

function formatDateTimeValue(value) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function combinaComTermo(material = {}, termoNormalizado = '') {
  if (!termoNormalizado) {
    return true
  }
  const camposTexto = [
    material.nome,
    material.fabricante,
    material.resumo,
    material.grupoMaterialNome,
    material.grupoMaterial,
    material.caracteristicasTexto,
    material.corMaterial,
    material.coresTexto,
    material.numeroEspecifico,
    material.numeroCalcado,
    material.numeroCalcadoNome,
    material.numeroVestimenta,
    material.numeroVestimentaNome,
  ]
  if (Array.isArray(material.centrosCusto)) {
    camposTexto.push(material.centrosCusto.join(' '))
  }
  return camposTexto
    .map((valor) => (valor ? String(valor).toLowerCase() : ''))
    .some((texto) => texto.includes(termoNormalizado))
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

export function EstoquePage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState(initialFilters)
  const [estoque, setEstoque] = useState({ itens: [], alertas: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [minStockDrafts, setMinStockDrafts] = useState({})
  const [savingMinStock, setSavingMinStock] = useState({})
  const [minStockErrors, setMinStockErrors] = useState({})
  const [alertasPage, setAlertasPage] = useState(1)
  const [itensPage, setItensPage] = useState(1)

  const load = async (params = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.estoque.current({
        periodoInicio: params.periodoInicio || undefined,
        periodoFim: params.periodoFim || undefined,
      })
      setEstoque({ itens: data?.itens ?? [], alertas: data?.alertas ?? [] })
      setMinStockDrafts(() => {
        const drafts = {}
        ;(data?.itens ?? []).forEach((item) => {
          drafts[item.materialId] =
            item.estoqueMinimo !== undefined && item.estoqueMinimo !== null
              ? String(item.estoqueMinimo)
              : ''
        })
        return drafts
      })
      setMinStockErrors({})
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load({ ...initialFilters })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const centrosCustoDisponiveis = useMemo(
    () => uniqueSorted(estoque.itens.flatMap((item) => item.centrosCusto ?? [])),
    [estoque.itens],
  )

  const periodoFiltro = useMemo(() => {
    const parseMonthStart = (value) => {
      if (!value) return null
      const [ano, mes] = value.split('-').map(Number)
      if (!ano || !mes) return null
      return new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0))
    }
    const parseMonthEnd = (value) => {
      if (!value) return null
      const [ano, mes] = value.split('-').map(Number)
      if (!ano || !mes) return null
      return new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
    }

    const start = parseMonthStart(filters.periodoInicio)
    const end = parseMonthEnd(filters.periodoFim || filters.periodoInicio)
    return { start, end }
  }, [filters.periodoInicio, filters.periodoFim])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFilters((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    load({ ...filters })
  }

  const handleClear = () => {
    setFilters({ ...initialFilters })
    load({ ...initialFilters })
  }

  const handleMinStockChange = (materialId, value) => {
    setMinStockDrafts((prev) => ({ ...prev, [materialId]: value }))
  }

  const handleMinStockSave = async (item) => {
    const draftValue = (minStockDrafts[item.materialId] ?? '').trim()
    if (draftValue === '') {
      setMinStockErrors((prev) => ({ ...prev, [item.materialId]: 'Informe um valor' }))
      return
    }

    const parsed = Number(draftValue)
    if (Number.isNaN(parsed) || parsed < 0) {
      setMinStockErrors((prev) => ({ ...prev, [item.materialId]: 'Valor invalido' }))
      return
    }

    if (Number(item.estoqueMinimo ?? 0) === parsed) {
      setMinStockErrors((prev) => {
        const next = { ...prev }
        delete next[item.materialId]
        return next
      })
      return
    }

    setMinStockErrors((prev) => {
      const next = { ...prev }
      delete next[item.materialId]
      return next
    })

    setSavingMinStock((prev) => ({ ...prev, [item.materialId]: true }))
    try {
      const usuario = user?.name || user?.username || 'sistema'
      await api.materiais.update(item.materialId, {
        estoqueMinimo: parsed,
        usuarioResponsavel: usuario,
      })
      await load({ ...filters })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingMinStock((prev) => {
        const next = { ...prev }
        delete next[item.materialId]
        return next
      })
    }
  }

  const termoNormalizado = useMemo(() => normalizarTermo(filters.termo), [filters.termo])

  const itensFiltrados = useMemo(() => {
    const centroFiltro = filters.centroCusto.trim().toLowerCase()
    const estoqueMinimoFiltro = filters.estoqueMinimo.trim()
    const estoqueMinimoNumero =
      estoqueMinimoFiltro !== '' && !Number.isNaN(Number(estoqueMinimoFiltro))
        ? Number(estoqueMinimoFiltro)
        : null
    const aplicarEstoqueMinimo = estoqueMinimoNumero !== null
    const apenasAlertas = Boolean(filters.apenasAlertas)
    return estoque.itens.filter((item) => {
      if (centroFiltro) {
        const centros = Array.isArray(item.centrosCusto) ? item.centrosCusto : []
        const possuiCentro = centros.some((centro) => centro.toLowerCase() === centroFiltro)
        if (!possuiCentro) {
          return false
        }
      }

      if (periodoFiltro.start || periodoFiltro.end) {
        const ultimaAtualizacao = item.ultimaAtualizacao ? new Date(item.ultimaAtualizacao) : null
        if (!ultimaAtualizacao || Number.isNaN(ultimaAtualizacao.getTime())) {
          return false
        }
        if (periodoFiltro.start && ultimaAtualizacao < periodoFiltro.start) {
          return false
        }
        if (periodoFiltro.end && ultimaAtualizacao > periodoFiltro.end) {
          return false
        }
      }

      if (aplicarEstoqueMinimo) {
        const minimoConfigurado = Number(item.estoqueMinimo ?? 0)
        if (Number.isNaN(minimoConfigurado) || minimoConfigurado !== estoqueMinimoNumero) {
          return false
        }
      }

      if (apenasAlertas && !item.alerta) {
        return false
      }

      return combinaComTermo(item, termoNormalizado)
    })
  }, [
    estoque.itens,
    termoNormalizado,
    filters.centroCusto,
    periodoFiltro,
    filters.estoqueMinimo,
    filters.apenasAlertas,
  ])

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

  const totalItensPages =
    itensFiltrados.length > 0 ? Math.max(1, Math.ceil(itensFiltrados.length / ITENS_PAGE_SIZE)) : 1

  const paginatedItens = useMemo(() => {
    const start = (itensPage - 1) * ITENS_PAGE_SIZE
    return itensFiltrados.slice(start, start + ITENS_PAGE_SIZE)
  }, [itensFiltrados, itensPage])

  useEffect(() => {
    setItensPage(1)
  }, [
    filters.termo,
    filters.centroCusto,
    filters.periodoInicio,
    filters.periodoFim,
    filters.estoqueMinimo,
    filters.apenasAlertas,
  ])

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

  const totalValor = itensFiltrados.reduce((acc, item) => acc + Number(item.valorTotal ?? 0), 0)

  const resumoFiltrado = useMemo(() => {
    const totalItens = itensFiltrados.reduce(
      (acc, item) => acc + Number(item.totalEntradas ?? item.quantidade ?? 0),
      0
    )
    const valorReposicao = itensFiltrados.reduce((acc, item) => acc + Number(item.valorReposicao ?? 0), 0)
    const ultimaAtualizacao = itensFiltrados
      .map((item) => (item.ultimaAtualizacao ? new Date(item.ultimaAtualizacao) : null))
      .filter((data) => data && !Number.isNaN(data.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null

    return {
      totalItens,
      valorReposicao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
    }
  }, [itensFiltrados])

  const ultimaAtualizacaoFormatada = useMemo(
    () => formatDateTimeValue(resumoFiltrado.ultimaAtualizacao),
    [resumoFiltrado.ultimaAtualizacao],
  )

  const summaryCards = useMemo(
    () => [
      {
        id: 'totalValor',
        title: 'Total em estoque',
        value: formatCurrency(totalValor),
        hint: 'Valor monetario dos itens filtrados',
        tooltip: 'Saldo atual (quantidade em estoque x valor unitario) dos materiais filtrados.',
        icon: '⇅',
        accent: 'sky',
      },
      {
        id: 'totalItens',
        title: 'Estoque total atual',
        value: formatInteger(resumoFiltrado.totalItens),
        hint: 'Capitalizado em quantidade',
        tooltip: 'Quantidade total recebida no periodo filtrado (sem descontar saidas).',
        icon: '📦',
        accent: 'mint',
      },
      {
        id: 'valorReposicao',
        title: 'Valor para reposição',
        value: formatCurrency(resumoFiltrado.valorReposicao),
        hint: 'Diferença entre mínimo e estoque atual',
        icon: '↺',
        accent: 'white',
      },
      {
        id: 'ultimaAtualizacao',
        tooltip: 'Momento da ultima movimentacao registrada nos itens filtrados.',
        title: 'Última movimentação',
        value: ultimaAtualizacaoFormatada,
        hint:
          alertasFiltrados.length > 0
            ? `${alertasFiltrados.length} alertas ativos`
            : 'Estoque atualizado',
        icon: '⏱',
        accent: 'peach',
      },
    ],
    [
      totalValor,
      resumoFiltrado.totalItens,
      resumoFiltrado.valorReposicao,
      ultimaAtualizacaoFormatada,
      alertasFiltrados.length,
    ],
  )

  return (
    <div className="stack">
      <PageHeader
        icon={<InventoryIcon size={28} />}
        title="Estoque atual"
        subtitle="Consulte saldo por material, valor total e alertas de estoque minimo."
      />

      <form className="form form--inline" onSubmit={handleSubmit}>
        <label className="field">
          <span>Periodo inicial</span>
          <input
            type="month"
            name="periodoInicio"
            value={filters.periodoInicio}
            onChange={handleChange}
          />
        </label>
        <label className="field">
          <span>Periodo final</span>
          <input
            type="month"
            name="periodoFim"
            value={filters.periodoFim}
            onChange={handleChange}
          />
        </label>
        <label className="field">
          <span>Busca</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleChange}
            placeholder="Buscar por material ou fabricante"
          />
        </label>
        <label className="field">
          <span>Centro de estoque</span>
          <select name="centroCusto" value={filters.centroCusto} onChange={handleChange}>
            <option value="">Todos</option>
            {centrosCustoDisponiveis.map((centro) => (
              <option key={centro} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Estoque minimo</span>
          <input
            type="number"
            min="0"
            name="estoqueMinimo"
            value={filters.estoqueMinimo}
            onChange={handleChange}
            placeholder="Mínimo configurado >= valor"
          />
        </label>
        <label className="field field--checkbox field--checkbox-accent">
          <input
            type="checkbox"
            name="apenasAlertas"
            checked={Boolean(filters.apenasAlertas)}
            onChange={handleChange}
          />
          <span>Apenas alertas</span>
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

      <section className="card">
        <header className="card__header">
          <h2>Alertas de estoque</h2>
        </header>
        {alertasFiltrados.length ? (
          <>
            <div className="estoque-alert-grid">
              {alertasPaginados.map((alerta, index) => {
                const deficit = Number(alerta.deficitQuantidade ?? 0)
                const centrosLabel =
                  alerta.centrosCusto && alerta.centrosCusto.length
                    ? alerta.centrosCusto.join(', ')
                    : 'Sem centro de estoque'
                const resumo =
                  alerta.resumo || alerta.nome || alerta.fabricante || 'Material sem descrição'
                const idLabel = alerta.materialId || '---'
                const cardKey = `${alerta.materialId || 'alerta'}-${index}`
                return (
                  <article key={cardKey} className="estoque-alert-card">
                    <div className="estoque-alert-card__header">
                      <span className="estoque-alert-card__badge">Alerta</span>
                    </div>
                    <p className="estoque-alert-card__estoque">
                      Estoque atual: <strong>{alerta.estoqueAtual}</strong> | Minimo:{' '}
                      <strong>{alerta.estoqueMinimo}</strong>
                    </p>
                    <p className="estoque-alert-card__id-inline">ID: {idLabel}</p>
                    <p className="estoque-alert-card__descricao">{resumo}</p>
                    <p className="estoque-alert-card__centro">Centro de estoque: {centrosLabel}</p>
                    {deficit > 0 ? (
                      <p className="estoque-alert-card__deficit">
                        Faltam {deficit} ({formatCurrency(alerta.valorReposicao)})
                      </p>
                    ) : null}
                  </article>
                )
              })}
            </div>
            {alertasFiltrados.length > ALERTAS_PAGE_SIZE ? (
              <div className="estoque-alerts-pagination">
                <TablePagination
                  currentPage={alertasPage}
                  totalItems={alertasFiltrados.length}
                  pageSize={ALERTAS_PAGE_SIZE}
                  onPageChange={setAlertasPage}
                />
              </div>
            ) : null}
          </>
        ) : (
          <p className="feedback">Nenhum alerta no periodo.</p>
        )}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Resumo</h2>
        </header>
        <div className="estoque-summary-grid">
          {summaryCards.map((card) => (
            <article
              key={card.id}
              className={`estoque-summary-card estoque-summary-card--${card.accent}${
                card.tooltip ? ' estoque-summary-card--has-tooltip' : ''
              }`}
            >
              {card.tooltip ? (
                <div className="summary-tooltip summary-tooltip--floating" role="tooltip">
                  <InfoIcon size={16} />
                  <span>{card.tooltip}</span>
                </div>
              ) : null}
              <div className="estoque-summary-card__header">
                <span className="estoque-summary-card__title">{card.title}</span>
                <span className="estoque-summary-card__icon" aria-hidden="true">
                  {card.icon}
                </span>
              </div>
              <strong className="estoque-summary-card__value">{card.value}</strong>
              <span className="estoque-summary-card__hint">{card.hint}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Estoque materiais</h2>
        </header>
        {itensFiltrados.length === 0 ? <p className="feedback">Sem materiais cadastrados ou filtrados.</p> : null}
        <div className="estoque-list">
          {paginatedItens.map((item) => {
            const draftValue = minStockDrafts[item.materialId] ?? ''
            const isSavingMin = Boolean(savingMinStock[item.materialId])
            const fieldError = minStockErrors[item.materialId]
            const centrosCustoLabel = (item.centrosCusto && item.centrosCusto.length)
              ? item.centrosCusto.join(', ')
              : 'Sem centro de estoque'
            const ultimaAtualizacaoItem = formatDateTimeValue(item.ultimaAtualizacao)
            const deficitQuantidade = Number(item.deficitQuantidade ?? 0)
            return (
              <article key={item.materialId} className={`estoque-list__item${item.alerta ? ' estoque-list__item--alert' : ''}`}>
                {item.alerta ? (
                  <div className="estoque-list__item-alert">
                    <span className="estoque-list__item-alert-label">⚠️ Estoque Baixo –</span>
                    <span className="estoque-list__item-alert-deficit">
                      Necessario repor {deficitQuantidade} ({formatCurrency(item.valorReposicao)})
                    </span>
                  </div>
                ) : null}
                <header className="estoque-list__item-header">
                  <div className="estoque-list__item-title">
                    <p className="estoque-list__item-resumo">
                      {item.resumo || item.nome || 'Material sem descrição'}
                    </p>
                    <p className="estoque-list__item-centro">Centro de estoque: {centrosCustoLabel}</p>
                    <p className="estoque-list__item-atualizacao">Ultima atualizacao: {ultimaAtualizacaoItem}</p>
                    <p className="estoque-list__item-extra-info">
                      Validade (dias): {item.validadeDias ?? '-'} | CA: {item.ca || '-'}
                    </p>
                  </div>
                  <div className="estoque-list__item-metrics">
                    <div className="estoque-list__metric">
                      <span className="estoque-list__label">Quantidade</span>
                      <strong className="estoque-list__value">{item.quantidade}</strong>
                    </div>
                    <div className="estoque-list__metric">
                      <span className="estoque-list__label">Valor unitario</span>
                      <strong className="estoque-list__value">{formatCurrency(item.valorUnitario)}</strong>
                    </div>
                    <div className="estoque-list__metric">
                      <span className="estoque-list__label">Valor total</span>
                      <strong className="estoque-list__value">{formatCurrency(item.valorTotal)}</strong>
                    </div>
                    <div className="estoque-list__metric estoque-list__metric--min-stock">
                      <div className="estoque-list__item-min-stock">
                        <label>
                          <span>Estoque minimo</span>
                          <input
                            type="number"
                            min="0"
                            value={draftValue}
                            onChange={(event) => handleMinStockChange(item.materialId, event.target.value)}
                            disabled={isSavingMin}
                          />
                        </label>
                        <button
                          type="button"
                          className="estoque-list__item-save"
                          onClick={() => handleMinStockSave(item)}
                          disabled={isSavingMin}
                          aria-label={isSavingMin ? 'Salvando' : 'Salvar'}
                          title={isSavingMin ? 'Salvando' : 'Salvar'}
                        >
                          <SaveIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </header>
                <div className="estoque-list__item-body">
                  {fieldError ? <span className="estoque-list__item-error">{fieldError}</span> : null}
                </div>
              </article>
            )
          })}
        </div>
        {itensFiltrados.length > ITENS_PAGE_SIZE ? (
          <div className="estoque-alerts-pagination">
            <TablePagination
              currentPage={itensPage}
              totalItems={itensFiltrados.length}
              pageSize={ITENS_PAGE_SIZE}
              onPageChange={setItensPage}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}




