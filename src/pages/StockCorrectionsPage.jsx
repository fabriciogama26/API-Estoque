import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon } from '../components/icons.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import {
  approveStockCorrection,
  cancelStockCorrection,
  getCorrectionBalance,
  listCorrectionOptions,
  listStockCorrections,
  rejectStockCorrection,
  requestStockCorrection,
} from '../services/stockCorrectionsApi.js'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const signed = (value) => `${Number(value) > 0 ? '+' : ''}${number.format(Number(value || 0))}`
const userName = (user) => user?.display_name || user?.username || '-'
const materialName = (material) => material?.materialItemNome || material?.descricao || material?.id || '-'

export function StockCorrectionsPage() {
  const [searchParams] = useSearchParams()
  const { permissions, isAdmin, isMaster, userId } = usePermissions()
  const canRequest = isAdmin || isMaster || permissions.includes('estoque.correcao.solicitar')
  const canApprove = isAdmin || isMaster || permissions.includes('estoque.correcao.aprovar')
  const [rows, setRows] = useState([])
  const [options, setOptions] = useState({ materials: [], centers: [] })
  const [filters, setFilters] = useState({ status: 'PENDENTE', materialId: '', stockCenterId: '', start: '', end: '' })
  const [form, setForm] = useState({ materialId: searchParams.get('materialId') || '', stockCenterId: '', physicalQuantity: '', notes: '' })
  const [feedback, setFeedback] = useState(null)
  const [balance, setBalance] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setFeedback(null)
      setRows(await listStockCorrections(filters))
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    }
  }, [filters])

  useEffect(() => { listCorrectionOptions().then(setOptions).catch((error) => setFeedback({ type: 'error', text: error.message })) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!form.materialId || !form.stockCenterId) { setBalance(null); return }
    getCorrectionBalance(form.materialId, form.stockCenterId)
      .then((value) => setBalance(Number(value)))
      .catch((error) => setFeedback({ type: 'error', text: error.message }))
  }, [form.materialId, form.stockCenterId])

  const selectedPending = useMemo(() => rows.filter((row) => row.status === 'PENDENTE').length, [rows])
  const mutate = async (action, success) => {
    setBusy(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ type: 'success', text: success })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally { setBusy(false) }
  }

  const submitRequest = (event) => {
    event.preventDefault()
    const physicalQuantity = Number(form.physicalQuantity)
    if (!form.materialId || !form.stockCenterId || !Number.isFinite(physicalQuantity) || physicalQuantity < 0) {
      setFeedback({ type: 'error', text: 'Selecione material e centro e informe uma quantidade física válida.' })
      return
    }
    mutate(() => requestStockCorrection({ ...form, physicalQuantity }), 'Solicitação enviada sem alterar o estoque.')
      .then(() => setForm((current) => ({ ...current, physicalQuantity: '', notes: '' })))
  }

  const reject = (row) => {
    const reason = window.prompt('Motivo da rejeição:')
    if (!reason?.trim()) return
    mutate(() => rejectStockCorrection(row.id, reason.trim()), 'Solicitação rejeitada; posição desbloqueada.')
  }

  return (
    <div className="stack">
      <PageHeader icon={<InventoryIcon size={28} />} title="Aprovação de correções de estoque" subtitle="Conferências físicas, aprovações e histórico por material e centro de estoque." />
      {feedback ? <p className={`feedback feedback--${feedback.type}`}>{feedback.text}</p> : null}

      {canRequest ? <section className="card">
        <header className="card__header"><h2>Correção de Estoque Físico</h2></header>
        <form className="form-grid" onSubmit={submitRequest}>
          <label>Material<select value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })} required><option value="">Selecione</option>{options.materials.map((item) => <option key={item.id} value={item.id}>{materialName(item)}</option>)}</select></label>
          <label>Centro de estoque<select value={form.stockCenterId} onChange={(e) => setForm({ ...form, stockCenterId: e.target.value })} required><option value="">Selecione</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.almox || item.id}</option>)}</select></label>
          <label>Quantidade encontrada fisicamente<input type="number" min="0" step="0.01" value={form.physicalQuantity} onChange={(e) => setForm({ ...form, physicalQuantity: e.target.value })} required /></label>
          <label>Observação<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></label>
          <button className="button button--primary" disabled={busy}>Enviar para aprovação</button>
        </form>
        {balance !== null ? <p className="feedback">
          Saldo atual: <strong>{number.format(balance)}</strong> | Quantidade física:{' '}
          <strong>{form.physicalQuantity === '' ? '-' : number.format(Number(form.physicalQuantity))}</strong> | Diferença:{' '}
          <strong>{form.physicalQuantity === '' ? '-' : signed(Number(form.physicalQuantity) - balance)}</strong>
        </p> : null}
        <p className="feedback">O saldo e a diferença são calculados no banco. O envio não movimenta o estoque.</p>
      </section> : null}

      <section className="card">
        <header className="card__header"><h2>Solicitações ({selectedPending} pendentes)</h2></header>
        <form className="filters-grid" onSubmit={(event) => { event.preventDefault(); load() }}>
          <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todos</option>{['PENDENTE','APROVADO','REJEITADO','CANCELADO'].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Material<select value={filters.materialId} onChange={(e) => setFilters({ ...filters, materialId: e.target.value })}><option value="">Todos</option>{options.materials.map((item) => <option key={item.id} value={item.id}>{materialName(item)}</option>)}</select></label>
          <label>Centro<select value={filters.stockCenterId} onChange={(e) => setFilters({ ...filters, stockCenterId: e.target.value })}><option value="">Todos</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.almox || item.id}</option>)}</select></label>
          <label>De<input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} /></label>
          <label>Até<input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} /></label>
        </form>
        <div className="table-wrapper"><table><thead><tr><th>Material</th><th>Centro</th><th>Saldo sistema</th><th>Contagem física</th><th>Diferença</th><th>Solicitante</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{materialName(row.material) || row.material_id}</td><td>{row.stock_center?.almox || row.stock_center_id}</td><td>{number.format(row.system_balance)}</td><td>{number.format(row.physical_quantity)}</td><td><strong style={{ color: Number(row.difference) < 0 ? 'var(--danger, #b42318)' : 'var(--success, #067647)' }}>{signed(row.difference)}</strong></td><td>{userName(row.requester)}</td><td>{new Date(row.requested_at).toLocaleString('pt-BR')}</td><td>{row.status}</td><td>{row.status === 'PENDENTE' ? <div className="actions-row">{canApprove && row.requested_by !== userId ? <><button type="button" className="button button--primary" disabled={busy} onClick={() => mutate(() => approveStockCorrection(row.id), 'Correção aprovada e estoque atualizado.')}>Aprovar</button><button type="button" className="button button--danger" disabled={busy} onClick={() => reject(row)}>Rejeitar</button></> : null}{row.requested_by === userId || canApprove ? <button type="button" className="button button--ghost" disabled={busy} onClick={() => mutate(() => cancelStockCorrection(row.id), 'Solicitação cancelada; posição desbloqueada.')}>Cancelar</button> : null}</div> : '-'}</td></tr>)}</tbody></table></div>
        {!rows.length ? <p className="feedback">Nenhuma solicitação encontrada.</p> : null}
      </section>
    </div>
  )
}
