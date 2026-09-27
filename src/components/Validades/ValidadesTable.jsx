import EyeOffIcon from 'lucide-react/dist/esm/icons/eye-off.js'
import PlusCircleIcon from 'lucide-react/dist/esm/icons/plus-circle.js'
import RotateCwIcon from 'lucide-react/dist/esm/icons/rotate-cw.js'
import UndoIcon from 'lucide-react/dist/esm/icons/undo-2.js'
import { TablePagination } from '../TablePagination.jsx'
import { CancelIcon, EditIcon, HistoryIcon } from '../icons.jsx'
import { ValidadeStatusChip } from './ValidadeStatusChip.jsx'
import { VALIDADES_PAGE_SIZE } from '../../config/ValidadesConfig.js'
import {
  formatDate,
  formatDiasRestantes,
  resolveCategoriaLabel,
  resolveExigenciaLabel,
  resolveStatusMeta,
} from '../../utils/validadesUtils.js'

function Acoes({ item, permissoes, onRegistrar, onRenovar, onEditar, onCancelar, onDispensar, onRevogarDispensa, onHistorico }) {
  const temRegistro = Boolean(item.realizacao_id)
  const dispensado = item.exigencia === 'dispensado'
  const rotulo = `${item.pessoa_nome} - ${item.requisito_nome}`

  return (
    <div className="materiais-data-table__actions">
      {!temRegistro && !dispensado ? (
        <button
          type="button"
          className="materiais-table-action-button"
          onClick={() => onRegistrar(item)}
          disabled={!permissoes.registrar}
          title="Registrar realizacao"
          aria-label={`Registrar realizacao de ${rotulo}`}
        >
          <PlusCircleIcon size={16} strokeWidth={1.8} />
        </button>
      ) : null}
      {temRegistro ? (
        <>
          <button
            type="button"
            className="materiais-table-action-button"
            onClick={() => onRenovar(item)}
            disabled={!permissoes.renovar}
            title="Renovar"
            aria-label={`Renovar ${rotulo}`}
          >
            <RotateCwIcon size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="materiais-table-action-button"
            onClick={() => onEditar(item)}
            disabled={!permissoes.registrar}
            title="Editar registro"
            aria-label={`Editar registro de ${rotulo}`}
          >
            <EditIcon size={16} />
          </button>
          <button
            type="button"
            className="materiais-table-action-button materiais-table-action-button--danger"
            onClick={() => onCancelar(item)}
            disabled={!permissoes.registrar}
            title="Cancelar registro"
            aria-label={`Cancelar registro de ${rotulo}`}
          >
            <CancelIcon size={16} />
          </button>
        </>
      ) : null}
      {dispensado ? (
        <button
          type="button"
          className="materiais-table-action-button"
          onClick={() => onRevogarDispensa(item)}
          disabled={!permissoes.gerenciarRequisitos}
          title="Revogar dispensa"
          aria-label={`Revogar dispensa de ${rotulo}`}
        >
          <UndoIcon size={16} strokeWidth={1.8} />
        </button>
      ) : null}
      {item.exigencia === 'exigido' ? (
        <button
          type="button"
          className="materiais-table-action-button"
          onClick={() => onDispensar(item)}
          disabled={!permissoes.gerenciarRequisitos}
          title="Dispensar colaborador deste requisito"
          aria-label={`Dispensar ${rotulo}`}
        >
          <EyeOffIcon size={16} strokeWidth={1.8} />
        </button>
      ) : null}
      <button
        type="button"
        className="materiais-table-action-button"
        onClick={() => onHistorico(item)}
        title="Historico"
        aria-label={`Historico de ${rotulo}`}
      >
        <HistoryIcon size={16} />
      </button>
    </div>
  )
}

export function ValidadesTable({ itens, total, page, onPageChange, permissoes, ...acoes }) {
  if (!itens.length) {
    return <p className="feedback">Nenhum registro para os filtros aplicados.</p>
  }

  return (
    <>
      <div className="saidas-legend" aria-label="Legenda de status">
        {['vencido', 'vence_hoje', 'proximo_vencimento', 'pendente', 'valido'].map((status) => (
          <div key={status} className="saidas-legend__item">
            <span className="saidas-legend__dot" style={{ background: resolveStatusMeta(status).color }} aria-hidden="true" />
            <span>{resolveStatusMeta(status).label}</span>
          </div>
        ))}
      </div>

      <div className="table-wrapper">
        <table className="data-table data-table--saidas">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Matricula</th>
              <th>Requisito</th>
              <th>Categoria</th>
              <th>Realizacao</th>
              <th>Vencimento</th>
              <th>Dias restantes</th>
              <th>Status</th>
              <th>Origem</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr
                key={`${item.pessoa_id}-${item.requisito_id}`}
                className={`validades-row--${resolveStatusMeta(item.status).variant}`}
              >
                <td>
                  <strong>{item.pessoa_nome}</strong>
                  <p className="data-table__muted">
                    {[item.cargo, item.setor, item.centro_servico, item.centro_custo].filter(Boolean).join(' | ') || '-'}
                  </p>
                </td>
                <td>{item.matricula || '-'}</td>
                <td>
                  <strong>{item.requisito_nome}</strong>
                  {item.requisito_codigo ? <p className="data-table__muted">{item.requisito_codigo}</p> : null}
                </td>
                <td>{resolveCategoriaLabel(item.categoria)}</td>
                <td>{item.data_realizacao ? formatDate(item.data_realizacao) : '-'}</td>
                <td>{item.data_vencimento ? formatDate(item.data_vencimento) : '-'}</td>
                <td>{formatDiasRestantes(item.dias_restantes)}</td>
                <td>
                  <ValidadeStatusChip status={item.status} />
                  {item.exigencia !== 'exigido' ? (
                    <p className="data-table__muted">{resolveExigenciaLabel(item.exigencia)}</p>
                  ) : null}
                </td>
                <td>
                  <span className="data-table__muted">{(item.origens || []).join(' | ') || '-'}</span>
                </td>
                <td>
                  <Acoes item={item} permissoes={permissoes} {...acoes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination totalItems={total} pageSize={VALIDADES_PAGE_SIZE} currentPage={page} onPageChange={onPageChange} />
    </>
  )
}
