import PropTypes from 'prop-types'
import { TablePagination } from '../TablePagination.jsx'
import { HISTORY_PAGE_SIZE } from '../../config/pagination.js'
import { useHistoryPagination } from '../../hooks/useHistoryPagination.js'

const formatDateTime = (value) => {
  if (!value) {
    return 'Data nao informada'
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString('pt-BR')
    }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('pt-BR')
}

const formatValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'Nao informado'
  }
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Nao'
  }
  if (value instanceof Date) {
    return formatDateTime(value)
  }
  const isoLike = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
  if (isoLike) {
    return formatDateTime(value)
  }
  return String(value)
}

const buildChanges = (currentSnapshot, previousSnapshot) => {
  if (!previousSnapshot) {
    return []
  }
  const fields = [
    { key: 'materialResumo', label: 'Material' },
    { key: 'pessoaNome', label: 'Colaborador' },
    { key: 'pessoaCargo', label: 'Cargo' },
    { key: 'quantidade', label: 'Quantidade' },
    { key: 'status', label: 'Status' },
    { key: 'centroCusto', label: 'Centro de custo' },
    { key: 'centroServico', label: 'Centro de servico' },
    { key: 'dataEntrega', label: 'Data de entrega' },
    { key: 'dataTroca', label: 'Data de troca' },
    { key: 'isTroca', label: 'Troca' },
    { key: 'trocaSequencia', label: 'Sequencia de troca' },
    { key: 'trocaDeSaida', label: 'Troca de saida' },
  ]
  const prev = previousSnapshot || {}
  return fields
    .map(({ key, label }) => {
      const beforeRaw = prev[key]
      const afterRaw = currentSnapshot[key]
      const before =
        key === 'status' ? prev.statusNome || prev.status || prev.statusId || beforeRaw : beforeRaw
      const after =
        key === 'status' ? currentSnapshot.statusNome || currentSnapshot.status || currentSnapshot.statusId || afterRaw : afterRaw
      const normalizedBefore = formatValue(before)
      const normalizedAfter = formatValue(after)
      if (normalizedBefore === normalizedAfter) {
        return null
      }
      return {
        label,
        before: normalizedBefore,
        after: normalizedAfter,
      }
    })
    .filter(Boolean)
}

export function SaidasHistoryModal({ state, onClose }) {
  if (!state.open) {
    return null
  }

  const handleOverlayClick = () => {
    onClose()
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const { saida, registros = [], isLoading, error } = state
  const { pageItems, currentPage, pageSize, totalItems, setPage, startIndex } = useHistoryPagination(
    Array.isArray(registros) ? registros : [],
    HISTORY_PAGE_SIZE,
  )

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="entradas-history__modal" onClick={stopPropagation}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico de saidas</h3>
            <p className="entradas-history__subtitle">{saida ? saida.id : ''}</p>
          </div>
          <button type="button" className="entradas-history__close" onClick={onClose} aria-label="Fechar historico">
            x
          </button>
        </header>
        <div className="entradas-history__body">
          {isLoading ? (
            <p className="feedback">Carregando historico...</p>
          ) : error ? (
            <p className="feedback feedback--error">{error}</p>
          ) : registros.length === 0 ? (
            <p className="feedback">Nenhum historico registrado.</p>
          ) : (
            <>
              <ul className="entradas-history__list">
                {pageItems.map((item, index) => {
                  const rawSnapshot = item.snapshot ?? {}
                  const currentSnapshot = rawSnapshot.atual ?? rawSnapshot
                  const snapshotAnteriorDireto = rawSnapshot.anterior ?? null
                  const globalIndex = startIndex + index
                  const previousFallback =
                    globalIndex === totalItems - 1
                      ? null
                      : Array.isArray(registros) && registros[globalIndex + 1]
                        ? registros[globalIndex + 1]?.snapshot?.atual ?? registros[globalIndex + 1]?.snapshot ?? null
                        : null
                  const previous = snapshotAnteriorDireto || previousFallback
                  const changes = buildChanges(currentSnapshot, previous)
                  const anotacao =
                    currentSnapshot.motivoCancelamento ||
                    currentSnapshot.statusMotivo ||
                    rawSnapshot.motivoCancelamento ||
                    ''
                  return (
                    <li key={item.id} className="entradas-history__item">
                      <div className="entradas-history__item-header">
                        <div>
                          <strong>{formatDateTime(item.criadoEm)}</strong>
                          <p>{item.usuario || 'Responsavel nao informado'}</p>
                        </div>
                      </div>
                      <div className="entradas-history__item-body">
                        {changes.length === 0 ? (
                          <p className="feedback">Sem alteracoes registradas.</p>
                        ) : (
                            changes.map((change) => (
                              <p key={`${item.id}-${change.label}`}>
                                <strong>{change.label}:</strong> "{change.before}" → "{change.after}"
                              </p>
                            ))
                        )}
                        {anotacao ? (
                          <p className="entradas-history__note">
                            <strong>Motivo:</strong> {anotacao}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <TablePagination
                totalItems={totalItems}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

SaidasHistoryModal.propTypes = {
  state: PropTypes.shape({
    open: PropTypes.bool,
    saida: PropTypes.object,
    registros: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool,
    error: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
}
