import Eye from 'lucide-react/dist/esm/icons/eye.js'
import { EditIcon, HistoryIcon, CancelIcon } from '../../icons.jsx'
import {
  formatDateWithOptionalTime as formatDate,
  formatDateTimeFullPreserve,
} from '../../../utils/acidentesUtils.js'

export function AcidentesTableRow({
  acidente,
  onEdit,
  onHistory,
  onDetails,
  onCancel,
  isSaving,
  historyState,
  isEditing,
}) {
  const disableEdit = isEditing || isSaving
  const isHistoryLoading = Boolean(historyState?.isLoading && historyState?.acidente?.id === acidente.id)
  const disableHistory = isSaving || isHistoryLoading || typeof onHistory !== 'function'
  const disableDetails = isSaving || isEditing || typeof onDetails !== 'function'
  const disableCancel = isSaving || typeof onCancel !== 'function'

  const registradoPor =
    acidente.registradoPor ?? acidente.usuarioCadastroNome ?? acidente.usuarioCadastro ?? '-'
  const criadoEm =
    acidente.criadoEm ?? acidente.criado_em ?? acidente.createdAt ?? acidente.created_at ?? null

  return (
    <tr>
      <td>
        <strong>{acidente.nome}</strong>
      </td>
      <td>{acidente.matricula || '-'}</td>
      <td>{formatDate(acidente.data)}</td>
      <td>{acidente.centroServico || acidente.setor || '-'}</td>
      <td>{acidente.local || '-'}</td>
      <td>{acidente.cat || '-'}</td>
      <td>{acidente.cid || '-'}</td>
      <td>{registradoPor || '-'}</td>
      <td>{criadoEm ? formatDateTimeFullPreserve(criadoEm) : '-'}</td>
      <td>
        <div className="pessoas-data-table__actions">
          {typeof onDetails === 'function' ? (
            <button
              type="button"
              className="pessoas-table-action-button"
              onClick={() => onDetails(acidente)}
              disabled={disableDetails}
              aria-label={`Detalhar ${acidente.nome}`}
              title="Ver detalhes do acidente"
            >
              <Eye size={16} strokeWidth={1.8} />
            </button>
          ) : null}
          <button
            type="button"
            className="pessoas-table-action-button"
            onClick={() => onEdit(acidente)}
            disabled={disableEdit}
            aria-label={disableEdit ? 'Editando acidente' : `Editar ${acidente.nome}`}
            title="Editar acidente"
          >
            <EditIcon size={16} strokeWidth={1.8} />
          </button>
          {typeof onHistory === 'function' ? (
            <button
              type="button"
              className="pessoas-table-action-button"
              onClick={() => onHistory(acidente)}
              disabled={disableHistory}
              aria-label={`Ver historico de edicao de ${acidente.nome}`}
              title="Historico do acidente"
            >
              <HistoryIcon size={16} strokeWidth={1.8} />
            </button>
          ) : null}
          {typeof onCancel === 'function' ? (
            <button
              type="button"
              className="pessoas-table-action-button pessoas-table-action-button--danger"
              onClick={() => onCancel(acidente)}
              disabled={disableCancel}
              aria-label={`Cancelar ${acidente.nome}`}
              title="Cancelar acidente"
            >
              <CancelIcon size={16} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
