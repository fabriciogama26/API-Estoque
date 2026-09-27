import { useEffect, useState } from 'react'
import { ChartExpandModal } from '../Dashboard/ChartExpandModal.jsx'
import { SaveIcon } from '../icons.jsx'
import { updateEstoqueMinimoCadastrado } from '../../services/reposicaoApi.js'
import { formatBaseCalculo, formatQuantidadeOuNaoCalculavel, toNumberOrNull } from '../../utils/reposicaoUtils.js'

// Sugestao inicial: sem consumo na janela -> 0; senao, o minimo sugerido pelo consumo.
function valorInicial(item) {
  if (item?.situacao === 'sem_consumo_recente') return '0'
  const sugerido = toNumberOrNull(item?.minimo_automatico)
  if (sugerido !== null) return String(sugerido)
  const cadastrado = toNumberOrNull(item?.minimo_manual)
  return cadastrado !== null ? String(cadastrado) : '0'
}

export function ReposicaoMinimoModal({ open, item, materialNome, onClose, onSaved, reportError }) {
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !item) return
    setValor(valorInicial(item))
    setMotivo('')
    setError(null)
  }, [open, item])

  if (!item) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    const parsed = Number(String(valor).trim())
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Informe um numero inteiro maior ou igual a zero.')
      return
    }
    if (motivo.trim().length < 3) {
      setError('Informe o motivo da alteracao.')
      return
    }
    setSaving(true)
    try {
      await updateEstoqueMinimoCadastrado(item.material_id, parsed, motivo.trim())
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message)
      reportError?.(err, { area: 'minimo_cadastrado_update', materialId: item.material_id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ChartExpandModal open={open} title={`Minimo cadastrado - ${materialNome}`} onClose={onClose}>
      <div className="analysis-audit-summary">
        <p>
          Cadastrado hoje:{' '}
          <strong>{toNumberOrNull(item.minimo_manual) === null ? 'Nao cadastrado' : formatQuantidadeOuNaoCalculavel(item.minimo_manual)}</strong>
          {' | '}Sugerido: <strong>{formatQuantidadeOuNaoCalculavel(item.minimo_automatico)}</strong>
          {' | '}Base: <strong>{formatBaseCalculo(item.base_calculo)}</strong>
        </p>
        <span>
          Altera o minimo do cadastro do material (vale tambem para Estoque atual e alertas). Use 0 para deixar o
          material sem minimo cadastrado; para um ajuste temporario, prefira um override.
        </span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="reposicao-politica-grid">
          <label className="field">
            <span>Novo minimo cadastrado</span>
            <input type="number" min="0" step="1" value={valor} disabled={saving} onChange={(event) => setValor(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Motivo</span>
          <input
            type="text"
            maxLength={300}
            value={motivo}
            disabled={saving}
            placeholder="Ex.: sem uso ha 6 meses, deixar sem minimo"
            onChange={(event) => setMotivo(event.target.value)}
          />
        </label>
        <div className="analysis-audit-actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            <SaveIcon size={16} aria-hidden="true" />
            <span>{saving ? 'Salvando...' : 'Salvar minimo cadastrado'}</span>
          </button>
        </div>
      </form>
      {error ? <p className="feedback feedback--error">{error}</p> : null}
    </ChartExpandModal>
  )
}
