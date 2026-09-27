import { useEffect, useState } from 'react'
import { ChartExpandModal } from '../Dashboard/ChartExpandModal.jsx'
import { SaveIcon } from '../icons.jsx'
import { revokeOverrideReposicao, setOverrideReposicao } from '../../services/reposicaoApi.js'
import { formatFonteRegra, formatQuantidadeOuNaoCalculavel } from '../../utils/reposicaoUtils.js'

function addDaysIso(days) {
  const date = new Date()
  date.setDate(date.getDate() + Number(days || 90))
  return date.toISOString().slice(0, 10)
}

function parseInteiroOpcional(value, label) {
  const raw = String(value ?? '').trim()
  if (!raw) return { value: null }
  const number = Number(raw.replace(',', '.'))
  if (!Number.isInteger(number) || number < 0) {
    return { error: `${label} deve ser um numero inteiro maior ou igual a zero.` }
  }
  return { value: number }
}

export function ReposicaoOverrideModal({ open, ownerId, item, materialNome, validadePadraoDias, onClose, onSaved, reportError }) {
  const [minimo, setMinimo] = useState('')
  const [maximo, setMaximo] = useState('')
  const [expiraEm, setExpiraEm] = useState('')
  const [motivo, setMotivo] = useState('')
  const [motivoRevogacao, setMotivoRevogacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !item) return
    setMinimo(item.minimo_automatico ?? '')
    setMaximo(item.maximo_automatico ?? '')
    setExpiraEm(addDaysIso(validadePadraoDias || 90))
    setMotivo('')
    setMotivoRevogacao('')
    setError(null)
  }, [open, item, validadePadraoDias])

  if (!item) return null

  const override = item.override || null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const min = parseInteiroOpcional(minimo, 'Minimo')
    const max = parseInteiroOpcional(maximo, 'Maximo')
    if (min.error || max.error) {
      setError(min.error || max.error)
      return
    }
    if (min.value === null && max.value === null) {
      setError('Informe o minimo e/ou o maximo do override.')
      return
    }
    if (min.value !== null && max.value !== null && max.value < min.value) {
      setError('O maximo deve ser maior ou igual ao minimo.')
      return
    }
    if (motivo.trim().length < 3) {
      setError('Informe o motivo do override.')
      return
    }
    if (!expiraEm) {
      setError('Informe a data de expiracao.')
      return
    }
    const expira = new Date(`${expiraEm}T23:59:59`)
    if (Number.isNaN(expira.getTime()) || expira <= new Date()) {
      setError('A expiracao deve ser uma data futura.')
      return
    }
    setSaving(true)
    try {
      await setOverrideReposicao(ownerId, {
        materialId: item.material_id,
        minimo: min.value,
        maximo: max.value,
        motivo: motivo.trim(),
        expiraEm: expira.toISOString(),
      })
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'override_reposicao_set', materialId: item.material_id })
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async () => {
    if (!override?.id) return
    setError(null)
    if (motivoRevogacao.trim().length < 3) {
      setError('Informe o motivo da revogacao.')
      return
    }
    setSaving(true)
    try {
      await revokeOverrideReposicao(ownerId, override.id, motivoRevogacao.trim())
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'override_reposicao_revoke', overrideId: override.id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ChartExpandModal open={open} title={`Override - ${materialNome}`} onClose={onClose}>
      <div className="analysis-audit-summary">
        <p>
          Minimo cadastrado: <strong>{formatQuantidadeOuNaoCalculavel(item.minimo_manual)}</strong>
          {' | '}Sugerido: <strong>{formatQuantidadeOuNaoCalculavel(item.minimo_automatico)}</strong> a{' '}
          <strong>{formatQuantidadeOuNaoCalculavel(item.maximo_automatico)}</strong>
          {' | '}Regra atual: <strong>{formatFonteRegra(item.fonte_regra)}</strong>
        </p>
        <span>
          O override substitui minimo/maximo efetivos ate expirar. O minimo cadastrado do material nao e alterado.
          Um novo override encerra o anterior.
        </span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="reposicao-politica-grid">
          <label className="field">
            <span>Minimo (inteiro)</span>
            <input type="number" min="0" step="1" value={minimo} disabled={saving} onChange={(event) => setMinimo(event.target.value)} />
          </label>
          <label className="field">
            <span>Maximo (inteiro)</span>
            <input type="number" min="0" step="1" value={maximo} disabled={saving} onChange={(event) => setMaximo(event.target.value)} />
          </label>
          <label className="field">
            <span>Expira em</span>
            <input type="date" value={expiraEm} disabled={saving} onChange={(event) => setExpiraEm(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Motivo</span>
          <input
            type="text"
            value={motivo}
            maxLength={300}
            disabled={saving}
            placeholder="Ex.: item de uso raro, manter 2 unidades"
            onChange={(event) => setMotivo(event.target.value)}
          />
        </label>
        <div className="analysis-audit-actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            <SaveIcon size={16} aria-hidden="true" />
            <span>{saving ? 'Salvando...' : override ? 'Substituir override' : 'Criar override'}</span>
          </button>
        </div>
      </form>
      {override ? (
        <div className="reposicao-override-ativo">
          <p className="analysis-forecast-label">Override ativo</p>
          <p className="analysis-forecast-subtitle">
            Minimo {formatQuantidadeOuNaoCalculavel(override.minimo)} | Maximo {formatQuantidadeOuNaoCalculavel(override.maximo)}
            {' | '}Expira em {String(override.expira_em || '').slice(0, 10)} | Motivo: {override.motivo}
          </p>
          <label className="field">
            <span>Motivo da revogacao</span>
            <input
              type="text"
              value={motivoRevogacao}
              maxLength={300}
              disabled={saving}
              onChange={(event) => setMotivoRevogacao(event.target.value)}
            />
          </label>
          <div className="analysis-audit-actions">
            <button type="button" className="button button--danger" disabled={saving} onClick={handleRevoke}>
              Revogar override
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
    </ChartExpandModal>
  )
}
