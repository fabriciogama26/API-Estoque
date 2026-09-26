import { useEffect, useState } from 'react'
import { SaveIcon } from '../icons.jsx'
import { formatCurrency, formatNumber } from '../../utils/inventoryReportUtils.js'
import { simularModoPolitica, updatePoliticaReposicao } from '../../services/reposicaoApi.js'
import { downloadSimulacaoModoCsv, formatSituacaoReposicao } from '../../utils/reposicaoUtils.js'

const MODO_LABELS = { monitorar: 'Monitorar', automatico: 'Automatico' }

const LINHAS_RESUMO = [
  { key: 'valor_compra_sugerida', label: 'Compra recomendada (R$)', moeda: true },
  { key: 'itens_com_compra', label: 'Materiais com compra' },
  { key: 'ruptura_atual', label: 'Ruptura (P0)' },
  { key: 'reposicao_necessaria', label: 'Reposicao necessaria (P1)' },
  { key: 'reposicao_programada', label: 'Reposicao programada (P2)' },
  { key: 'acima_do_alvo', label: 'Acima do alvo' },
  { key: 'sem_consumo_recente', label: 'Sem consumo recente' },
  { key: 'sem_base_para_calculo', label: 'Sem base para calculo' },
]

function formatResumoValor(value, moeda) {
  const number = Number(value || 0)
  return moeda ? formatCurrency(number) : formatNumber(number)
}

// Troca de modo da politica. Ativar o Automatico exige simulacao revisada e motivo; voltar ao Monitorar exige motivo.
export function ReposicaoModoPanel({ ownerId, politica, podeEditar, onChanged, reportError, resolveNome }) {
  const modoAtual = politica?.modo === 'automatico' ? 'automatico' : 'monitorar'
  const modoAlvo = modoAtual === 'automatico' ? 'monitorar' : 'automatico'
  const liberado = Boolean(politica?.modo_automatico_liberado)
  const [simulacao, setSimulacao] = useState(null)
  const [simulando, setSimulando] = useState(false)
  const [revisado, setRevisado] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSimulacao(null)
    setRevisado(false)
    setMotivo('')
    setError(null)
  }, [modoAtual])

  const handleSimular = async () => {
    setError(null)
    setSimulando(true)
    try {
      const data = await simularModoPolitica(ownerId, modoAlvo)
      setSimulacao(data)
      setRevisado(false)
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'politica_reposicao_simulacao', modo: modoAlvo })
    } finally {
      setSimulando(false)
    }
  }

  const exigeSimulacao = modoAlvo === 'automatico'
  const simulacaoValida = !exigeSimulacao || (simulacao?.modo_simulado === modoAlvo && revisado)

  const handleTrocarModo = async () => {
    setError(null)
    if (!simulacaoValida) {
      setError('Simule o impacto e confirme a revisao antes de ativar o modo Automatico.')
      return
    }
    if (motivo.trim().length < 3) {
      setError('Informe o motivo da troca de modo.')
      return
    }
    setSaving(true)
    try {
      const saved = await updatePoliticaReposicao(ownerId, { modo: modoAlvo }, motivo.trim())
      onChanged?.(saved)
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'politica_reposicao_modo', modo: modoAlvo })
    } finally {
      setSaving(false)
    }
  }

  const mudancas = Array.isArray(simulacao?.mudancas) ? simulacao.mudancas : []

  return (
    <section className="reposicao-modo-panel">
      <p className="analysis-forecast-label">Modo de operacao</p>
      <p className="analysis-forecast-subtitle">
        Atual: <strong>{MODO_LABELS[modoAtual]}</strong>.{' '}
        {modoAtual === 'automatico'
          ? 'O minimo sugerido pelo consumo prevalece; o minimo cadastrado so vale para itens sem historico; overrides continuam acima de tudo. Alertas usam o minimo efetivo.'
          : 'O minimo cadastrado vale onde existe; alertas usam o minimo cadastrado. No Automatico, o minimo sugerido pelo consumo passa a prevalecer.'}
      </p>

      {!podeEditar ? (
        <p className="feedback feedback--warning">Somente leitura. Trocar o modo exige a permissao "Politica de reposicao".</p>
      ) : !liberado && modoAlvo === 'automatico' ? (
        <p className="feedback feedback--warning">O modo Automatico ainda nao esta liberado neste banco.</p>
      ) : (
        <>
          <div className="analysis-audit-actions">
            <button type="button" className="button button--ghost" onClick={handleSimular} disabled={simulando || saving}>
              {simulando ? 'Simulando...' : `Simular impacto do modo ${MODO_LABELS[modoAlvo]}`}
            </button>
            {mudancas.length ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={() =>
                  downloadSimulacaoModoCsv(mudancas, {
                    modoAtual: MODO_LABELS[simulacao.modo_atual] || simulacao.modo_atual,
                    modoSimulado: simulacao.modo_simulado,
                    resolveNome,
                  })
                }
              >
                <SaveIcon size={16} aria-hidden="true" />
                <span>Exportar mudancas (CSV)</span>
              </button>
            ) : null}
          </div>

          {simulacao ? (
            <div className="reposicao-modo-simulacao">
              <div className="table-wrapper">
                <table className="data-table analysis-audit-table">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>{MODO_LABELS[simulacao.modo_atual] || simulacao.modo_atual} (hoje)</th>
                      <th>{MODO_LABELS[simulacao.modo_simulado]} (simulado)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINHAS_RESUMO.map((linha) => (
                      <tr key={linha.key}>
                        <td>{linha.label}</td>
                        <td>{formatResumoValor(simulacao.resumo_atual?.[linha.key], linha.moeda)}</td>
                        <td>{formatResumoValor(simulacao.resumo_simulado?.[linha.key], linha.moeda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="analysis-forecast-subtitle">
                {formatNumber(mudancas.length)} materiais mudam de limite, situacao ou compra.
                {mudancas.length
                  ? ' Maiores impactos em valor: ' +
                    mudancas
                      .slice(0, 3)
                      .map(
                        (item) =>
                          `${resolveNome ? resolveNome(item) : item.nome} (${formatSituacaoReposicao(item.antes?.situacao)} -> ${formatSituacaoReposicao(item.depois?.situacao)}, ${formatCurrency(Number(item.diferenca_valor || 0))})`,
                      )
                      .join('; ') +
                    '.'
                  : ''}
              </p>
              {exigeSimulacao ? (
                <label className="reposicao-modo-confirmacao">
                  <input type="checkbox" checked={revisado} onChange={(event) => setRevisado(event.target.checked)} />
                  <span>Revisei o impacto acima e quero ativar o modo Automatico.</span>
                </label>
              ) : null}
            </div>
          ) : null}

          <label className="field">
            <span>Motivo da troca de modo</span>
            <input
              type="text"
              value={motivo}
              maxLength={300}
              disabled={saving}
              placeholder={modoAlvo === 'automatico' ? 'Ex.: minimos cadastrados desatualizados' : 'Ex.: revisar resultados do automatico'}
              onChange={(event) => setMotivo(event.target.value)}
            />
          </label>
          <div className="analysis-audit-actions">
            <button
              type="button"
              className={modoAlvo === 'automatico' ? 'button button--primary' : 'button button--ghost'}
              onClick={handleTrocarModo}
              disabled={saving || !simulacaoValida}
            >
              {saving
                ? 'Salvando...'
                : modoAlvo === 'automatico'
                  ? 'Ativar modo Automatico'
                  : 'Voltar para o modo Monitorar'}
            </button>
          </div>
        </>
      )}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
    </section>
  )
}
