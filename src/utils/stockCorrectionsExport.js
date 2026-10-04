import { buildCsv, downloadCsv } from './csvExport.js'
import { formatDisplayDateTime } from './saidasUtils.js'
import { correctionMaterialLabel, correctionUserName } from '../lib/stockCorrections.js'

const HEADERS = [
  'ID da solicitacao',
  'Material',
  'ID do material',
  'CA',
  'Descricao',
  'Centro de estoque',
  'Saldo sistema',
  'Contagem fisica',
  'Diferenca',
  'Status',
  'Solicitante',
  'Solicitado em',
  'Finalizado por',
  'Finalizado em',
  'Motivo da rejeicao ou cancelamento',
  'Observacoes',
  'Ajuste no saldo',
  'Data do ajuste',
]

// Quantidades com virgula e sem separador de milhar, para o Excel pt-BR ler como numero.
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, useGrouping: false })
const csvNumber = (value) => (value === null || value === undefined || value === '' ? '' : quantity.format(Number(value)))
const csvDateTime = (value) => (value ? formatDisplayDateTime(value) : '')

// Quem encerrou a solicitacao, conforme o status (aprovacao, rejeicao ou cancelamento).
const resolution = (row) => {
  if (row.status === 'APROVADO') return { user: row.approver, id: row.approved_by, at: row.approved_at, reason: '' }
  if (row.status === 'REJEITADO') return { user: row.rejecter, id: row.rejected_by, at: row.rejected_at, reason: row.rejection_reason }
  if (row.status === 'CANCELADO') return { user: row.canceller, id: row.cancelled_by, at: row.cancelled_at, reason: row.cancellation_reason }
  return { user: null, id: null, at: null, reason: '' }
}

export const buildStockCorrectionsCsv = (rows = []) =>
  buildCsv(
    HEADERS,
    (Array.isArray(rows) ? rows : []).map((row) => {
      const material = row.material || {}
      const done = resolution(row)
      // stock_adjustments.request_id e unico: o PostgREST devolve objeto, mas aceita lista por seguranca.
      const adjustment = Array.isArray(row.adjustment) ? row.adjustment[0] : row.adjustment
      return [
        row.id,
        correctionMaterialLabel(row),
        row.material_id,
        material.ca,
        material.descricao,
        row.stock_center?.almox || row.stock_center_id,
        csvNumber(row.system_balance),
        csvNumber(row.physical_quantity),
        csvNumber(row.difference),
        row.status,
        correctionUserName(row.requester) || row.requested_by,
        csvDateTime(row.requested_at),
        correctionUserName(done.user) || done.id || '',
        csvDateTime(done.at),
        done.reason,
        row.notes,
        csvNumber(adjustment?.adjustment_quantity),
        csvDateTime(adjustment?.created_at),
      ]
    }),
  )

export const downloadStockCorrectionsCsv = (rows = [], filename = 'correcoes-estoque.csv') => {
  downloadCsv(buildStockCorrectionsCsv(rows), filename)
}
