import { History as HistoryIcon } from 'lucide-react'
import { EditIcon } from '../icons.jsx'

export function PessoasActions({ pessoa, isEditing, isSaving, onEdit, onHistory, isHistoryLoading }) {
  const disableEdit = isEditing || isSaving
  const disableHistory = isHistoryLoading || isSaving

  return (
    <div className="pessoas-data-table__actions">
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
    </div>
  )
}
