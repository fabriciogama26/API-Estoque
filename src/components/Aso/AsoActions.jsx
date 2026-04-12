import EyeIcon from 'lucide-react/dist/esm/icons/eye.js'
import PlusCircleIcon from 'lucide-react/dist/esm/icons/plus-circle.js'
import { EditIcon, HistoryIcon } from '../icons.jsx'

export function AsoActions({
  aso,
  isEditing,
  isSaving,
  onEdit,
  onHistory,
  onDetails,
  onRegisterExam,
}) {
  const isDemissional = (aso?.tipoExameCodigo || '').toLowerCase() === 'demissional'

  return (
    <div className="materiais-data-table__actions">
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onDetails?.(aso)}
        aria-label={`Ver detalhes do ASO ${aso?.matricula || ''}`}
        title="Ver detalhes"
      >
        <EyeIcon size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onEdit?.(aso)}
        disabled={isEditing || isSaving}
        aria-label={`Editar ASO ${aso?.matricula || ''}`}
        title="Editar"
      >
        <EditIcon size={16} />
      </button>
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onHistory?.(aso)}
        disabled={isSaving}
        aria-label={`Historico do ASO ${aso?.matricula || ''}`}
        title="Historico"
      >
        <HistoryIcon size={16} />
      </button>
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onRegisterExam?.(aso)}
        disabled={isSaving || isDemissional}
        aria-label={`Registrar exame do ASO ${aso?.matricula || ''}`}
        title={isDemissional ? 'Demissional nao possui renovacao' : 'Registrar exame'}
      >
        <PlusCircleIcon size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
