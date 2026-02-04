import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { DashboardIcon, TrendIcon, AlertIcon, RevenueIcon, ExpandIcon, InfoIcon } from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { ParetoChart } from '../components/charts/ParetoChart.jsx'
import { ForecastGastoChart } from '../components/charts/ForecastGastoChart.jsx'
import { ChartExpandModal } from '../components/Dashboard/ChartExpandModal.jsx'
import { DashboardEstoqueProvider, useDashboardEstoqueContext } from '../context/DashboardEstoqueContext.jsx'
import { computePercentile, formatNumber, formatPercent, formatCurrency } from '../utils/inventoryReportUtils.js'
import { copyTextToClipboard } from '../utils/clipboard.js'
import { fetchEstoqueForecast, updateEstoqueForecast } from '../services/estoqueApi.js'

import '../styles/DashboardPage.css'

function FiltersForm() {
  const { filters, handleChange, handleSubmit, handleClear } = useDashboardEstoqueContext()
  return (
    <section className="card">
      <header className="card__header">
        <h2>Filtros</h2>
      </header>
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
          <input name="termo" value={filters.termo} onChange={handleChange} placeholder="ex: bota, 3M, luva" />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--primary">
            Aplicar filtros
          </button>
          <button type="button" className="button button--ghost" onClick={handleClear}>
            Limpar filtros
          </button>
        </div>
      </form>
    </section>
  )
}

