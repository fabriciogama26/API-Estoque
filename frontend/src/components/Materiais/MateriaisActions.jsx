import { Pencil, History as HistoryIcon } from 'lucide-react'

// Ações para cada material na tabela de materiais
export function MateriaisActions({
  material,
  isEditing,
  isSaving,
  onEdit,
  onHistory,
  isHistoryLoading,
}) {
  const isEditDisabled = isEditing || isSaving
  const historyDisabled = isHistoryLoading || isSaving

  // Evita renderizar ações para materiais inexistentes
  return (
    <div className="data-table__actions">
      <button
        type="button"
        className="table-action-button"
        onClick={() => onEdit(material)}
        disabled={isEditDisabled}
        aria-label={isEditDisabled ? 'Editando material' : `Editar ${material.nome}`}
      >
        <Pencil size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="table-action-button"
        onClick={() => onHistory(material)}
        disabled={historyDisabled}
        aria-label={`Ver historico de precos de ${material.nome}`}
      >
        <HistoryIcon size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
