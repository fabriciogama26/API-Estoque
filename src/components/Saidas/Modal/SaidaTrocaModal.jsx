export function SaidaTrocaModal({ open, details, onClose, onConfirm, isSaving }) {
  if (!open) {
    return null
  }

  const hasDetails = details?.ultimaSaidaId || details?.trocaSequencia

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true">
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>Saida com troca</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </header>
        <div className="modal__body">
          <p className="feedback feedback--warning">
            Ja existe uma saida deste material para esta pessoa. Deseja marcar esta nova saida como troca?
          </p>
          {hasDetails ? (
            <div className="card card--muted" style={{ marginTop: '0.5rem' }}>
              <strong>Detalhes encontrados:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem' }}>
                {details?.ultimaSaidaId ? (
                  <li style={{ wordBreak: 'break-all' }}>ID anterior: {details.ultimaSaidaId}</li>
                ) : null}
                {details?.trocaSequencia ? <li>Sequencia da troca: {details.trocaSequencia}</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
        <footer className="modal__footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="button" onClick={onConfirm} disabled={isSaving}>
            Considerar troca
          </button>
        </footer>
      </div>
    </div>
  )
}
