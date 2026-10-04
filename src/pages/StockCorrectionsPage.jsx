import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon } from '../components/icons.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import '../styles/StockCorrectionsPage.css'
import {
  approveStockCorrection,
  cancelStockCorrection,
  listCorrectionOptions,
  listStockCorrections,
  rejectStockCorrection,
} from '../services/stockCorrectionsApi.js'
import { canResolveStockCorrection } from '../lib/stockCorrections.js'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const signed = (value) => `${Number(value) > 0 ? '+' : ''}${number.format(Number(value || 0))}`
const userName = (user) => user?.display_name || user?.username || '-'
const materialName = (material) => material?.materialItemNome || material?.descricao || material?.id || '-'

export function StockCorrectionsPage() {
  const [searchParams] = useSearchParams()
  const { permissions, isAdmin, isMaster, userId, profile } = usePermissions()
  const canApprove = isAdmin || isMaster || permissions.includes('estoque.correcao.aprovar')
  // Titular = conta que nao e dependente de ninguem (mesmo criterio de Configuracoes).
  const isAccountOwner = Boolean(userId) && !profile?.parent_user_id
  const [rows, setRows] = useState([])
  const [options, setOptions] = useState({ materials: [], centers: [] })
  const [filters, setFilters] = useState({ status: 'PENDENTE', materialId: searchParams.get('materialId') || '', stockCenterId: '', start: '', end: '' })
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFeedback(null)
      setRows(await listStockCorrections(filters))
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { listCorrectionOptions().then(setOptions).catch((error) => setFeedback({ type: 'error', text: error.message })) }, [])
  useEffect(() => { load() }, [load])

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

  const reject = (row) => {
    const reason = window.prompt('Motivo da rejeição:')
    if (!reason?.trim()) return
    mutate(() => rejectStockCorrection(row.id, reason.trim()), 'Solicitação rejeitada; posição desbloqueada.')
  }

  const clearFilters = () => {
    setFilters({ status: 'PENDENTE', materialId: '', stockCenterId: '', start: '', end: '' })
  }

  return (
    <div className="stack stock-corrections-page">
      <PageHeader icon={<InventoryIcon size={28} />} title="Aprovação de correções de estoque" subtitle="Conferências físicas, aprovações e histórico por material e centro de estoque." />
      {feedback ? <p className={`feedback feedback--${feedback.type}`}>{feedback.text}</p> : null}

      <section className="card">
        <header className="card__header">
          <div>
            <h2>Filtros</h2>
            <p className="card__subtitle">Localize solicitações por situação, material, centro de estoque ou período.</p>
          </div>
        </header>
        <form className="form form--inline" onSubmit={(event) => { event.preventDefault(); load() }}>
          <label className="field"><span>Status</span><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todos</option>{['PENDENTE','APROVADO','REJEITADO','CANCELADO'].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field"><span>Material</span><select value={filters.materialId} onChange={(e) => setFilters({ ...filters, materialId: e.target.value })}><option value="">Todos</option>{options.materials.map((item) => <option key={item.id} value={item.id}>{materialName(item)}</option>)}</select></label>
          <label className="field"><span>Centro de estoque</span><select value={filters.stockCenterId} onChange={(e) => setFilters({ ...filters, stockCenterId: e.target.value })}><option value="">Todos</option>{options.centers.map((item) => <option key={item.id} value={item.id}>{item.almox || item.id}</option>)}</select></label>
          <label className="field"><span>Período inicial</span><input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} /></label>
          <label className="field"><span>Período final</span><input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} /></label>
          <div className="form__actions">
            <button type="submit" className="button button--primary" disabled={loading}>Aplicar filtros</button>
            <button type="button" className="button button--ghost" onClick={clearFilters} disabled={loading}>Limpar filtros</button>
          </div>
        </form>
      </section>

      <section className="card">
        <header className="card__header">
          <div>
            <h2>Solicitações</h2>
            <p className="card__subtitle">Acompanhe as conferências físicas e analise as solicitações pendentes.</p>
          </div>
          <span className="status-badge status-badge--warning">{selectedPending} {selectedPending === 1 ? 'pendente' : 'pendentes'}</span>
        </header>
        {loading ? <p className="feedback">Carregando solicitações...</p> : null}
        {!loading && !rows.length ? <p className="feedback">Nenhuma solicitação encontrada para os filtros informados.</p> : null}
        {!loading && rows.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Material</th><th>Centro</th><th>Saldo sistema</th><th>Contagem física</th><th>Diferença</th><th>Solicitante</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id}>
                <td><strong>{materialName(row.material) || row.material_id}</strong><p className="data-table__muted">Solicitação: {row.id}</p></td>
                <td>{row.stock_center?.almox || row.stock_center_id}</td>
                <td>{number.format(row.system_balance)}</td><td>{number.format(row.physical_quantity)}</td>
                <td><strong style={{ color: Number(row.difference) < 0 ? 'var(--danger, #b42318)' : 'var(--success, #067647)' }}>{signed(row.difference)}</strong></td>
                <td>{userName(row.requester)}</td><td>{new Date(row.requested_at).toLocaleString('pt-BR')}</td><td>{row.status}</td>
                <td>{row.status === 'PENDENTE' ? <div className="table-actions">{canResolveStockCorrection({ row, userId, canApprove, isAccountOwner }) ? <><button type="button" className="button button--primary" disabled={busy} onClick={() => mutate(() => approveStockCorrection(row.id), 'Correção aprovada e estoque atualizado.')}>Aprovar</button><button type="button" className="button button--danger" disabled={busy} onClick={() => reject(row)}>Rejeitar</button></> : null}{row.requested_by === userId || canApprove ? <button type="button" className="button button--ghost" disabled={busy} onClick={() => mutate(() => cancelStockCorrection(row.id), 'Solicitação cancelada; posição desbloqueada.')}>Cancelar</button> : null}</div> : '-'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
