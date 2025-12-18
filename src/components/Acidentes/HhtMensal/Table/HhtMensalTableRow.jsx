import Eye from 'lucide-react/dist/esm/icons/eye.js'
import { CancelIcon, EditIcon, HistoryIcon } from '../../../icons.jsx'
import { formatMesRefLabel, formatHhtValue } from '../../../../utils/hhtMensalUtils.js'
import { formatDateTimeFullPreserve } from '../../../../utils/acidentesUtils.js'

export function HhtMensalTableRow({ registro, onEdit, onHistory, onDelete, onDetails, isSaving, isEditing }) {
  const disableActions = isSaving || isEditing
  const statusNome = registro.statusNome || 'Ativo'
  const isCancelado = statusNome.toLowerCase() === 'cancelado'
  const registradoPor =
    registro.registradoPor ??
    registro.createdByUsername ??
    registro.createdByName ??
    registro.createdBy ??
    registro.created_by ??
    registro.usuarioCadastroNome ??
    registro.usuarioCadastro ??
    '-'
  const cadastradoEm =
    registro.createdAt ?? registro.created_at ?? registro.criadoEm ?? registro.criado_em ?? registro.updatedAt ?? null

  return (
    <tr>
      <td>
        <strong>{formatMesRefLabel(registro.mesRef)}</strong>
        <p className="data-table__muted">{registro.id}</p>
      </td>
      <td>{registro.centroServicoNome || '-'}</td>
      <td>{statusNome}</td>
      <td>{registro.modo || '-'}</td>
      <td>{formatHhtValue(registro.hhtFinal)}</td>
      <td>{registradoPor || '-'}</td>
      <td>{cadastradoEm ? formatDateTimeFullPreserve(cadastradoEm) : '-'}</td>
      <td>
        <div className="pessoas-data-table__actions">
          {typeof onDetails === 'function' ? (
            <button
              type="button"
              className="pessoas-table-action-button"
              onClick={() => onDetails(registro)}
              disabled={disableActions}
              aria-label="Ver detalhes"
              title="Ver detalhes"
            >
              <Eye size={16} strokeWidth={1.8} />
            </button>
          ) : null}
          {!isCancelado ? (
            <button
              type="button"
              className="pessoas-table-action-button"
              onClick={() => onEdit(registro)}
              disabled={disableActions}
              aria-label="Editar registro"
              title="Editar"
            >
              <EditIcon size={16} strokeWidth={1.8} />
            </button>
          ) : null}
          <button
            type="button"
            className="pessoas-table-action-button"
            onClick={() => onHistory(registro)}
            disabled={isSaving}
            aria-label="Ver historico"
            title="Historico"
          >
            <HistoryIcon size={16} strokeWidth={1.8} />
          </button>
          {!isCancelado ? (
            <button
              type="button"
              className="pessoas-table-action-button pessoas-table-action-button--danger"
              onClick={() => onDelete(registro)}
              disabled={disableActions}
              aria-label="Cancelar registro"
              title="Cancelar"
            >
              <CancelIcon size={16} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
