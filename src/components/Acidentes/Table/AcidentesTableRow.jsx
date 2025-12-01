import { Pencil, History as HistoryIcon } from 'lucide-react'
import {
  formatDateWithOptionalTime as formatDate,
  formatNumberValue as formatNumber,
  formatStatusWithDate,
} from '../../../utils/acidentesUtils.js'

export function AcidentesTableRow({ acidente, onEdit, onHistory, isSaving, historyState, isEditing }) {
  const disableEdit = isEditing || isSaving
  const isHistoryLoading = Boolean(historyState?.isLoading && historyState?.acidente?.id === acidente.id)
  const disableHistory = isSaving || isHistoryLoading || typeof onHistory !== 'function'

  const partesSelecionadas = Array.isArray(acidente.partesLesionadas)
    ? acidente.partesLesionadas.filter(Boolean)
    : acidente.parteLesionada
      ? [acidente.parteLesionada]
      : []
  const lesoesSelecionadas = Array.isArray(acidente.lesoes)
    ? acidente.lesoes.filter(Boolean)
    : acidente.lesao
      ? [acidente.lesao]
      : []
  const agentesSelecionados = Array.isArray(acidente.agentes)
    ? acidente.agentes.filter(Boolean)
    : acidente.agente
      ? [acidente.agente]
      : []
  const tiposSelecionados = Array.isArray(acidente.tipos)
    ? acidente.tipos.filter(Boolean)
    : acidente.tipo
      ? [acidente.tipo]
      : []

  return (
    <tr>
      <td>
        <strong>{acidente.nome}</strong>
      </td>
      <td>{acidente.matricula || '-'}</td>
      <td>{formatDate(acidente.data)}</td>
      <td>{formatStatusWithDate(Boolean(acidente.dataEsocial), acidente.dataEsocial)}</td>
      <td>{formatStatusWithDate(Boolean(acidente.sesmt), acidente.dataSesmt)}</td>
      <td>{formatNumber(acidente.diasPerdidos)}</td>
      <td>{formatNumber(acidente.diasDebitados)}</td>
      <td>{agentesSelecionados.length ? agentesSelecionados.join(', ') : '-'}</td>
      <td>{tiposSelecionados.length ? tiposSelecionados.join(', ') : '-'}</td>
      <td>{lesoesSelecionadas.length ? lesoesSelecionadas.join(', ') : '-'}</td>
      <td>{partesSelecionadas.length ? partesSelecionadas.join(', ') : '-'}</td>
      <td>{acidente.local || '-'}</td>
      <td>{formatNumber(acidente.hht)}</td>
      <td>{acidente.cat || '-'}</td>
      <td>{acidente.cid || '-'}</td>
      <td>
        <div className="pessoas-data-table__actions">
          <button
            type="button"
            className="pessoas-table-action-button"
            onClick={() => onEdit(acidente)}
            disabled={disableEdit}
            aria-label={disableEdit ? 'Editando acidente' : `Editar ${acidente.nome}`}
          >
            <Pencil size={16} strokeWidth={1.8} />
          </button>
          {typeof onHistory === 'function' ? (
            <button
              type="button"
              className="pessoas-table-action-button"
              onClick={() => onHistory(acidente)}
              disabled={disableHistory}
              aria-label={`Ver historico de edicao de ${acidente.nome}`}
            >
              <HistoryIcon size={16} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
