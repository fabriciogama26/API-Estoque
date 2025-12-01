import { InfoIcon } from '../../icons.jsx'

export function EstoqueSummary({ cards }) {
  return (
    <div className="estoque-summary-grid">
      {cards.map((card) => (
        <article
          key={card.id}
          className={`estoque-summary-card estoque-summary-card--${card.accent}${
            card.tooltip ? ' estoque-summary-card--has-tooltip' : ''
          }`}
        >
          {card.tooltip ? (
            <div className="summary-tooltip summary-tooltip--floating" role="tooltip">
              <InfoIcon size={16} aria-hidden="true" />
              <span>{card.tooltip}</span>
            </div>
          ) : null}
          <div className="estoque-summary-card__header">
            <span className="estoque-summary-card__title">{card.title}</span>
            <span className="estoque-summary-card__icon" aria-hidden="true">
              {card.icon}
            </span>
          </div>
          <strong className="estoque-summary-card__value">{card.value}</strong>
          <span className="estoque-summary-card__hint">{card.hint}</span>
        </article>
      ))}
    </div>
  )
}
