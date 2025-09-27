import { Pencil, History as HistoryIcon } from 'lucide-react'

export function PessoasActions({ pessoa, isEditing, isSaving, onEdit, onHistory, isHistoryLoading }) {
  const disableEdit = isEditing || isSaving
  const disableHistory = isHistoryLoading || isSaving

  return (
    <div className="materiais-data-table__actions">
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onEdit(pessoa)}
        disabled={disableEdit}
        aria-label={disableEdit ? 'Editando pessoa' : `Editar ${pessoa.nome}`}
      >
        <Pencil size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onHistory(pessoa)}
        disabled={disableHistory}
        aria-label={`Ver historico de edicao de ${pessoa.nome}`}
      >
        <HistoryIcon size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
