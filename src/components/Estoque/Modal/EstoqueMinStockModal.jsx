import { CancelIcon } from '../../icons.jsx'

export function EstoqueMinStockModal({
  open,
  item,
  draftValue,
  error,
  isSaving,
  inputRef,
  onClose,
  onChange,
  onSave,
}) {
  if (!open || !item) {
    return null
  }

  const handleOverlayClick = () => {
    if (isSaving) return
    onClose?.()
  }

  return (
    <div
      className="estoque-min-stock-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Alterar estoque minimo"
      onClick={handleOverlayClick}
    >
      <div className="estoque-min-stock-modal__content" onClick={(event) => event.stopPropagation()}>
        <header className="estoque-min-stock-modal__header">
          <div>
            <p className="estoque-min-stock-modal__eyebrow">Material</p>
            <h3 className="estoque-min-stock-modal__title">{item.resumo || item.nome || '-'}</h3>
          </div>
          <button type="button" className="estoque-min-stock-modal__close" onClick={onClose} aria-label="Fechar">
            <CancelIcon size={18} />
          </button>
        </header>

        <div className="estoque-min-stock-modal__body">
          <label className="field">
            <span>Novo estoque minimo</span>
            <input
              ref={inputRef}
              type="number"
              min="0"
              value={draftValue}
              onChange={(event) => onChange(event.target.value)}
              disabled={isSaving}
            />
          </label>
          {error ? <p className="feedback feedback--error">{error}</p> : null}
        </div>

        <footer className="estoque-min-stock-modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="button" className="button button--primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
