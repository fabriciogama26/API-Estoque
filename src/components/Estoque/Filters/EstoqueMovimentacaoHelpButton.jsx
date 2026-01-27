import { useEffect, useState } from 'react'
import { InfoIcon } from '../../icons.jsx'
import '../../../styles/help.css'

export function EstoqueMovimentacaoHelpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const close = (event) => {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    setOpen(false)
  }

  const stopPropagation = (event) => event.stopPropagation()

  return (
    <>
      <button
        type="button"
        className="help-inline-button"
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          setOpen(true)
        }}
        aria-label="Ajuda sobre movimentacao do periodo"
        title="Ver ajuda sobre movimentacao do periodo"
      >
        <span className="help-inline-button__icon">
          <InfoIcon size={14} />
        </span>
      </button>

      {open ? (
        <div
          className="help-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Ajuda sobre movimentacao do periodo"
          onClick={close}
        >
          <div className="help-modal" onClick={stopPropagation}>
            <header className="help-header">
              <div className="help-title">
                <p className="help-eyebrow">Movimentacao do periodo</p>
                <h3>Como o filtro funciona</h3>
              </div>
              <button type="button" className="help-close" onClick={close} aria-label="Fechar ajuda">
                <span aria-hidden="true">&times;</span>
              </button>
            </header>

            <div className="help-body">
              <ul className="help-bullets">
                <li>
                  <strong>Desligado (padrao):</strong> mostra o estoque fisico acumulado. O periodo nao e aplicado.
                </li>
                <li>
                  <strong>Ligado:</strong> aplica o periodo e mostra a movimentacao do intervalo (entradas - saidas).
                </li>
                <li>Com o periodo ligado, a lista exibe todos os materiais, mesmo sem movimentacao.</li>
                <li>Resumo e alertas seguem o modo selecionado.</li>
                <li>Itens cancelados nao entram no calculo.</li>
                <li>O CSV exporta sempre a posicao fisica acumulada.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
