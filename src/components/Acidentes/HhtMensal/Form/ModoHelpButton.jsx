import { useEffect, useState } from 'react'
import { InfoIcon } from '../../../icons.jsx'
import '../../../../styles/help.css'

const content = {
  titulo: 'Como escolher o modo',
  resumo:
    'Defina se o HHT final será digitado (manual) ou calculado automaticamente com base em pessoas, horas e ajustes.',
  itens: [
    {
      titulo: 'Manual',
      descricao: 'Digite diretamente o HHT final; o campo "HHT informado" se torna obrigatório.',
    },
    {
      titulo: 'Simples',
      descricao: 'Calcula apenas qtd. pessoas x horas base. Escala = 1 e demais campos zerados.',
    },
    {
      titulo: 'Completo',
      descricao:
        'Calcula com escala, descontos e extras. Base = pessoas * horas base * escala; descontos = afastamento + férias + treinamento + outros; HHT calculado = base - descontos + extras.',
    },
  ],
}

export function ModoHelpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
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
        onClick={() => setOpen(true)}
        aria-label="Ajuda sobre o modo de calculo"
        title="Ver ajuda sobre o modo"
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
          aria-label={`Ajuda sobre o modo de calculo - ${content.titulo}`}
          onClick={close}
        >
          <div className="help-modal agente-help__modal" onClick={stopPropagation}>
            <header className="help-header">
              <div className="help-title">
                <p className="help-eyebrow">Ajuda do campo Modo</p>
                <h3>{content.titulo}</h3>
              </div>
              <button type="button" className="help-close" onClick={close} aria-label="Fechar ajuda do modo">
                <span aria-hidden="true">&times;</span>
              </button>
            </header>

            <div className="help-body agente-help__body">
              {content.resumo ? (
                <div className="agente-help__intro">
                  <p>{content.resumo}</p>
                </div>
              ) : null}
              <div className="agente-help__grid">
                {content.itens.map((item) => (
                  <article key={item.titulo} className="agente-help-card">
                    <div className="agente-help-card__header">
                      <div className="agente-help-card__title-row">
                        <h4>{item.titulo}</h4>
                      </div>
                      {item.descricao ? (
                        <p className="agente-help-card__description">{item.descricao}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
