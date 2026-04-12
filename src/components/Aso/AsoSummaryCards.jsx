import { AlertIcon, BarsIcon, ChecklistIcon } from '../icons.jsx'

const iconMap = {
  total: ChecklistIcon,
  '60': BarsIcon,
  '30': BarsIcon,
  '15': AlertIcon,
  hoje: AlertIcon,
  vencidos: AlertIcon,
  demissionais: ChecklistIcon,
}

export function AsoSummaryCards({ cards = [] }) {
  return (
    <div className="dashboard-highlights aso-summary-cards">
      {cards.map((card) => {
        const Icon = iconMap[card.id] || ChecklistIcon
        return (
          <section key={card.id} className={`dashboard-insight-card dashboard-insight-card--${card.variant}`}>
            <header className="dashboard-insight-card__header">
              <span className="dashboard-insight-card__title">{card.title}</span>
              <span className="dashboard-insight-card__avatar">
                <Icon size={22} />
              </span>
            </header>
            <strong className="dashboard-insight-card__value">{card.value}</strong>
            <span className="dashboard-insight-card__helper">Atualizado pelos registros carregados</span>
          </section>
        )
      })}
    </div>
  )
}
