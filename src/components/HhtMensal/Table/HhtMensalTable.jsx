import Eye from 'lucide-react/dist/esm/icons/eye.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import { EditIcon, HistoryIcon } from '../../icons.jsx'
import { formatHhtValue, formatMesRefLabel, normalizeModo } from '../../../utils/hhtMensalUtils.js'

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function HhtMensalTable({
  registros = [],
  onEdit,
  onHistory,
  onDetails,
  onDelete,
  isSaving = false,
  editingId = null,
}) {
  if (!registros.length) {
    return <p className="feedback">Nenhum registro encontrado.</p>
  }

  const handleAction = (callback, registro) => {
    if (typeof callback === 'function') {
      callback(registro)
    }
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Centro de servico</th>
            <th>Status</th>
            <th>Modo</th>
            <th>HHT final</th>
            <th>Registrado por</th>
            <th>Cadastrado em</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => {
            const key = registro.id ?? `${registro.mesRef ?? registro.mes_ref}-${registro.centroServicoId ?? registro.centro_servico_id ?? ''}`
            const modo = normalizeModo(registro.modo ?? registro.modoCadastro ?? '')
            const statusNome = registro.statusNome ?? registro.status_nome ?? registro.status ?? '-'
            const hhtFinal =
              registro.hhtFinal ??
              registro.hht_final ??
              registro.hhtCalculado ??
              registro.hht_calculado ??
              registro.hhtInformado ??
              registro.hht_informado
            const registradoPor =
              registro.registradoPor ??
              registro.usuarioCadastroNome ??
              registro.usuarioCadastro ??
              registro.createdBy ??
              registro.created_by_username ??
              '-'
            const criadoEm =
              registro.criadoEm ??
              registro.criado_em ??
              registro.createdAt ??
              registro.created_at ??
              registro.dataCriacao ??
              registro.data_criacao ??
              null

            const disableActions = isSaving || editingId === registro.id

            return (
              <tr key={key}>
                <td>{formatMesRefLabel(registro.mesRef ?? registro.mes_ref)}</td>
                <td>{registro.centroServicoNome ?? registro.centroServico ?? registro.centro_servico_nome ?? '-'}</td>
                <td>{statusNome}</td>
                <td>{modo}</td>
                <td>{formatHhtValue(hhtFinal)}</td>
                <td>{registradoPor || '-'}</td>
                <td>{formatDateTime(criadoEm)}</td>
                <td>
                  <div className="pessoas-data-table__actions">
                    {typeof onDetails === 'function' ? (
                      <button
                        type="button"
                        className="pessoas-table-action-button"
                        onClick={() => handleAction(onDetails, registro)}
                        disabled={disableActions}
                        title="Ver detalhes"
                      >
                        <Eye size={16} strokeWidth={1.8} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="pessoas-table-action-button"
                      onClick={() => handleAction(onEdit, registro)}
                      disabled={disableActions}
                      title="Editar registro"
                    >
                      <EditIcon size={16} strokeWidth={1.8} />
                    </button>

                    {typeof onHistory === 'function' ? (
                      <button
                        type="button"
                        className="pessoas-table-action-button"
                        onClick={() => handleAction(onHistory, registro)}
                        disabled={isSaving}
                        title="Historico"
                      >
                        <HistoryIcon size={16} strokeWidth={1.8} />
                      </button>
                    ) : null}

                    {typeof onDelete === 'function' ? (
                      <button
                        type="button"
                        className="pessoas-table-action-button"
                        onClick={() => handleAction(onDelete, registro)}
                        disabled={disableActions}
                        title="Cancelar registro"
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
