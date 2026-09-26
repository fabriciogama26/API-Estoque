import { useEffect, useState } from 'react'
import { ChartExpandModal } from '../Dashboard/ChartExpandModal.jsx'
import { SaveIcon } from '../icons.jsx'
import {
  fetchPoliticaReposicao,
  fetchPoliticaReposicaoHistorico,
  updatePoliticaReposicao,
} from '../../services/reposicaoApi.js'

const CAMPOS = [
  {
    key: 'cobertura_minima_meses',
    label: 'Cobertura minima (meses)',
    hint: 'Minimo sugerido = consumo medio mensal x este valor.',
    step: '0.5',
    min: '0.5',
  },
  {
    key: 'cobertura_alvo_meses',
    label: 'Cobertura alvo / maximo (meses)',
    hint: 'Ate onde a compra repoe. Deve ser maior ou igual a minima.',
    step: '0.5',
    min: '0.5',
  },
  {
    key: 'cobertura_excesso_meses',
    label: 'Excesso a partir de (meses)',
    hint: 'Cobertura acima deste valor vai para "Acima do alvo".',
    step: '0.5',
    min: '1',
  },
  {
    key: 'janela_sem_consumo_dias',
    label: 'Janela sem consumo (dias)',
    hint: 'Minimo cadastrado sem saida neste periodo vai para revisao, fora da compra. Entre 30 e 1095.',
    step: '1',
    min: '30',
  },
  {
    key: 'override_validade_dias',
    label: 'Validade padrao do override (dias)',
    hint: 'Aplicada quando o override nao informa data de expiracao.',
    step: '1',
    min: '1',
  },
  {
    key: 'divergencia_tolerancia_pct',
    label: 'Tolerancia de divergencia (%)',
    hint: 'Minimo cadastrado alem desta diferenca do sugerido recebe aviso.',
    step: '1',
    min: '1',
  },
]

const HISTORICO_ACOES = { criado: 'Criado', alterado: 'Alterado', revogado: 'Revogado' }

const HISTORICO_ENTIDADES = {
  politica: 'Politica',
  override: 'Override de material',
  minimo_cadastrado: 'Minimo cadastrado de material',
}

function formatDataHora(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toForm(politica) {
  return Object.fromEntries(CAMPOS.map(({ key }) => [key, politica?.[key] ?? '']))
}

export function ReposicaoPoliticaModal({ open, ownerId, onClose, onSaved, reportError }) {
  const [politica, setPolitica] = useState(null)
  const [historico, setHistorico] = useState([])
  const [form, setForm] = useState(() => toForm(null))
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!open || !ownerId) return undefined
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const [politicaData, historicoData] = await Promise.all([
          fetchPoliticaReposicao(ownerId),
          fetchPoliticaReposicaoHistorico(ownerId, 30),
        ])
        if (cancelled) return
        setPolitica(politicaData)
        setForm(toForm(politicaData))
        setHistorico(Array.isArray(historicoData) ? historicoData : [])
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        reportError?.(err, { area: 'politica_reposicao_leitura' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, ownerId, reportError])

  const podeEditar = Boolean(politica?.pode_editar)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!podeEditar) return
    setError(null)
    setSuccess(null)
    if (motivo.trim().length < 3) {
      setError('Informe o motivo da alteracao.')
      return
    }
    const payload = {}
    for (const { key, label } of CAMPOS) {
      const value = Number(String(form[key]).replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) {
        setError(`Valor invalido em "${label}".`)
        return
      }
      payload[key] = value
    }
    if (payload.cobertura_alvo_meses < payload.cobertura_minima_meses) {
      setError('A cobertura alvo deve ser maior ou igual a cobertura minima.')
      return
    }
    if (payload.cobertura_excesso_meses < payload.cobertura_alvo_meses) {
      setError('O limite de excesso deve ser maior ou igual a cobertura alvo.')
      return
    }
    if (payload.janela_sem_consumo_dias < 30 || payload.janela_sem_consumo_dias > 1095) {
      setError('A janela sem consumo deve ficar entre 30 e 1095 dias.')
      return
    }
    payload.janela_sem_consumo_dias = Math.round(payload.janela_sem_consumo_dias)
    payload.override_validade_dias = Math.round(payload.override_validade_dias)

    setSaving(true)
    try {
      const saved = await updatePoliticaReposicao(ownerId, payload, motivo.trim())
      setPolitica(saved)
      setForm(toForm(saved))
      setMotivo('')
      setSuccess('Politica salva. A reposicao foi recalculada.')
      const historicoData = await fetchPoliticaReposicaoHistorico(ownerId, 30)
      setHistorico(Array.isArray(historicoData) ? historicoData : [])
      onSaved?.()
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'politica_reposicao_update', payload })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ChartExpandModal open={open} title="Politica de reposicao" onClose={onClose}>
      {loading ? <p className="analysis-forecast-subtitle">Carregando politica...</p> : null}
      {!loading && politica ? (
        <form className="reposicao-politica-form" onSubmit={handleSubmit}>
          <div className="analysis-audit-summary">
            <p>
              Modo: <strong>{politica.modo === 'automatico' ? 'Automatico' : 'Monitorar'}</strong>
              {' | '}Versao {politica.versao || 0}
              {politica.updated_at ? ` | Atualizada em ${formatDataHora(politica.updated_at)}` : ' | Valores padrao'}
            </p>
            <span>
              No modo Monitorar o minimo cadastrado continua valendo onde existe; sem minimo cadastrado, vale o minimo
              sugerido pelo consumo. O modo Automatico sera liberado apos a validacao com dados reais.
            </span>
          </div>
          <div className="reposicao-politica-grid">
            {CAMPOS.map((campo) => (
              <label className="field" key={campo.key}>
                <span>{campo.label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={campo.step}
                  min={campo.min}
                  value={form[campo.key]}
                  disabled={!podeEditar || saving}
                  onChange={(event) => setForm((prev) => ({ ...prev, [campo.key]: event.target.value }))}
                />
                <small className="field__hint">{campo.hint}</small>
              </label>
            ))}
          </div>
          {podeEditar ? (
            <>
              <label className="field">
                <span>Motivo da alteracao</span>
                <input
                  type="text"
                  value={motivo}
                  maxLength={300}
                  disabled={saving}
                  placeholder="Ex.: fornecedor passou a entregar em 45 dias"
                  onChange={(event) => setMotivo(event.target.value)}
                />
              </label>
              <div className="analysis-audit-actions">
                <button type="submit" className="button button--primary" disabled={saving}>
                  <SaveIcon size={16} aria-hidden="true" />
                  <span>{saving ? 'Salvando...' : 'Salvar politica'}</span>
                </button>
              </div>
            </>
          ) : (
            <p className="feedback feedback--warning">
              Somente leitura. Alterar a politica exige a permissao "Politica de reposicao".
            </p>
          )}
        </form>
      ) : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      {success ? <p className="feedback feedback--success">{success}</p> : null}
      {!loading && historico.length ? (
        <div className="reposicao-politica-historico">
          <p className="analysis-forecast-label">Historico de alteracoes</p>
          <div className="table-wrapper">
            <table className="data-table analysis-audit-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Item</th>
                  <th>Acao</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDataHora(row.criado_em)}</td>
                    <td>{HISTORICO_ENTIDADES[row.entidade] || row.entidade}</td>
                    <td>{HISTORICO_ACOES[row.acao] || row.acao}</td>
                    <td>{row.motivo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </ChartExpandModal>
  )
}
