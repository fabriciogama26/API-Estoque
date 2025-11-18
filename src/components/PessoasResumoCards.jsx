import PropTypes from 'prop-types'
import { PeopleIcon, BarsIcon } from './icons.jsx'

const numberFormatter = new Intl.NumberFormat('pt-BR')

const normalizeKey = (value) => {
  if (!value && value !== 0) {
    return ''
  }
  return String(value).trim().toLowerCase()
}

const resolveDisplayValue = (value, fallback) => {
  if (!value && value !== 0) {
    return fallback
  }
  const texto = String(value).trim()
  return texto || fallback
}

function InsightCard({ title, icon: Icon, variant, value, helper }) {
  return (
    <section className={`dashboard-insight-card dashboard-insight-card--${variant}`}>
      <header className="dashboard-insight-card__header">
        <span className="dashboard-insight-card__title">{title}</span>
        <span className="dashboard-insight-card__avatar">
          <Icon size={22} />
        </span>
      </header>
      <strong className="dashboard-insight-card__value">{value}</strong>
      <span className="dashboard-insight-card__helper">{helper}</span>
    </section>
  )
}

InsightCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  variant: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  helper: PropTypes.string.isRequired,
}

function buildResumo(lista, filtroValor, extractor, fallbackHelper) {
  const valor = filtroValor ? String(filtroValor).trim() : ''
  const valorLower = valor.toLowerCase()
  if (!valor || valorLower === 'todos' || valorLower === 'todas') {
    return {
      value: '—',
      helper: fallbackHelper,
    }
  }
  const chave = normalizeKey(valor)
  const total = lista.filter((item) => normalizeKey(extractor(item)) === chave).length
  const label = resolveDisplayValue(valor, 'Nao informado')
  return {
    value: numberFormatter.format(total),
    helper: `${label}`,
  }
}

export function PessoasResumoCards({ pessoas, selectedCentro, selectedSetor }) {
  const lista = Array.isArray(pessoas) ? pessoas : []

  const centroResumo = buildResumo(
    lista,
    selectedCentro,
    (item) => item?.centroServico ?? item?.local ?? '',
    'Selecione um centro de serviço no filtro'
  )
  const setorResumo = buildResumo(
    lista,
    selectedSetor,
    (item) => item?.setor ?? '',
    'Selecione um setor no filtro'
  )

  return (
    <div className="dashboard-highlights pessoas-resumo-cards">
      <InsightCard
        title="Pessoas por centro de serviço"
        icon={PeopleIcon}
        variant="blue"
        value={centroResumo.value}
        helper={centroResumo.helper}
      />
      <InsightCard
        title="Pessoas por setor"
        icon={BarsIcon}
        variant="orange"
        value={setorResumo.value}
        helper={setorResumo.helper}
      />
    </div>
  )
}

PessoasResumoCards.propTypes = {
  pessoas: PropTypes.arrayOf(
    PropTypes.shape({
      centroServico: PropTypes.string,
      local: PropTypes.string,
      setor: PropTypes.string,
    })
  ),
  selectedCentro: PropTypes.string,
  selectedSetor: PropTypes.string,
}

PessoasResumoCards.defaultProps = {
  pessoas: [],
  selectedCentro: '',
  selectedSetor: '',
}
