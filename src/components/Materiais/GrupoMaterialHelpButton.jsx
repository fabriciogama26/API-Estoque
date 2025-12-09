import { useEffect, useMemo, useState } from 'react'
import grupoHelp from '../../help/helpGrupoMaterial.json'
import { InfoIcon } from '../icons.jsx'
import '../../styles/help.css'
import '../../styles/MateriaisPage.css'

const normalizeGrupoHelp = (raw) => {
  const titulo = (raw?.titulo ?? raw?.title ?? '').trim() || 'Guia de grupos de material'
  const resumo =
    (raw?.resumo ?? raw?.summary ?? '').trim() ||
    'Use estes exemplos para escolher o grupo e o material corretos.'

  const grupos = Array.isArray(raw?.grupos)
    ? raw.grupos
        .map((item) => {
          const nome = (item?.grupo ?? item?.nome ?? '').trim()
          if (!nome) return null
          const descricao = (item?.descricao ?? '').trim()
          const materiais = Array.isArray(item?.materiais)
            ? item.materiais.map((material) => (material ?? '').trim()).filter(Boolean)
            : []
          return { nome, descricao, materiais }
        })
        .filter(Boolean)
    : []

  return { titulo, resumo, grupos }
}

export function GrupoMaterialHelpButton() {
  const [open, setOpen] = useState(false)
  const content = useMemo(() => normalizeGrupoHelp(grupoHelp), [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const close = (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
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
        aria-label="Ajuda sobre grupo de material"
        title="Ver ajuda de grupos"
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
          aria-label={`Ajuda sobre grupo de material - ${content.titulo}`}
          onClick={close}
        >
          <div className="help-modal grupo-help__modal" onClick={stopPropagation}>
            <header className="help-header">
              <div className="help-title">
                <p className="help-eyebrow">Ajuda do campo Grupo de material</p>
                <h3>{content.titulo}</h3>
              </div>
              <button
                type="button"
                className="help-close"
                onClick={close}
                aria-label="Fechar ajuda de grupos de material"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </header>

            <div className="help-body grupo-help__body">
              {content.resumo ? (
                <div className="grupo-help__intro">
                  <p>{content.resumo}</p>
                </div>
              ) : null}
              {content.grupos.length ? (
                <div className="grupo-help__grid">
                  {content.grupos.map((grupo) => (
                    <article key={grupo.nome} className="grupo-help-card">
                      <header className="grupo-help-card__header">
                        <h4>{grupo.nome}</h4>
                        <span className="grupo-help-card__badge">
                          <strong>{grupo.materiais.length}</strong>
                          <small>{grupo.materiais.length === 1 ? 'material' : 'materiais'}</small>
                        </span>
                      </header>
                      <div className="grupo-help-card__body">
                        {grupo.descricao ? <p className="grupo-help__description">{grupo.descricao}</p> : null}
                        {grupo.materiais.length ? (
                          <div className="grupo-help__list-box">
                            <p className="grupo-help__list-title">Materiais deste grupo</p>
                            <ul className="grupo-help__list">
                              {grupo.materiais.map((material) => (
                                <li key={`${grupo.nome}-${material}`}>{material}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="feedback grupo-help__empty">Nenhum material listado para este grupo.</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="feedback grupo-help__empty">
                  Nenhum conteudo encontrado em src/help/helpGrupoMaterial.json.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
