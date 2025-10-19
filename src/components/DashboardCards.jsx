import PropTypes from 'prop-types'
import { AlertIcon, TrendIcon, MovementIcon, BarsIcon, PieIcon } from './icons.jsx'
import { resolveIndicadorValor } from '../utils/indicadores.js'

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CARD_DEFINITIONS = [
  {
    id: 'total_acidentes',
    label: 'Total de Acidentes',
    icon: AlertIcon,
    variant: 'red',
    valueKeys: ['total_acidentes', 'totalAcidentes', 'acidentes'],
    formatter: integerFormatter,
  },
  {
    id: 'dias_perdidos',
    label: 'Dias Perdidos',
    icon: TrendIcon,
    variant: 'orange',
    valueKeys: ['dias_perdidos', 'diasPerdidos', 'total_dias_perdidos'],
    formatter: integerFormatter,
  },
  {
    id: 'hht_total',
    label: 'HHT Total',
    icon: MovementIcon,
    variant: 'blue',
    valueKeys: ['hht_total', 'hhtTotal', 'total_hht'],
    formatter: integerFormatter,
  },
  {
    id: 'taxa_frequencia',
    label: 'Taxa de Frequência (TF)',
    icon: BarsIcon,
    variant: 'slate',
    valueKeys: ['taxa_frequencia', 'taxaFrequencia', 'tf'],
    formatter: decimalFormatter,
    suffix: '',
  },
  {
    id: 'taxa_gravidade',
    label: 'Taxa de Gravidade (TG)',
    icon: PieIcon,
    variant: 'green',
    valueKeys: ['taxa_gravidade', 'taxaGravidade', 'tg'],
    formatter: decimalFormatter,
    suffix: '',
  },
]

function formatValue(value, formatter) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (Number.isNaN(parsed)) {
    return String(value)
  }
  return formatter.format(parsed)
}

export function DashboardCards({ indicadores, helperText }) {
  const periodoHelper = helperText || indicadores?.periodo_label || indicadores?.periodo || indicadores?.referencia

  return (
    <section className="dashboard-highlights">
    {CARD_DEFINITIONS.map(({ id, label, icon, variant, valueKeys, formatter, suffix }) => {
      const IconComponent = icon
      const valor = resolveIndicadorValor(indicadores, valueKeys)
      const formattedValue = formatValue(valor, formatter)

      return (
        <article key={id} className={`dashboard-insight-card dashboard-insight-card--${variant}`}>
          <header className="dashboard-insight-card__header">
            <span className="dashboard-insight-card__title">{label}</span>
            <span className="dashboard-insight-card__avatar">
              <IconComponent size={22} />
            </span>
            </header>
            <strong className="dashboard-insight-card__value">
              {formattedValue}
              {suffix}
            </strong>
            {periodoHelper ? (
              <span className="dashboard-insight-card__helper">{periodoHelper}</span>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}

DashboardCards.propTypes = {
  indicadores: PropTypes.object,
  helperText: PropTypes.string,
}

DashboardCards.defaultProps = {
  indicadores: {},
  helperText: undefined,
}
