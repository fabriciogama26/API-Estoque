import { useEffect, useMemo, useState } from 'react'
import { CancelIcon } from '../../icons.jsx'
import {
  getCorrectionBalance,
  listCorrectionOptions,
  requestStockCorrection,
} from '../../../services/stockCorrectionsApi.js'

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function EstoqueCorrectionModal({ open, item, onClose, onSubmitted }) {
  const [centers, setCenters] = useState([])
  const [stockCenterId, setStockCenterId] = useState('')
  const [physicalQuantity, setPhysicalQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [balance, setBalance] = useState(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setStockCenterId('')
    setPhysicalQuantity('')
    setNotes('')
    setBalance(null)
    setError(null)
    setSuccess(false)
    listCorrectionOptions()
      .then(({ centers: availableCenters }) => {
        const itemCenterIds = new Set(
          (item?.centrosEstoqueDetalhes || []).filter((center) => center.id).map((center) => String(center.id)),
        )
        const relevantCenters = itemCenterIds.size
          ? availableCenters.filter((center) => itemCenterIds.has(String(center.id)))
          : availableCenters
        setCenters(relevantCenters)
        if (relevantCenters.length === 1) setStockCenterId(relevantCenters[0].id)
      })
      .catch((loadError) => setError(loadError.message))
  }, [open, item?.materialId, item?.centrosEstoqueDetalhes])

  useEffect(() => {
    if (!open || !item?.materialId || !stockCenterId) {
      setBalance(null)
      return
    }
    let active = true
    setLoadingBalance(true)
    setError(null)
    getCorrectionBalance(item.materialId, stockCenterId)
      .then((value) => { if (active) setBalance(Number(value)) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoadingBalance(false) })
    return () => { active = false }
  }, [item?.materialId, open, stockCenterId])

  const difference = useMemo(() => {
    if (balance === null || physicalQuantity === '') return null
    const physical = Number(physicalQuantity)
    return Number.isFinite(physical) ? physical - balance : null
  }, [balance, physicalQuantity])
  const duplicateCenterNames = useMemo(() => new Set(
    centers
      .filter((center, index) => centers.some((other, otherIndex) => otherIndex !== index && other.almox === center.almox))
      .map((center) => center.almox),
  ), [centers])
  const saldoPorCentro = useMemo(() => new Map(
    (item?.centrosEstoqueDetalhes || [])
      .filter((center) => center.id && typeof center.saldo === 'number')
      .map((center) => [String(center.id), center.saldo]),
  ), [item?.centrosEstoqueDetalhes])

  if (!open || !item) return null

  const close = () => {
    if (!saving) onClose?.()
  }

  const submit = async (event) => {
    event.preventDefault()
    const physical = Number(physicalQuantity)
    if (!stockCenterId || !Number.isFinite(physical) || physical < 0) {
      setError('Selecione o centro e informe uma quantidade física válida.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await requestStockCorrection({
        materialId: item.materialId,
        stockCenterId,
        physicalQuantity: physical,
        notes: notes.trim(),
      })
      setSuccess(true)
      await onSubmitted?.()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="estoque-min-stock-modal__overlay" role="dialog" aria-modal="true" aria-label="Correção de Estoque Físico" onClick={close}>
      <form className="estoque-min-stock-modal__content" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header className="estoque-min-stock-modal__header">
          <div>
            <p className="estoque-min-stock-modal__eyebrow">Correção de Estoque Físico</p>
            <h3 className="estoque-min-stock-modal__title">{item.resumo || item.nome || item.materialId}</h3>
          </div>
          <button type="button" className="estoque-min-stock-modal__close" onClick={close} aria-label="Fechar"><CancelIcon size={18} /></button>
        </header>

        <div className="estoque-min-stock-modal__body">
          <label className="field"><span>Centro de estoque</span>
            <select value={stockCenterId} onChange={(event) => setStockCenterId(event.target.value)} disabled={saving || success} required>
              <option value="">Selecione</option>
              {centers.map((center) => {
                const nome = duplicateCenterNames.has(center.almox) ? `${center.almox || 'Centro'} (${center.id.slice(0, 8)})` : center.almox || center.id
                const saldoCentro = saldoPorCentro.get(String(center.id))
                return <option key={center.id} value={center.id}>{saldoCentro === undefined ? nome : `${nome} — saldo ${quantityFormatter.format(saldoCentro)}`}</option>
              })}
            </select>
          </label>
          <div className="estoque-correction-modal__balance">
            <span>Saldo do sistema<strong>{loadingBalance ? 'Consultando...' : balance === null ? '-' : quantityFormatter.format(balance)}</strong></span>
            <span>Diferença<strong className={difference < 0 ? 'is-negative' : difference > 0 ? 'is-positive' : ''}>{difference === null ? '-' : `${difference > 0 ? '+' : ''}${quantityFormatter.format(difference)}`}</strong></span>
          </div>
          <label className="field"><span>Quantidade encontrada fisicamente</span>
            <input type="number" min="0" step="0.01" value={physicalQuantity} onChange={(event) => setPhysicalQuantity(event.target.value)} disabled={saving || success || balance === null} required />
          </label>
          <label className="field"><span>Observação (opcional)</span>
            <textarea rows="3" maxLength="1000" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving || success} />
          </label>
          <p className="field__hint">O envio cria uma solicitação pendente e não altera o estoque.</p>
          {error ? <p className="feedback feedback--error">{error}</p> : null}
          {success ? <p className="feedback feedback--success">Solicitação enviada. Este material e centro estão bloqueados até a análise.</p> : null}
        </div>

        <footer className="estoque-min-stock-modal__footer">
          <button type="button" className="button button--ghost" onClick={close} disabled={saving}>{success ? 'Fechar' : 'Cancelar'}</button>
          {!success ? <button type="submit" className="button button--primary" disabled={saving || loadingBalance || balance === null}>{saving ? 'Enviando...' : 'Enviar para aprovação'}</button> : null}
        </footer>
      </form>
    </div>
  )
}
