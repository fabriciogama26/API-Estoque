import { useEffect, useMemo, useState } from 'react'
import agentesHelp from '../../../help/helpAcidentesAgentes.json'
import { InfoIcon } from '../../icons.jsx'
import '../../../styles/help.css'
import '../../../styles/AcidentesPage.css'

const normalizeAgentesHelp = (raw) => {
  const titulo = (raw?.titulo ?? raw?.title ?? '').trim() || 'Agentes do acidente'
  const resumo =
    (raw?.resumo ?? raw?.summary ?? '').trim() ||
    'Veja exemplos de agentes e tipos para escolher o que melhor descreve o evento.'

  const agentes = Array.isArray(raw?.agentes)
    ? raw.agentes
        .map((item) => {
          const nome = (item?.agente ?? '').trim()
          if (!nome) {
            return null
          }
          const descricao = (item?.descricao ?? '').trim()
          const tipos = Array.isArray(item?.tipos)
            ? item.tipos
                .map((tipo) => {
                  const nomeTipo = (tipo?.tipo ?? '').trim()
                  if (!nomeTipo) {
                    return null
                  }
                  const lesoes = Array.isArray(tipo?.lesoes)
                    ? tipo.lesoes.map((lesao) => (lesao ?? '').trim()).filter(Boolean)
                    : []
                  return { nome: nomeTipo, lesoes }
                })
                .filter(Boolean)
            : []
          return { nome, descricao, tipos }
        })
        .filter(Boolean)
    : []

  return { titulo, resumo, agentes }
}

export function AgenteHelpButton() {
  const [open, setOpen] = useState(false)
  const content = useMemo(() => normalizeAgentesHelp(agentesHelp), [])

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
        onClick={() => setOpen(true)}
        aria-label="Ajuda sobre agentes do acidente"
        title="Ver ajuda sobre agentes"
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
          aria-label={`Ajuda sobre agentes do acidente - ${content.titulo}`}
          onClick={close}
        >
          <div className="help-modal agente-help__modal" onClick={stopPropagation}>
            <header className="help-header">
              <div className="help-title">
                <p className="help-eyebrow">Ajuda do campo Agente</p>
                <h3>{content.titulo}</h3>
              </div>
              <button type="button" className="help-close" onClick={close} aria-label="Fechar ajuda de agente">
                <span aria-hidden="true">&times;</span>
              </button>
            </header>

            <div className="help-body agente-help__body">
              {content.resumo ? (
                <div className="agente-help__intro">
                  <p>{content.resumo}</p>
                </div>
              ) : null}

              {content.agentes.length ? (
                <div className="agente-help__grid">
                  {content.agentes.map((agente) => (
                    <article key={agente.nome} className="agente-help-card">
                      <div className="agente-help-card__header">
                        <div className="agente-help-card__title-row">
                          <h4>{agente.nome}</h4>
                          <span className="agente-help-card__badge">{agente.tipos.length} tipos</span>
                        </div>
                        {agente.descricao ? (
                          <p className="agente-help-card__description">{agente.descricao}</p>
                        ) : null}
                      </div>

                      <div className="agente-help-card__types">
                        {agente.tipos.map((tipo) => (
                          <div key={`${agente.nome}-${tipo.nome}`} className="agente-help-type">
                            <div className="agente-help-type__header">
                              <strong className="agente-help-type__title">{tipo.nome}</strong>
                              {tipo.lesoes.length ? (
                                <span className="agente-help-type__hint">
                                  Lesoes mais registradas com este agente
                                </span>
                              ) : null}
                            </div>
                            {tipo.lesoes.length ? (
                              <ul className="agente-help-type__lesoes">
                                {tipo.lesoes.map((lesao) => (
                                  <li key={`${tipo.nome}-${lesao}`}>{lesao}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="agente-help-type__empty">Sem lesoes cadastradas para este tipo.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="feedback agente-help__empty">
                  Nenhum conteudo de agentes encontrado em src/help/helpAcidentesAgentes.json.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
