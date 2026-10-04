import { CancelIcon } from '../../icons.jsx'
import { correctionUserName } from '../../../lib/stockCorrections.js'
import { formatCurrency, formatMaterialSummary } from '../../../utils/entradasUtils.js'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const text = (value) => (hasValue(value) ? String(value).trim() : '-')
const quantity = (value) => (hasValue(value) ? number.format(Number(value)) : '-')
const signed = (value) => (hasValue(value) ? `${Number(value) > 0 ? '+' : ''}${number.format(Number(value))}` : '-')
const dateTime = (value) => (value ? new Date(value).toLocaleString('pt-BR') : '-')
const userLabel = (user, id) => correctionUserName(user) || text(id)

function Item({ label, value, muted }) {
  return (
    <div className="saida-details__item">
      <span className="saida-details__label">{label}</span>
      <p className="saida-details__value">{value}</p>
      {muted ? <p className="data-table__muted">{muted}</p> : null}
    </div>
  )
}

export function StockCorrectionDetailsModal({ row, onClose }) {
  if (!row) {
    return null
  }

  const material = row.material || {}
  // stock_adjustments.request_id e unico: o PostgREST devolve objeto, mas aceita lista por seguranca.
  const adjustment = Array.isArray(row.adjustment) ? row.adjustment[0] : row.adjustment
  const unitValue = hasValue(material.valorUnitario) ? Number(material.valorUnitario) : null
  const size = material.numeroCalcadoNome || material.numeroVestimentaNome || material.numeroEspecifico

  return (
    <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
        <header className="saida-details__header">
          <div>
            <p className="saida-details__eyebrow">ID da solicitação</p>
            <h3 className="saida-details__title">{row.id}</h3>
          </div>
          <button type="button" className="saida-details__close" onClick={onClose} aria-label="Fechar detalhes da correção">
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Material</h4>
          <div className="saida-details__grid">
            <Item label="Nome completo" value={formatMaterialSummary(material) || text(material.materialItemNome)} />
            <Item label="ID do material" value={text(row.material_id)} />
            <Item label="Descrição" value={text(material.descricao)} />
            <Item label="CA" value={text(material.ca)} />
            <Item label="Fabricante" value={text(material.fabricanteNome)} />
            <Item label="Grupo" value={text(material.grupoMaterialNome)} />
            <Item label="Tamanho" value={text(size)} />
            <Item label="Cores" value={text(material.coresTexto)} />
            <Item label="Características" value={text(material.caracteristicasTexto)} />
            <Item label="Validade (dias)" value={text(material.validadeDias)} />
            <Item label="Valor unitário" value={unitValue === null ? '-' : formatCurrency(unitValue)} />
            <Item label="Estoque mínimo" value={quantity(material.estoqueMinimo)} />
            <Item label="Cadastro" value={row.material ? (material.ativo === false ? 'Inativo' : 'Ativo') : 'Material não encontrado'} />
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Correção</h4>
          <div className="saida-details__grid">
            <Item label="Centro de estoque" value={text(row.stock_center?.almox)} muted={`ID: ${text(row.stock_center_id)}`} />
            <Item label="Saldo do sistema" value={quantity(row.system_balance)} />
            <Item label="Contagem física" value={quantity(row.physical_quantity)} />
            <Item label="Diferença" value={signed(row.difference)} />
            <Item
              label="Valor da diferença"
              value={unitValue === null ? '-' : formatCurrency(Number(row.difference || 0) * unitValue)}
            />
            <Item label="Status" value={text(row.status)} />
            <Item label="Motivo" value={text(row.reason)} />
            <Item label="Observações" value={text(row.notes)} />
          </div>
        </div>

        <div className="saida-details__section">
          <h4 className="saida-details__section-title">Registro</h4>
          <div className="saida-details__grid">
            <Item label="Solicitante" value={userLabel(row.requester, row.requested_by)} />
            <Item label="Solicitado em" value={dateTime(row.requested_at)} />
            {row.approved_by ? (
              <>
                <Item label="Aprovado por" value={userLabel(row.approver, row.approved_by)} />
                <Item label="Aprovado em" value={dateTime(row.approved_at)} />
              </>
            ) : null}
            {row.rejected_by ? (
              <>
                <Item label="Rejeitado por" value={userLabel(row.rejecter, row.rejected_by)} />
                <Item label="Rejeitado em" value={dateTime(row.rejected_at)} />
                <Item label="Motivo da rejeição" value={text(row.rejection_reason)} />
              </>
            ) : null}
            {row.cancelled_by ? (
              <>
                <Item label="Cancelado por" value={userLabel(row.canceller, row.cancelled_by)} />
                <Item label="Cancelado em" value={dateTime(row.cancelled_at)} />
                <Item label="Motivo do cancelamento" value={text(row.cancellation_reason)} />
              </>
            ) : null}
            {adjustment ? (
              <>
                <Item label="Ajuste no saldo" value={signed(adjustment.adjustment_quantity)} />
                <Item label="Data do ajuste" value={dateTime(adjustment.created_at)} />
              </>
            ) : null}
          </div>
        </div>

        <footer className="saida-details__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
