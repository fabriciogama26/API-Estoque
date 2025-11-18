import PropTypes from 'prop-types'
import { AlertIcon, TrendIcon, MovementIcon, BarsIcon, PieIcon, InfoIcon } from './icons.jsx'
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
    tooltip: 'Total geral de acidentes registrados para o periodo filtrado.',
  },
  {
    id: 'dias_perdidos',
    label: 'Dias Perdidos',
    icon: TrendIcon,
    variant: 'orange',
    valueKeys: ['dias_perdidos', 'diasPerdidos', 'total_dias_perdidos'],
    formatter: integerFormatter,
    tooltip: 'Soma dos dias perdidos informados nas fichas de acidente.',
  },
  {
    id: 'hht_total',
    label: 'HHT Total',
    icon: MovementIcon,
    variant: 'blue',
    valueKeys: ['hht_total', 'hhtTotal', 'total_hht'],
    formatter: integerFormatter,
    tooltip: 'Horas-homem trabalhadas usadas nas taxas de frequencia/gravidade.',
  },
  {
    id: 'taxa_frequencia_total',
    label: 'Taxa de Frequencia (TF)',
    icon: BarsIcon,
    variant: 'slate',
    valueKeys: ['taxa_frequencia_afastamento', 'taxaFrequenciaAfastamento', 'tf_afastamento'],
    formatter: decimalFormatter,
    secondaryValueKeys: ['taxa_frequencia_sem_afastamento', 'taxaFrequenciaSemAfastamento', 'tf_sem_afastamento'],
    secondaryLabel: 'Com afastamento / Sem afastamento',
    suffix: '',
    tooltip:
      'TF calculada apenas com acidentes com afastamento e TF com acidentes sem afastamento (dias perdidos = 0).',
  },
  {
    id: 'taxa_gravidade',
    label: 'Taxa de Gravidade (TG)',
    icon: PieIcon,
    variant: 'green',
    valueKeys: ['taxa_gravidade', 'taxaGravidade', 'tg'],
    formatter: decimalFormatter,
    suffix: '',
    tooltip: 'TG = (Dias perdidos x 1.000.000) / HHT informado.',
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
  const defaultHelper = helperText || indicadores?.periodo_label || indicadores?.periodo || indicadores?.referencia

  return (
    <section className="dashboard-highlights">
      {CARD_DEFINITIONS.map(
        ({
          id,
          label,
          icon,
          variant,
          valueKeys,
          secondaryValueKeys,
          secondaryLabel,
          formatter,
          suffix,
          tooltip,
        }) => {
          const IconComponent = icon
          const primaryValue = formatValue(resolveIndicadorValor(indicadores, valueKeys), formatter)
          const secondaryRaw = secondaryValueKeys ? resolveIndicadorValor(indicadores, secondaryValueKeys) : null
          const secondaryValue = secondaryValueKeys ? formatValue(secondaryRaw, formatter) : null
          const helperTexts = []
          if (secondaryLabel) {
            helperTexts.push(secondaryLabel)
          }
          if (defaultHelper) {
            helperTexts.push(defaultHelper)
          }

          return (
            <article
              key={id}
              className={`dashboard-insight-card dashboard-insight-card--${variant}${
                tooltip ? ' dashboard-insight-card--has-tooltip' : ''
              }`}
            >
              {tooltip ? (
                <div className="summary-tooltip summary-tooltip--floating" role="tooltip">
                  <InfoIcon size={16} />
                  <span>{tooltip}</span>
                </div>
              ) : null}
              <header className="dashboard-insight-card__header">
                <span className="dashboard-insight-card__title">{label}</span>
                <span className="dashboard-insight-card__avatar">
                  <IconComponent size={22} />
                </span>
              </header>
              <strong className="dashboard-insight-card__value">
                {secondaryValue ? `${primaryValue} / ${secondaryValue}` : primaryValue}
                {suffix}
              </strong>
              {helperTexts.map((text, index) => (
                <span key={`${id}-helper-${index}`} className="dashboard-insight-card__helper">
                  {text}
                </span>
              ))}
            </article>
          )
        }
      )}
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
