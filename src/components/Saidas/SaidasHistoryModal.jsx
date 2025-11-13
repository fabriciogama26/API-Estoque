import PropTypes from 'prop-types'

const formatDateTime = (value) => {
  if (!value) {
    return 'Data nao informada'
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
  if (value instanceof Date) {
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
  ]
  const prev = previousSnapshot || {}
  return fields
    .map(({ key, label }) => {
      const before = prev[key]
      const after = currentSnapshot[key]
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

  return (
    <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={handleOverlayClick}>
      <div className="entradas-history__modal" onClick={stopPropagation}>
        <header className="entradas-history__header">
          <div>
            <h3>Historico da saida</h3>
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
            <ul className="entradas-history__list">
              {registros.map((item, index) => {
                const rawSnapshot = item.snapshot ?? {}
                const currentSnapshot = rawSnapshot.atual ?? rawSnapshot
                const snapshotAnteriorDireto = rawSnapshot.anterior ?? null
                const previousFallback =
                  index === registros.length - 1
                    ? null
                    : registros[index + 1]?.snapshot?.atual ?? registros[index + 1]?.snapshot ?? null
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
