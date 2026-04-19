import { buildAsoHistoryChanges, formatDateTime, resolveAsoHistoryActionLabel } from '../../utils/asoUtils.js'

export function AsoHistoryTimeline({ registros = [] }) {
  return (
    <div className="aso-history-timeline">
      {registros.map((registro) => {
        const changes = buildAsoHistoryChanges(registro)
        return (
          <article key={registro.id} className="aso-history-entry">
            <header className="aso-history-entry__header">
              <div>
                <strong>{registro.acaoLabel || resolveAsoHistoryActionLabel(registro.acao) || 'acao nao informada'}</strong>
                <p className="data-table__muted">
                  {registro.usuarioResponsavel || 'sistema'} | {formatDateTime(registro.criadoEm)}
                </p>
              </div>
            </header>

            {registro.observacao ? (
              <p className="aso-history-entry__note">
                <strong>Observacao:</strong> {registro.observacao}
              </p>
            ) : null}

            {changes.length === 0 ? (
              <p className="feedback">Nenhuma alteracao registrada.</p>
            ) : (
              <ul className="aso-history-entry__changes">
                {changes.map((change, index) => (
                  <li key={`${registro.id}-${index}`}>
                    <strong>{change.campo}</strong>
                    <span>De: {change.de}</span>
                    <span>Para: {change.para}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )
      })}
    </div>
  )
}
