import { AutoResizeIframe } from '../AutoResizeIframe.jsx'
import '../../styles/DocumentPreviewModal.css'

export function TermoEpiPreviewModal({
  state,
  onClose,
  onDownload,
  onRetry,
  downloadLabel = 'Baixar PDF',
  securityContext = null,
}) {
  if (!state?.open) {
    return null
  }

  const { isLoading, isDownloading, error, html, colaborador } = state
  const canDownload = Boolean(html) && !isLoading && !isDownloading

  const handleOverlayClick = () => {
    if (!isDownloading) {
      onClose?.()
    }
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  return (
    <div
      className="document-preview__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      onClick={handleOverlayClick}
    >
      <div className="document-preview__modal" onClick={stopPropagation}>
        <header className="document-preview__header">
          <h3 id="document-preview-title">
            Termo de EPI{colaborador?.nome ? ` - ${colaborador.nome}` : ''}
          </h3>
          <button
            type="button"
            className="document-preview__close"
            onClick={onClose}
            aria-label="Fechar visualizacao do termo"
            disabled={isDownloading}
          >
            x
          </button>
        </header>
        <div className="document-preview__body">
          {isLoading ? (
            <p className="feedback">Gerando visualizacao...</p>
          ) : error ? (
            <div className="document-preview__error">
              <p className="feedback feedback--error">{error}</p>
              {typeof onRetry === 'function' ? (
                <button type="button" className="button button--ghost" onClick={onRetry}>
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : html ? (
            <AutoResizeIframe
              title="Visualizacao do termo de responsabilidade de EPI"
              className="document-preview__frame"
              loading="lazy"
              srcDoc={html}
              trusted
              securityContext={securityContext}
            />
          ) : (
            <p className="feedback">Nenhum conteudo disponivel para exibir.</p>
          )}
        </div>
        <footer className="document-preview__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={isDownloading}>
            Fechar
          </button>
          <button type="button" className="button button--primary" onClick={onDownload} disabled={!canDownload}>
            {isDownloading ? 'Baixando...' : downloadLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
