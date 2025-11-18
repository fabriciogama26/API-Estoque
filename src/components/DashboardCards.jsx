import PropTypes from 'prop-types'
import { AlertIcon, TrendIcon, MovementIcon, BarsIcon, PieIcon, InfoIcon } from './icons.jsx'
import { resolveIndicadorValor, getOitClassification } from '../utils/indicadores.js'

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PRIMARY_CARD_DEFINITIONS = [
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
    oitType: 'frequency',
    tooltip:
      'TF calculada apenas com acidentes com afastamento e TF com acidentes sem afastamento (dias perdidos = 0). Referência OIT: até 20 muito bom, 20,1 a 40 bom, 40,1 a 60 ruim e acima de 60 péssimo.',
  },
  {
    id: 'taxa_gravidade',
    label: 'Taxa de Gravidade (TG)',
    icon: PieIcon,
    variant: 'green',
    valueKeys: ['taxa_gravidade', 'taxaGravidade', 'tg'],
    formatter: decimalFormatter,
    suffix: '',
    oitType: 'severity',
    tooltip:
      'TG = (Dias perdidos x 1.000.000) / HHT informado. Referência OIT: até 500 muito bom, 500,01 a 1.000 bom, 1.000,01 a 2.000 ruim e acima de 2.000 péssimo.',
  },
]

const SECONDARY_CARD_DEFINITIONS = [
  {
    id: 'indice_acidentados',
    label: 'IA - Índice de Acidentados',
    icon: AlertIcon,
    variant: 'red',
    valueKeys: ['indice_acidentados', 'indiceAcidentados', 'ia'],
    formatter: decimalFormatter,
    suffix: '',
    description: 'Proporção de acidentados em relação às horas trabalhadas.',
    tooltip:
      'IA = (Taxa de Frequência + Taxa de Gravidade) / 100.',
  },
  {
    id: 'indice_avaliacao_gravidade',
    label: 'IAG - Índice de Avaliação de Gravidade',
    icon: TrendIcon,
    variant: 'orange',
    valueKeys: ['indice_avaliacao_gravidade', 'indiceAvaliacaoGravidade', 'iag'],
    formatter: decimalFormatter,
    suffix: '',
    description: 'Gravidade média dos acidentes com afastamento.',
    tooltip:
      'IAG = (Dias perdidos + dias debitados) / número de acidentes com afastamento.',
  },
  {
    id: 'indice_relativo_acidentes',
    label: 'IRA - Índice Relativo de Acidentes',
    icon: MovementIcon,
    variant: 'blue',
    valueKeys: ['indice_relativo_acidentes', 'indiceRelativoAcidentes', 'ira'],
    formatter: decimalFormatter,
    suffix: '',
    description: 'Acidentes por mil trabalhadores (comparação entre unidades).',
    tooltip:
      'IRA = (Número de acidentados com afastamento x 1.000) / total de trabalhadores.',
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

  const renderCard = ({
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
    oitType,
    description,
  }) => {
    const IconComponent = icon
    const primaryRaw = resolveIndicadorValor(indicadores, valueKeys)
    const primaryValue = formatValue(primaryRaw, formatter)
    const secondaryRaw = secondaryValueKeys ? resolveIndicadorValor(indicadores, secondaryValueKeys) : null
    const secondaryValue = secondaryValueKeys ? formatValue(secondaryRaw, formatter) : null
    const helperTexts = []
    const oitClassification = oitType ? getOitClassification(oitType, primaryRaw) : null
    if (description) {
      helperTexts.push(description)
    }
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
        {oitClassification ? (
          <span
            className={`oit-badge oit-badge--${oitClassification.level}`}
            title={`Faixa OIT: ${oitClassification.range}`}
          >
            <span className="oit-badge__label">Referência OIT</span>
            <strong>{oitClassification.label}</strong>
          </span>
        ) : null}
        {helperTexts.map((text, index) => (
          <span key={`${id}-helper-${index}`} className="dashboard-insight-card__helper">
            {text}
          </span>
        ))}
      </article>
    )
  }

  return (
    <>
      <section className="dashboard-highlights">
        {PRIMARY_CARD_DEFINITIONS.map((definition) => renderCard(definition))}
      </section>
      <section className="dashboard-highlights dashboard-highlights--secondary">
        {SECONDARY_CARD_DEFINITIONS.map((definition) => renderCard(definition))}
      </section>
    </>
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
