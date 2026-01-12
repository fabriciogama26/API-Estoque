import HistoryIcon from 'lucide-react/dist/esm/icons/history.js'
import EyeIcon from 'lucide-react/dist/esm/icons/eye.js'
import { CancelIcon, EditIcon } from '../icons.jsx'

export function PessoasActions({
  pessoa,
  isEditing,
  isSaving,
  onEdit,
  onHistory,
  onDetalhes,
  onCancel,
  isHistoryLoading,
  isCanceling,
  isInactive,
}) {
  const disableEdit = isEditing || isSaving
  const disableHistory = isHistoryLoading || isSaving
  const disableCancel = isCanceling || isSaving || isInactive

  return (
    <div className="pessoas-data-table__actions">
      <button
        type="button"
        className="pessoas-table-action-button"
        onClick={() => onDetalhes?.(pessoa)}
        aria-label={`Ver detalhes de ${pessoa.nome}`}
        title="Ver detalhes"
      >
        <EyeIcon size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="pessoas-table-action-button"
        onClick={() => onEdit(pessoa)}
        disabled={disableEdit}
        aria-label={disableEdit ? 'Editando pessoa' : `Editar ${pessoa.nome}`}
        title="Editar pessoa"
      >
        <EditIcon size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="pessoas-table-action-button"
        onClick={() => onHistory(pessoa)}
        disabled={disableHistory}
        aria-label={`Ver historico de edicao de ${pessoa.nome}`}
        title="Historico da pessoa"
      >
        <HistoryIcon size={16} strokeWidth={1.8} />
      </button>
      {!isInactive ? (
        <button
          type="button"
          className="pessoas-table-action-button pessoas-table-action-button--danger"
          onClick={() => onCancel?.(pessoa)}
          disabled={disableCancel}
          aria-label={`Cancelar ${pessoa.nome}`}
          title="Cancelar pessoa"
        >
          <CancelIcon size={16} strokeWidth={1.8} />
        </button>
      ) : null}
    </div>
  )
}
