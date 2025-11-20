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

function buildResumo(lista, filtroValor, extractor, fallbackHelper, totalResumo = null, resumoLista = []) {
  const valor = filtroValor ? String(filtroValor).trim() : ''
  const valorLower = valor.toLowerCase()
  const isTodos = !valor || valorLower === 'todos' || valorLower === 'todas'
  const chave = normalizeKey(valor)
  const totalResumoNumero = Number(totalResumo)
  const total = isTodos
    ? (Number.isFinite(totalResumoNumero) ? totalResumoNumero : lista.length)
    : (() => {
        if (Array.isArray(resumoLista) && resumoLista.length) {
          const match = resumoLista.find((item) => {
            const key = item?.centro_servico ?? item?.setor ?? ''
            return normalizeKey(key) === chave
          })
          const matchTotal = Number(match?.total)
          if (match && Number.isFinite(matchTotal)) {
            return matchTotal
          }
        }
        return lista.filter((item) => normalizeKey(extractor(item)) === chave).length
      })()
  const label = isTodos ? 'Total de pessoas' : resolveDisplayValue(valor, 'Nao informado')
  const helper = isTodos ? fallbackHelper : `${label}`
  return {
    value: numberFormatter.format(total),
    helper,
  }
}

export function PessoasResumoCards({ pessoas, selectedCentro, selectedSetor, resumo }) {
  const listaCompleta = Array.isArray(pessoas) ? pessoas : []
  const lista = listaCompleta.filter((item) => item?.ativo !== false)

  const centroResumo = buildResumo(
    lista,
    selectedCentro,
    (item) => item?.centroServico ?? item?.local ?? '',
    resumo?.porCentro?.length ? 'Total geral' : 'Selecione um centro de servico no filtro',
    resumo?.totalGeral ?? null,
    resumo?.porCentro ?? []
  )
  const setorResumo = buildResumo(
    lista,
    selectedSetor,
    (item) => item?.setor ?? '',
    resumo?.porSetor?.length ? 'Total geral' : 'Selecione um setor no filtro',
    resumo?.totalGeral ?? null,
    resumo?.porSetor ?? []
  )

  return (
    <div className="dashboard-highlights pessoas-resumo-cards">
      <InsightCard
        title="Pessoas por centro de servico"
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
  resumo: PropTypes.shape({
    totalGeral: PropTypes.number,
    porCentro: PropTypes.array,
    porSetor: PropTypes.array,
  }),
}

PessoasResumoCards.defaultProps = {
  pessoas: [],
  selectedCentro: '',
  selectedSetor: '',
  resumo: { totalGeral: null, porCentro: [], porSetor: [] },
}
