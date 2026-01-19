import { CancelIcon } from '../icons.jsx'

export function ChartExpandModal({ open, title, onClose, children }) {
  if (!open) {
    return null
  }

  return (
    <div className="chart-modal__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chart-modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="chart-modal__header">
          <h3 className="chart-modal__title">{title}</h3>
          <button type="button" className="chart-modal__close" onClick={onClose} aria-label="Fechar grafico expandido">
            <CancelIcon size={18} />
          </button>
        </header>
        <div className="chart-modal__body">{children}</div>
      </div>
    </div>
  )
}