function AnaliseCards() {
  const { paretoQuantidade, paretoFinanceiro, paretoRisco, riscoOperacional, saidasResumo, diasPeriodo } =
    useDashboardEstoqueContext()

  const totals = useMemo(() => {
    const quantidadeList = paretoQuantidade?.lista || []
    const financeiroList = paretoFinanceiro?.lista || []
    const riscoList = riscoOperacional || []

    const countClassA = (list) => list.filter((item) => item.classe === 'A')
    const classAQuantidade = countClassA(quantidadeList)
    const classAFinanceiro = countClassA(financeiroList)

    const totalQuantidade = quantidadeList.length || 1
    const totalFinanceiro = financeiroList.length || 1

    const percentualConsumoClasseA = classAQuantidade.reduce((acc, item) => acc + (item.percentual || 0), 0)
    const percentualMateriaisClasseA = (classAQuantidade.length / totalQuantidade) * 100

    const percentualValorClasseA = classAFinanceiro.reduce((acc, item) => acc + (item.percentual || 0), 0)
    const percentualItensClasseA = (classAFinanceiro.length / totalFinanceiro) * 100

    const riscoCritico = riscoList.filter((item) => (item.classeRisco || item.classe) === 'A').length
    const riscoAtencao = riscoList.filter((item) => (item.classeRisco || item.classe) === 'B').length
    const riscoControlado = riscoList.filter((item) => (item.classeRisco || item.classe) === 'C').length

    const dias = Math.max(1, Number(diasPeriodo || 0))
    const valorUnitarios = saidasResumo.map((item) => item.valorUnitario).filter((value) => Number(value) > 0)
    const giroDiarioList = saidasResumo.map((item) => (Number(item.quantidade || 0) / dias) || 0)
    const p80ValorUnitario = computePercentile(valorUnitarios, 0.8)
    const p20Giro = computePercentile(giroDiarioList, 0.2)

    const caroBaixoGiroIds = new Set()
    saidasResumo.forEach((item) => {
      const giroDiario = Number(item.quantidade || 0) / dias
      if (Number(item.valorUnitario || 0) >= p80ValorUnitario && giroDiario <= p20Giro) {
        const key = item.materialIdDisplay || item.materialId || item.id || item.nome
        if (key) caroBaixoGiroIds.add(String(key))
      }
    })

    const flagsQuantidadeA = new Map()
    classAQuantidade.forEach((item) => {
      const key = item.materialIdDisplay || item.materialId || item.id || item.nome
      if (key) flagsQuantidadeA.set(String(key), true)
    })
    const flagsRiscoA = new Map()
    riscoList.forEach((item) => {
      const classeRisco = item.classeRisco || item.classe
      if (classeRisco !== 'A') return
      const key = item.materialIdDisplay || item.materialId || item.id || item.nome
      if (key) flagsRiscoA.set(String(key), true)
    })
    const flagsValorA = new Map()
    classAFinanceiro.forEach((item) => {
      const key = item.materialIdDisplay || item.materialId || item.id || item.nome
      if (key) flagsValorA.set(String(key), true)
    })

    const allKeys = new Set([
      ...flagsQuantidadeA.keys(),
      ...flagsRiscoA.keys(),
      ...flagsValorA.keys(),
    ])

    let classeAMulti = 0
    let classeARiscoNaoQuantidade = 0
    allKeys.forEach((key) => {
      const count =
        (flagsQuantidadeA.get(key) ? 1 : 0) + (flagsRiscoA.get(key) ? 1 : 0) + (flagsValorA.get(key) ? 1 : 0)
      if (count >= 2) {
        classeAMulti += 1
      }
      if (flagsRiscoA.get(key) && !flagsQuantidadeA.get(key)) {
        classeARiscoNaoQuantidade += 1
      }
    })

    const giroDiarioRisk = riscoList.map((item) => item.giroDiario || 0)
    const p80Giro = computePercentile(giroDiarioRisk, 0.8)

    const recomendaCount = {
      aumentar: 0,
      reduzir: 0,
      manter: 0,
    }

    riscoList.forEach((item) => {
      const key = item.materialIdDisplay || item.materialId || item.id || item.nome
      const itemCaroBaixoGiro = key ? caroBaixoGiroIds.has(String(key)) : false

      const condAumentar =
        (flagsRiscoA.get(String(key)) || false) ||
        (Number(item.estoqueAtual || 0) < Number(item.estoqueMinimo || 0) &&
          Number(item.giroDiario || 0) >= p80Giro)
      const condReduzir =
        Number(item.estoqueAtual || 0) > Number(item.pressaoVidaUtil || 0) * 1.5 || itemCaroBaixoGiro

      if (condAumentar) {
        recomendaCount.aumentar += 1
      } else if (condReduzir) {
        recomendaCount.reduzir += 1
      } else {
        recomendaCount.manter += 1
      }
    })

    return {
      percentualConsumoClasseA,
      percentualMateriaisClasseA,
      quantidadeClasseA: classAQuantidade.length,
      riscoCritico,
      riscoAtencao,
      riscoControlado,
      percentualValorClasseA,
      percentualItensClasseA,
      caroBaixoGiro: caroBaixoGiroIds.size,
      classeAMulti,
      classeARiscoNaoQuantidade,
      recomendaCount,
    }
  }, [paretoQuantidade, paretoFinanceiro, paretoRisco, riscoOperacional, saidasResumo, diasPeriodo])

  const cards = [
    {
      id: 'classe-a-quantidade',
      title: 'Classe A por quantidade',
      value: `${formatPercent(totals.percentualConsumoClasseA, 0)} do consumo`,
      helper: `${formatNumber(totals.quantidadeClasseA)} itens (${formatPercent(
        totals.percentualMateriaisClasseA,
        0,
      )})`,
      tone: 'blue',
      icon: TrendIcon,
      tooltip: 'Mostra quanto do consumo se concentra nos itens Classe A e quantos materiais compoem esse grupo.',
    },
    {
      id: 'risco-abc',
      title: 'Risco operacional (ABC)',
      value: 'Classificacao atual',
      helper: `A: ${formatNumber(totals.riscoCritico)} | B: ${formatNumber(
        totals.riscoAtencao,
      )} | C: ${formatNumber(totals.riscoControlado)}`,
      tone: 'orange',
      icon: AlertIcon,
      tooltip: 'Resume a distribuicao de risco operacional por classe (critico, atencao e controlado).',
    },
    {
      id: 'valor-a',
      title: 'Concentracao do gasto (Classe A)',
      value: `${formatPercent(totals.percentualValorClasseA, 0)} do valor`,
      helper: `em ${formatPercent(totals.percentualItensClasseA, 0)} dos itens`,
      tone: 'blue',
      icon: RevenueIcon,
      tooltip: 'Indica quanto do valor financeiro se concentra nos itens Classe A.',
    },
    {
      id: 'caro-baixo-giro',
      title: 'Itens caros com baixo giro',
      value: `${formatNumber(totals.caroBaixoGiro)}`,
      helper: 'Reduzir compras e avaliar excesso',
      tone: 'orange',
      icon: AlertIcon,
      tooltip: 'Itens com valor unitario alto e giro diario baixo (potencial desperdicio).',
    },
    {
      id: 'classe-a-special',
      title: 'Anomalias / Itens especiais',
      value: `${formatNumber(totals.classeAMulti)} criticos multidimensionais`,
      helper: `Risco alto com baixo volume: ${formatNumber(totals.classeARiscoNaoQuantidade)}`,
      tone: 'red',
      icon: AlertIcon,
      tooltip: 'Destaque para itens Classe A em 2+ Paretos e risco alto com baixo volume.',
    },
    {
      id: 'recomendacoes',
      title: 'Recomendacoes automaticas',
      value: 'Plano de acao',
      helper: `Aumentar: ${formatNumber(totals.recomendaCount.aumentar)} | Reduzir: ${formatNumber(
        totals.recomendaCount.reduzir,
      )} | Manter: ${formatNumber(totals.recomendaCount.manter)}`,
      tone: 'green',
      icon: DashboardIcon,
      tooltip: 'Resumo das acoes calculadas com base em risco, giro e excesso.',
    },
  ]

  return (
    <div className="dashboard-highlights analysis-cards">
      {cards.map((card) => {
        const IconComponent = card.icon
        return (
        <article
          key={card.id}
          className={`dashboard-insight-card dashboard-insight-card--${card.tone}${
            card.tooltip ? ' dashboard-insight-card--has-tooltip' : ''
          }`}
        >
          {card.tooltip ? (
            <div className="summary-tooltip summary-tooltip--floating" role="tooltip">
              <InfoIcon size={16} />
              <span>{card.tooltip}</span>
            </div>
          ) : null}
          <header className="dashboard-insight-card__header">
            <p className="dashboard-insight-card__title">{card.title}</p>
            {IconComponent ? (
              <span className="dashboard-insight-card__avatar">
                <IconComponent size={22} />
              </span>
            ) : null}
          </header>
          <strong className="dashboard-insight-card__value">{card.value}</strong>
          <span className="dashboard-insight-card__helper">{card.helper}</span>
        </article>
        )
      })}
    </div>
  )
}

