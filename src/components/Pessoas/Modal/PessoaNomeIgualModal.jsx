export function PessoaNomeIgualModal({ open, details, onCancel, onConfirm }) {
  if (!open) {
    return null
  }

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true">
      <div className="modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="modal__header">
          <h3>Pessoa com nome igual</h3>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Fechar">
            x
          </button>
        </header>
        <div className="modal__body">
          <p className="feedback feedback--warning">
            Ja existe pessoa com o mesmo nome mas com matricula diferente. Deseja salvar mesmo assim?
          </p>
          {Array.isArray(details) && details.length ? (
            <div className="card card--muted" style={{ marginTop: '0.5rem' }}>
              <strong>IDs encontrados:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem' }}>
                {details.map((id) => (
                  <li key={id} style={{ wordBreak: 'break-all' }}>
                    {id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <footer className="modal__footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="button" onClick={onConfirm}>
            Salvar mesmo assim
          </button>
        </footer>
      </div>
    </div>
  )
}
