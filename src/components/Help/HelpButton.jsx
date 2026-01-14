import { useMemo, useState } from 'react'
import helpAcidentes from '../../help/helpAcidentes.json'
import helpDashboard from '../../help/helpDashboard.json'
import helpDashboardAcidentes from '../../help/helpDashboardAcidentes.json'
import helpEntradas from '../../help/helpEntradas.json'
import helpEstoque from '../../help/helpEstoque.json'
import helpMateriais from '../../help/helpMateriais.json'
import helpPessoas from '../../help/helpPessoas.json'
import helpSaidas from '../../help/helpSaidas.json'
import helpHhtMensal from '../../help/helpHhtMensal.json'
import helpTermoEpi from '../../help/helpTermoEpi.json'
import helpConfiguracoes from '../../help/helpConfiguracoes.json'
import { HelpIcon, InfoIcon } from '../icons.jsx'
import '../../styles/help.css'

const buildFallback = (topic) => ({
  title: 'Ajuda nao configurada',
  summary: `Adicione o topico "${topic || 'novo-topico'}" no arquivo de ajuda desta pagina em src/help/.`,
  steps: [],
  notes: [],
  links: [],
})

const helpByTopic = {
  acidentes: helpAcidentes,
  dashboard: helpDashboard,
  dashboardAcidentes: helpDashboardAcidentes,
  entradas: helpEntradas,
  estoque: helpEstoque,
  materiais: helpMateriais,
  pessoas: helpPessoas,
  saidas: helpSaidas,
  hhtMensal: helpHhtMensal,
  termoEpi: helpTermoEpi,
  configuracoes: helpConfiguracoes,
}

const resolveContent = (topic) => {
  const candidate = helpByTopic?.[topic]
  const raw = candidate?.[topic] ?? candidate
  if (!raw) return null

  const normalized = { ...raw }

  // Se nao houver steps, mas houver sections (arquivo por pagina), converte sections em steps
  if ((!normalized.steps || !normalized.steps.length) && Array.isArray(normalized.sections)) {
    normalized.steps = normalized.sections.map((section) => ({
      title: section.title,
      items: section.items,
      description: section.description,
    }))
  }

  // Garante arrays
  if (!Array.isArray(normalized.steps)) normalized.steps = []
  if (!Array.isArray(normalized.notes)) normalized.notes = normalized.notes ? [normalized.notes] : []
  if (!Array.isArray(normalized.links)) normalized.links = normalized.links ? [normalized.links].flat() : []

  return normalized
}

export function HelpButton({ topic, label = 'Ajuda', size = 'md' }) {
  const [open, setOpen] = useState(false)
  const content = resolveContent(topic)

  const handleClose = () => setOpen(false)
  const handleOpen = () => setOpen(true)

  return (
    <>
      <button
        type="button"
        className={`button button--ghost help-trigger help-trigger--${size}`}
        onClick={handleOpen}
        aria-label="Abrir ajuda da pagina"
      >
        <HelpIcon size={16} />
        <span>{label}</span>
      </button>
      <HelpDialog open={open} onClose={handleClose} content={content} topic={topic} />
    </>
  )
}

function HelpDialog({ open, onClose, content, topic }) {
  const resolvedContent = useMemo(() => content ?? buildFallback(topic), [content, topic])

  if (!open) {
    return null
  }

  const { title, summary, steps = [], notes = [], links = [] } = resolvedContent
  const hasContent = Boolean(content)

  const requiredNote = 'Campos marcados com * são obrigatórios.'
  const mergedNotes = Array.isArray(notes) ? [...notes] : []
  if (!mergedNotes.includes(requiredNote)) {
    mergedNotes.push(requiredNote)
  }

  const handleOverlayClick = () => {
    onClose?.()
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  return (
    <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Ajuda da pagina ${title || ''}`}
      onClick={handleOverlayClick}
    >
      <div className="help-modal" onClick={stopPropagation}>
        <header className="help-header">
          <div className="help-title">
            <p className="help-eyebrow">{hasContent ? 'Ajuda desta pagina' : 'Ajuda nao configurada'}</p>
            <h3>{title || 'Conteudo nao encontrado'}</h3>
            {summary ? <p className="help-summary">{summary}</p> : null}
            {!hasContent ? (
              <p className="help-warning">
                Adicione o topico "{topic}" em src/help/helpContent.json para exibir instrucoes especificas aqui.
              </p>
            ) : null}
          </div>
          <button type="button" className="help-close" onClick={onClose} aria-label="Fechar ajuda">
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="help-body">
          {steps.length ? (
            <ol className="help-steps">
              {steps.map((step, index) => (
                <li key={step.title || index} className="help-step">
                  <div className="help-step__badge">{String(index + 1).padStart(2, '0')}</div>
                  <div className="help-step__content">
                    <div className="help-step__header">
                      <h4>{step.title || `Passo ${index + 1}`}</h4>
                      {step.duration ? <span className="help-chip">{step.duration}</span> : null}
                    </div>
                    {step.description ? <p className="help-step__description">{step.description}</p> : null}
                    {Array.isArray(step.items) && step.items.length ? (
                      <ul className="help-bullets">
                        {step.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {step.media || step.mediaHint ? (
                      <figure className={`help-step__media${step.media ? '' : ' help-step__media--placeholder'}`}>
                        {step.media ? (
                          <img
                            src={step.media}
                            alt={step.mediaAlt || step.title || `Passo ${index + 1}`}
                            loading="lazy"
                          />
                        ) : null}
                        {!step.media && step.mediaHint ? (
                          <div className="help-step__placeholder">{step.mediaHint}</div>
                        ) : null}
                        {step.mediaCaption ? <figcaption>{step.mediaCaption}</figcaption> : null}
                      </figure>
                    ) : null}
                    {Array.isArray(step.tips) && step.tips.length ? (
                      <div className="help-step__tips">
                        <InfoIcon size={14} />
                        <ul>
                          {step.tips.map((tip, tipIndex) => (
                            <li key={tipIndex}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="feedback">Nenhum passo cadastrado para esta pagina.</p>
          )}

          {mergedNotes.length ? (
            <div className="help-notes">
              <h4>Notas rapidas</h4>
              <ul>
                {mergedNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {links.length ? (
            <div className="help-links">
              <h4>Referencias</h4>
              <div className="help-links__grid">
                {links.map((link) => (
                  <a key={link.href || link.label} href={link.href} target="_blank" rel="noreferrer">
                    {link.label || link.href}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