function ParetoSection({
  title,
  icon,
  data,
  valueKey,
  valueLabel,
  valueFormatter,
  palette,
  legendLabels,
  info,
  showValidation,
  validationData,
}) {
  const [expanded, setExpanded] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [validationPage, setValidationPage] = useState(1)
  const [copied, setCopied] = useState(false)
  const IconComponent = icon || null
  const pageSize = 10
  const validationList = validationData?.lista || []
  const pageStart = (validationPage - 1) * pageSize
  const pageItems = validationList.slice(pageStart, pageStart + pageSize)
  const copyLabel = copied ? 'Tabela copiada' : 'Copiar tabela'

  const buildClipboardText = () => {
    const header = validationData?.columns?.length ? validationData.columns.join('\t') : ''
    const rows = validationList.map((item) => {
      const rowValues = validationData?.rowValues?.(item, formatNumber, formatPercent)
      const safeValues = Array.isArray(rowValues) ? rowValues : []
      return safeValues.map((value) => (value === null || value === undefined ? '' : String(value))).join('\t')
    })
    return [header, ...rows].filter(Boolean).join('\n')
  }

  const handleCopyTable = async () => {
    const ok = await copyTextToClipboard(buildClipboardText())
    setCopied(ok)
    if (ok) {
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <>
      <section className="card analysis-pareto-section">
        <header className="card__header dashboard-card__header">
          <div className="dashboard-card__title-group">
            {info?.tooltip ? (
              <button type="button" className="summary-tooltip dashboard-card__info" aria-label="Informacoes do grafico">
                <InfoIcon size={14} />
                <span>{info.tooltip}</span>
              </button>
            ) : null}
            <h2 className="dashboard-card__title">
              {IconComponent ? <IconComponent size={20} /> : null} <span>{title}</span>
            </h2>
          </div>
          <div className="dashboard-card__actions">
            {showValidation ? (
              <button
                type="button"
                className="dashboard-card__toggle"
                onClick={() => {
                  setValidationOpen(true)
                  setValidationPage(1)
                }}
              >
                Validacao
              </button>
            ) : null}
            <button
              type="button"
              className="dashboard-card__expand"
              onClick={() => setExpanded(true)}
              aria-label={`Expandir grafico ${title}`}
            >
              <ExpandIcon size={16} />
            </button>
          </div>
        </header>
        <div className="analysis-pareto-grid">
          <div className="analysis-pareto-chart">
            <ParetoChart
              data={data}
              valueKey={valueKey}
              valueLabel={valueLabel}
              valueFormatter={valueFormatter}
              height={420}
              palette={palette}
              legendLabels={legendLabels}
            />
          </div>
          <div className="analysis-pareto-info">
            <h3>{info.title}</h3>
            <p className="analysis-pareto-question">{info.question}</p>
            {info.summary ? <p>{info.summary}</p> : null}
            {info.lists?.length
              ? info.lists.map((list) => (
                  <div key={list.title}>
                    <p className="analysis-pareto-list-title">{list.title}</p>
                    <ul>
                      {list.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))
              : null}
            {info.actions?.length ? (
              <>
                <h4>Acoes diretas</h4>
                {info.actions.map((list) => (
                  <div key={list.title}>
                    {list.title ? <p className="analysis-pareto-list-title">{list.title}</p> : null}
                    <ul>
                      {list.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      </section>

      <ChartExpandModal open={expanded} title={title} onClose={() => setExpanded(false)}>
        <ParetoChart
          data={data}
          valueKey={valueKey}
          valueLabel={valueLabel}
          valueFormatter={valueFormatter}
          height={520}
          palette={palette}
          legendLabels={legendLabels}
        />
      </ChartExpandModal>

      <ChartExpandModal open={validationOpen} title={validationData?.title || 'Validacao do Pareto'} onClose={() => setValidationOpen(false)}>
        <div className="analysis-audit-actions">
          <button type="button" className="button button--ghost" onClick={handleCopyTable} disabled={!validationList.length}>
            {copyLabel}
          </button>
        </div>
        {validationData?.summary ? <div className="analysis-audit-summary">{validationData.summary}</div> : null}
        <div className="table-wrapper">
          <table className="data-table analysis-audit-table">
            <thead>
              <tr>
                {validationData?.columns?.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const id = item.materialIdDisplay || item.materialId || item.id || '-'
                const nome = item.nome || item.descricao || '-'
                return (
                  <tr key={`${id}-${nome}`}>
                    {validationData?.rowMapper?.(item, formatNumber, formatPercent)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalItems={validationList.length}
          pageSize={pageSize}
          currentPage={validationPage}
          onPageChange={setValidationPage}
        />
      </ChartExpandModal>
    </>
  )
}

export function AnaliseEstoquePage() {
  const {
    paretoQuantidadeTop,
    paretoRiscoTop,
    paretoFinanceiroTop,
    paretoQuantidade,
    paretoRisco,
    paretoFinanceiro,
    saidasResumo,
    diasPeriodo,
  } = useDashboardEstoqueContext()
  const [forecastPayload, setForecastPayload] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(null)
  const [forecastFactor, setForecastFactor] = useState('')

  const loadForecast = async (params = {}) => {
    setForecastLoading(true)
    setForecastError(null)
    try {
      const data = await fetchEstoqueForecast(params)
      setForecastPayload(data || null)
      const fator = data?.resumo?.fator_tendencia
      if (fator !== undefined && fator !== null) {
        setForecastFactor(String(fator))
      }
    } catch (err) {
      setForecastError(err?.message || 'Erro ao carregar previsao de gasto.')
      setForecastPayload(null)
    } finally {
      setForecastLoading(false)
    }
  }

  useEffect(() => {
    loadForecast()
  }, [])

  const listaQuantidade = paretoQuantidade?.lista || []
  const totalItensQuantidade = listaQuantidade.length
  const totalSaidasQuantidade = Number(paretoQuantidade?.total || 0)
  const itensClasseAQuantidade = listaQuantidade.filter((item) => item.classe === 'A')
  const qtdItensClasseAQuantidade = itensClasseAQuantidade.length
  const qtdSaidaClasseAQuantidade = itensClasseAQuantidade.reduce((acc, item) => acc + Number(item.quantidade || 0), 0)
  const pctItensAQuantidade = totalItensQuantidade > 0 ? (qtdItensClasseAQuantidade / totalItensQuantidade) * 100 : 0
  const pctConsumoAQuantidade =
    totalSaidasQuantidade > 0 ? (qtdSaidaClasseAQuantidade / totalSaidasQuantidade) * 100 : 0

  const paretoQuantidadeValidation = {
    title: 'Validacao do Pareto 80/20 - Quantidade',
    lista: listaQuantidade,
    totalItens: totalItensQuantidade,
    totalSaidas: totalSaidasQuantidade,
    qtdItensClasseA: qtdItensClasseAQuantidade,
    qtdSaidaClasseA: qtdSaidaClasseAQuantidade,
    pctItensA: pctItensAQuantidade,
    pctConsumoA: pctConsumoAQuantidade,
    summary: (
      <>
        <div>
          <strong>Itens:</strong> {formatNumber(qtdItensClasseAQuantidade)} de {formatNumber(totalItensQuantidade)} (
          {formatPercent(pctItensAQuantidade, 0)})
        </div>
        <div>
          <strong>Consumo Classe A:</strong> {formatNumber(qtdSaidaClasseAQuantidade)} de{' '}
          {formatNumber(totalSaidasQuantidade)} ({formatPercent(pctConsumoAQuantidade, 0)})
        </div>
      </>
    ),
    columns: [
      'material_id',
      'material_nome',
      'qtd_saida_periodo',
      'qtd_total_periodo',
      'pct_individual',
      'pct_acumulado',
      'classe_abc',
    ],
    rowValues: (item, fmtNumber, fmtPercent) => [
      item.materialIdDisplay || item.materialId || item.id || '-',
      item.nome || item.descricao || '-',
      fmtNumber(item.quantidade),
      fmtNumber(totalSaidasQuantidade),
      fmtPercent(item.percentual, 2),
      fmtPercent(item.percentualAcumulado, 2),
      item.classe,
    ],
    rowMapper: (item, fmtNumber, fmtPercent) => (
      <>
        <td>{item.materialIdDisplay || item.materialId || item.id || '-'}</td>
        <td>{item.nome || item.descricao || '-'}</td>
        <td>{fmtNumber(item.quantidade)}</td>
        <td>{fmtNumber(totalSaidasQuantidade)}</td>
        <td>{fmtPercent(item.percentual, 2)}</td>
        <td>{fmtPercent(item.percentualAcumulado, 2)}</td>
        <td>{item.classe}</td>
      </>
    ),
  }

  const listaRisco = paretoRisco?.lista || []
  const diasPeriodoNumero = Math.max(1, Number(diasPeriodo || 0))
  const giroRiscoList = listaRisco.map((item) => Number(item.giroDiario || 0))
  const p80GiroRisco = computePercentile(giroRiscoList, 0.8)

  const paretoRiscoValidation = {
    title: 'Validacao do Pareto de score de risco',
    lista: listaRisco,
    columns: [
      'material_id',
      'material_nome',
      'qtd_saida_periodo',
      'dias_periodo',
      'giro_diario',
      'estoque_atual',
      'estoque_minimo',
      'pressao_vida_util',
      'flag_abaixo_minimo',
      'flag_giro_alto',
      'flag_excesso',
      'classe_risco_abc',
    ],
    rowValues: (item, fmtNumber) => {
      const estoqueAtual = Number(item.estoqueAtual || 0)
      const estoqueMinimo = Number(item.estoqueMinimo || 0)
      const giroDiario = Number(item.giroDiario || 0)
      const pressaoVidaUtil = Number(item.pressaoVidaUtil || 0)
      const flagAbaixoMinimo = estoqueAtual < estoqueMinimo
      const flagGiroAlto = giroDiario >= p80GiroRisco && p80GiroRisco > 0
      const flagExcesso = estoqueAtual > pressaoVidaUtil * 1.5
      return [
        item.materialIdDisplay || item.materialId || item.id || '-',
        item.nome || item.descricao || '-',
        fmtNumber(item.quantidade),
        fmtNumber(diasPeriodoNumero),
        formatNumber(giroDiario, 2),
        fmtNumber(estoqueAtual),
        fmtNumber(estoqueMinimo),
        formatNumber(pressaoVidaUtil, 2),
        flagAbaixoMinimo ? 'sim' : 'nao',
        flagGiroAlto ? 'sim' : 'nao',
        flagExcesso ? 'sim' : 'nao',
        item.classeRisco || item.classe,
      ]
    },
    rowMapper: (item, fmtNumber) => {
      const estoqueAtual = Number(item.estoqueAtual || 0)
      const estoqueMinimo = Number(item.estoqueMinimo || 0)
      const giroDiario = Number(item.giroDiario || 0)
      const pressaoVidaUtil = Number(item.pressaoVidaUtil || 0)
      const flagAbaixoMinimo = estoqueAtual < estoqueMinimo
      const flagGiroAlto = giroDiario >= p80GiroRisco && p80GiroRisco > 0
      const flagExcesso = estoqueAtual > pressaoVidaUtil * 1.5
      return (
        <>
          <td>{item.materialIdDisplay || item.materialId || item.id || '-'}</td>
          <td>{item.nome || item.descricao || '-'}</td>
          <td>{fmtNumber(item.quantidade)}</td>
          <td>{fmtNumber(diasPeriodoNumero)}</td>
          <td>{formatNumber(giroDiario, 2)}</td>
          <td>{fmtNumber(estoqueAtual)}</td>
          <td>{fmtNumber(estoqueMinimo)}</td>
          <td>{formatNumber(pressaoVidaUtil, 2)}</td>
          <td>{flagAbaixoMinimo ? 'sim' : 'nao'}</td>
          <td>{flagGiroAlto ? 'sim' : 'nao'}</td>
          <td>{flagExcesso ? 'sim' : 'nao'}</td>
          <td>{item.classeRisco || item.classe}</td>
        </>
      )
    },
  }

  const listaFinanceiro = paretoFinanceiro?.lista || []
  const totalValorFinanceiro = Number(paretoFinanceiro?.total || 0)

  const paretoFinanceiroValidation = {
    title: 'Validacao do Pareto financeiro - Saida por valor',
    lista: listaFinanceiro,
    columns: [
      'material_id',
      'material_nome',
      'qtd_saida_periodo',
      'valor_unitario',
      'valor_total_saida',
      'valor_total_periodo',
      'pct_individual',
      'pct_acumulado',
      'classe_abc_financeira',
    ],
    rowValues: (item, fmtNumber, fmtPercent) => {
      const qtdSaida = Number(item.quantidade || 0)
      const valorUnitario = Number(item.valorUnitario || 0)
      const valorTotalSaida = Number(item.valorTotal || qtdSaida * valorUnitario || 0)
      return [
        item.materialIdDisplay || item.materialId || item.id || '-',
        item.nome || item.descricao || '-',
        fmtNumber(qtdSaida),
        formatCurrency(valorUnitario),
        formatCurrency(valorTotalSaida),
        formatCurrency(totalValorFinanceiro),
        fmtPercent(item.percentual, 2),
        fmtPercent(item.percentualAcumulado, 2),
        item.classe,
      ]
    },
    rowMapper: (item, fmtNumber, fmtPercent) => {
      const qtdSaida = Number(item.quantidade || 0)
      const valorUnitario = Number(item.valorUnitario || 0)
      const valorTotalSaida = Number(item.valorTotal || qtdSaida * valorUnitario || 0)
      return (
        <>
          <td>{item.materialIdDisplay || item.materialId || item.id || '-'}</td>
          <td>{item.nome || item.descricao || '-'}</td>
          <td>{fmtNumber(qtdSaida)}</td>
          <td>{formatCurrency(valorUnitario)}</td>
          <td>{formatCurrency(valorTotalSaida)}</td>
          <td>{formatCurrency(totalValorFinanceiro)}</td>
          <td>{fmtPercent(item.percentual, 2)}</td>
          <td>{fmtPercent(item.percentualAcumulado, 2)}</td>
          <td>{item.classe}</td>
        </>
      )
    },
  }

  const formatList = (items = [], maxItems = 3) => {
    const list = items.filter(Boolean).slice(0, maxItems)
    return list.length ? list : []
  }

  const nomesPorQuantidade = (paretoQuantidade?.lista || []).map((item) => item.nome).filter(Boolean)
  const top5Quantidade = formatList(nomesPorQuantidade, 5)
  const top3Quantidade = formatList(nomesPorQuantidade, 3)

  const riscoCriticos = (paretoRisco?.lista || []).filter(
    (item) => (item.classeRisco || item.classe) === 'A',
  )
  const top5Criticos = formatList(riscoCriticos.map((item) => item.nome).filter(Boolean), 5)
  const top3Criticos = formatList(riscoCriticos.map((item) => item.nome).filter(Boolean), 3)

  const valorUnitarios = (saidasResumo || []).map((item) => item.valorUnitario).filter((value) => Number(value) > 0)
  const dias = Math.max(1, Number(diasPeriodo || 0))
  const giroDiarioList = (saidasResumo || []).map((item) => (Number(item.quantidade || 0) / dias) || 0)
  const p80ValorUnitario = computePercentile(valorUnitarios, 0.8)
  const p20Giro = computePercentile(giroDiarioList, 0.2)

  const altoValorAltoGiro = []
  const altoValorBaixoGiro = []
  ;(saidasResumo || []).forEach((item) => {
    const giroDiario = Number(item.quantidade || 0) / dias
    const nome = item.nome || item.descricao || item.descricaoCompleta
    if (!nome) return
    const isAltoValor = Number(item.valorUnitario || 0) >= p80ValorUnitario
    if (!isAltoValor) return
    if (giroDiario <= p20Giro) {
      altoValorBaixoGiro.push(nome)
    } else {
      altoValorAltoGiro.push(nome)
    }
  })

  const top3AltoValorAltoGiro = formatList(altoValorAltoGiro, 3)
  const top3AltoValorBaixoGiro = formatList(altoValorBaixoGiro, 3)

  const forecastStatus = forecastPayload?.status || null
  const forecastHasData = forecastStatus === 'ok'
  const forecastBase = forecastPayload?.resumo || null
  const historicoSerie = forecastPayload?.historico || []
  const previsaoSerie = forecastPayload?.previsao || []
  const forecastCalcLocked = forecastStatus === 'ok'

  const chartForecastData = useMemo(() => {
    if (!forecastHasData) {
      return []
    }
    const historicoData = historicoSerie.map((item) => ({
      label: item.label,
      historico: item.valor_saida,
      mediaMovel: item.media_movel,
    }))
    const previsaoData = previsaoSerie.map((item) => ({
      label: item.label,
      previsao: item.valor_previsto,
    }))
    return [...historicoData, ...previsaoData]
  }, [forecastHasData, historicoSerie, previsaoSerie])

  const handleForecastUpdate = async () => {
    const parsed = Number(String(forecastFactor).replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setForecastError('Informe um fator valido (ex: 1.05).')
      return
    }
    setForecastLoading(true)
    setForecastError(null)
    try {
      const data = await updateEstoqueForecast({ fator_tendencia: parsed })
      setForecastPayload(data || null)
      const fator = data?.resumo?.fator_tendencia
      if (fator !== undefined && fator !== null) {
        setForecastFactor(String(fator))
      }
    } catch (err) {
      setForecastError(err?.message || 'Erro ao atualizar previsao de gasto.')
    } finally {
      setForecastLoading(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<DashboardIcon size={28} />}
        title="Analise de Estoque"
        subtitle="Aprofunde a leitura dos Paretos e priorize acoes de estoque."
        actions={<HelpButton topic="analiseEstoque" />}
      />
      <FiltersForm />
      <AnaliseCards />
      <section className="card analysis-forecast-section">
        <header className="card__header dashboard-card__header">
          <div className="dashboard-card__title-group">
            <button type="button" className="summary-tooltip dashboard-card__info" aria-label="Informacoes de previsao">
              <InfoIcon size={14} />
              <span>
                Previsao baseada no consumo medio dos ultimos 12 meses. O fator de tendencia ajusta a projecao.
              </span>
            </button>
            <h2 className="dashboard-card__title">
              <RevenueIcon size={20} /> <span>Previsao de gasto anual (12 meses)</span>
            </h2>
          </div>
        </header>
        <div className="analysis-forecast-grid">
          <div className="analysis-forecast-card">
            {forecastLoading ? (
              <p>Carregando previsao...</p>
            ) : forecastError ? (
              <p className="analysis-forecast-error">{forecastError}</p>
            ) : forecastStatus === 'insufficient' ? (
              <p>
                Historico insuficiente ({forecastPayload?.monthsAvailable || 0}/
                {forecastPayload?.requiredMonths || 12} meses).
              </p>
            ) : forecastStatus === 'missing' ? (
              <p>Previsao ainda nao calculada para este periodo.</p>
            ) : (
              <>
                <p className="analysis-forecast-label">Previsao de gasto anual (12 meses)</p>
                <p className="analysis-forecast-value">{formatCurrency(forecastBase?.previsao_anual || 0)}</p>
                <p className="analysis-forecast-subtitle">Baseado no consumo medio dos ultimos 12 meses</p>
                <div className="analysis-forecast-meta">
                  <span>
                    Variacao vs ano anterior:{' '}
                    {forecastBase?.variacao_percentual !== null && forecastBase?.variacao_percentual !== undefined
                      ? `${forecastBase.variacao_percentual > 0 ? '+' : ''}${formatNumber(
                          forecastBase.variacao_percentual,
                          1,
                        )}%`
                      : 'Sem base anterior'}
                  </span>
                  <span>
                    Confianca do dado: {forecastBase?.qtd_meses_base || 12} meses
                  </span>
                </div>
              </>
            )}
            <div className="analysis-forecast-actions">
              <label className="field">
                <span>Fator de tendencia</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={forecastFactor}
                  onChange={(event) => setForecastFactor(event.target.value)}
                  placeholder="1.00"
                />
              </label>
              <button
                type="button"
                className="button button--primary"
                onClick={handleForecastUpdate}
                disabled={forecastLoading || forecastCalcLocked}
              >
                {forecastCalcLocked ? 'Previsao ja calculada' : 'Calcular previsao'}
              </button>
            </div>
          </div>
          <div className="analysis-forecast-chart">
            <ForecastGastoChart data={chartForecastData} valueFormatter={formatCurrency} height={320} />
          </div>
        </div>
      </section>
      <div className="analysis-pareto-list">
        <ParetoSection
          title="Pareto 80/20 - Saida por quantidade"
          icon={TrendIcon}
          data={paretoQuantidadeTop}
          valueKey="quantidade"
          valueLabel="Quantidade saidas"
          valueFormatter={formatNumber}
          palette="pareto"
          showValidation
          validationData={paretoQuantidadeValidation}
          info={{
            title: 'Pareto 80/20 - Saida por quantidade',
            question: 'O que mais sai fisicamente?',
            tooltip: 'Responde: o que mais sai fisicamente? Onde controlar reposicao e padronizacao. Mostra concentracao 80/20 e classe ABC.',
            summary: '',
            lists: [
              {
                title: 'Itens mais criticos no periodo TOP 5',
                items: top5Quantidade,
              },
            ],
            actions: [
              {
                title: 'Revisar estoque minimo TOP 3',
                items: top3Quantidade,
              },
              {
                title: 'Priorizar controle de estoque TOP 3',
                items: top3Quantidade,
              },
            ],
          }}
        />
        <ParetoSection
          title="Pareto de score de risco"
          icon={AlertIcon}
          data={paretoRiscoTop}
          valueKey="score"
          valueLabel="Quantidade saidas"
          valueFormatter={formatNumber}
          palette="risk"
          legendLabels={{ A: 'Score alto', B: 'Score medio', C: 'Score baixo' }}
          showValidation
          validationData={paretoRiscoValidation}
          info={{
            title: 'Pareto de score de risco',
            question: 'O que nao pode faltar de jeito nenhum?',
            tooltip:
              'Responde: o que nao pode faltar de jeito nenhum? Onde negociar preco/substituicao/auditar uso. Ordena pelo score (alto para baixo) e colore por score.',
            summary: '',
            lists: [
              {
                title: 'Criticos prioritarios TOP 5',
                items: top5Criticos,
              },
            ],
            actions: [
              {
                title: 'Compra imediata TOP 3',
                items: top3Criticos,
              },
              {
                title: 'Revisar minimo / lead time TOP 3',
                items: top3Criticos,
              },
            ],
          }}
        />
        <ParetoSection
          title="Pareto financeiro - Saida por valor"
          icon={RevenueIcon}
          data={paretoFinanceiroTop}
          valueKey="valorTotal"
          valueLabel="Valor saidas"
          valueFormatter={formatCurrency}
          palette="pareto"
          showValidation
          validationData={paretoFinanceiroValidation}
          info={{
            title: 'Pareto financeiro - Saida por valor',
            question: 'O que doi mais no caixa?',
            tooltip: 'Responde: o que doi mais no caixa? Onde evitar ruptura (minimo/cobertura/lead time). Mostra concentracao de valor e classe ABC.',
            summary: '',
            lists: [
              {
                title: 'Alto valor + alto giro (controle rigido) TOP 3',
                items: top3AltoValorAltoGiro,
              },
              {
                title: 'Alto valor + baixo giro (reduzir compras) TOP 3',
                items: top3AltoValorBaixoGiro,
              },
            ],
            actions: [
              {
                title: '',
                items: ['Revisar compra', 'Substituicao de material', 'Padronizacao', 'Auditoria de uso'],
              },
            ],
          }}
        />
      </div>
    </div>
  )
}

export function AnaliseEstoqueProviderPage() {
  return (
    <DashboardEstoqueProvider>
      <AnaliseEstoquePage />
    </DashboardEstoqueProvider>
  )
}


