import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { InventoryIcon, SpreadsheetIcon } from '../components/icons.jsx'
import { StockCorrectionDetailsModal } from '../components/Estoque/Modal/StockCorrectionDetailsModal.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import '../styles/MateriaisPage.css'
import '../styles/StockCorrectionsPage.css'
import {
  approveStockCorrection,
  cancelStockCorrection,
  listCorrectionCenters,
  listStockCorrections,
  rejectStockCorrection,
} from '../services/stockCorrectionsApi.js'
import {
  canResolveStockCorrection,
  correctionMaterialLabel,
  correctionUserName,
  matchesCorrectionMaterial,
} from '../lib/stockCorrections.js'
import { downloadStockCorrectionsCsv } from '../utils/stockCorrectionsExport.js'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const signed = (value) => `${Number(value) > 0 ? '+' : ''}${number.format(Number(value || 0))}`
const EMPTY_FILTERS = { status: '', materialTerm: '', stockCenterId: '', start: '', end: '' }

export function StockCorrectionsPage() {
  const [searchParams] = useSearchParams()
  const { permissions, isAdmin, isMaster, userId, profile } = usePermissions()
  const canApprove = isAdmin || isMaster || permissions.includes('estoque.correcao.aprovar')
  // Titular = conta que nao e dependente de ninguem (mesmo criterio de Configuracoes).
  const isAccountOwner = Boolean(userId) && !profile?.parent_user_id
  const [rows, setRows] = useState([])
  const [centers, setCenters] = useState([])
  // O link "Corrigir" do Estoque atual abre a tela ja filtrada pelo ID do material.
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, materialTerm: searchParams.get('materialId') || '' })
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailRow, setDetailRow] = useState(null)
  const { status, stockCenterId, start, end, materialTerm } = filters

  // Material fica fora da consulta: o filtro por texto roda sobre as linhas ja carregadas.
  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFeedback(null)
      setRows(await listStockCorrections({ status, stockCenterId, start, end }))
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [status, stockCenterId, start, end])

  useEffect(() => { listCorrectionCenters().then(setCenters).catch((error) => setFeedback({ type: 'error', text: error.message })) }, [])
  useEffect(() => { load() }, [load])

  const visibleRows = useMemo(() => rows.filter((row) => matchesCorrectionMaterial(row, materialTerm)), [rows, materialTerm])
  const selectedPending = useMemo(() => visibleRows.filter((row) => row.status === 'PENDENTE').length, [visibleRows])
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

  // Exporta o que esta na tela: filtros do banco e o filtro de material ja aplicados.
  const exportCsv = () => {
    downloadStockCorrectionsCsv(visibleRows, `correcoes-estoque-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
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
          <label className="field"><span>Material</span><input type="search" value={filters.materialTerm} placeholder="Nome, CA ou ID" onChange={(e) => setFilters({ ...filters, materialTerm: e.target.value })} /></label>
          <label className="field"><span>Centro de estoque</span><select value={filters.stockCenterId} onChange={(e) => setFilters({ ...filters, stockCenterId: e.target.value })}><option value="">Todos</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.almox || item.id}</option>)}</select></label>
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
          <div className="stock-corrections-page__header-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={exportCsv}
              disabled={loading || !visibleRows.length}
              aria-label="Exportar lista de solicitações em CSV"
            >
              <SpreadsheetIcon size={16} />
              <span>Exportar Excel (CSV)</span>
            </button>
            <span className="status-badge status-badge--warning">{selectedPending} {selectedPending === 1 ? 'pendente' : 'pendentes'}</span>
          </div>
        </header>
        {loading ? <p className="feedback">Carregando solicitações...</p> : null}
        {!loading && !visibleRows.length ? <p className="feedback">Nenhuma solicitação encontrada para os filtros informados.</p> : null}
        {!loading && visibleRows.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Material</th><th>Centro</th><th>Saldo sistema</th><th>Contagem física</th><th>Diferença</th><th>Solicitante</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={row.id}>
                <td><strong>{correctionMaterialLabel(row) || '-'}</strong><p className="data-table__muted">Solicitação: {row.id}</p></td>
                <td>{row.stock_center?.almox || row.stock_center_id}</td>
                <td>{number.format(row.system_balance)}</td><td>{number.format(row.physical_quantity)}</td>
                <td><strong style={{ color: Number(row.difference) < 0 ? 'var(--danger, #b42318)' : 'var(--success, #067647)' }}>{signed(row.difference)}</strong></td>
                <td>{correctionUserName(row.requester) || '-'}</td><td>{new Date(row.requested_at).toLocaleString('pt-BR')}</td><td>{row.status}</td>
                <td><div className="table-actions"><button type="button" className="materiais-table-action-button" onClick={() => setDetailRow(row)} aria-label={`Ver detalhes da solicitação ${row.id}`} title="Ver detalhes"><Eye size={16} strokeWidth={1.8} /></button>{row.status === 'PENDENTE' ? <>{canResolveStockCorrection({ row, userId, canApprove, isAccountOwner }) ? <><button type="button" className="button button--primary" disabled={busy} onClick={() => mutate(() => approveStockCorrection(row.id), 'Correção aprovada e estoque atualizado.')}>Aprovar</button><button type="button" className="button button--danger" disabled={busy} onClick={() => reject(row)}>Rejeitar</button></> : null}{row.requested_by === userId || canApprove ? <button type="button" className="button button--ghost" disabled={busy} onClick={() => mutate(() => cancelStockCorrection(row.id), 'Solicitação cancelada; posição desbloqueada.')}>Cancelar</button> : null}</> : null}</div></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>

      <StockCorrectionDetailsModal row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  )
}
