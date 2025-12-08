import { Eye } from 'lucide-react'
import { EditIcon, HistoryIcon } from '../icons.jsx'

// Ações para cada material na tabela de materiais
export function MateriaisActions({
  material,
  isEditing,
  isSaving,
  onEdit,
  onHistory,
  onView,
  isHistoryLoading,
}) {
  const isEditDisabled = isEditing || isSaving
  const historyDisabled = isHistoryLoading || isSaving

  // Evita renderizar ações para materiais inexistentes
  return (
    <div className="materiais-data-table__actions">
      {onView ? (
        <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onView(material)}
        disabled={isSaving}
        aria-label={`Ver detalhes de ${material.nome || material.nomeItemRelacionado || 'material'}`}
        title="Ver detalhes"
      >
        <Eye size={16} strokeWidth={1.8} />
      </button>
      ) : null}
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onEdit(material)}
        disabled={isEditDisabled}
        aria-label={isEditDisabled ? 'Editando material' : `Editar ${material.nome}`}
        title="Editar material"
      >
        <EditIcon size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onHistory(material)}
        disabled={historyDisabled}
        aria-label={`Ver historico de precos de ${material.nome}`}
        title="Historico de precos"
      >
        <HistoryIcon size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
