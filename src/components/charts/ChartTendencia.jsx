import PropTypes from 'prop-types'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import '../../styles/charts.css'
import { formatPeriodoLabel } from '../../utils/indicadores.js'

const accidentsFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const rateFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function CustomTooltip({ active, payload, label, formatters }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{formatPeriodoLabel(label)}</span>
      <ul>
        {payload.map((entry) => {
          const formatter = formatters?.[entry.dataKey] ?? rateFormatter
          return (
            <li key={entry.dataKey} style={{ color: entry.color }}>
              <strong>{entry.name}:</strong> {formatter.format(entry.value ?? 0)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  formatters: PropTypes.object,
}

export function ChartTendencia({
  data,
  xKey,
  acidentesKey,
  tfKey,
  tgKey,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponível</div>
  }

  const formatterMap = {
    [acidentesKey]: accidentsFormatter,
    [tfKey]: rateFormatter,
    [tgKey]: rateFormatter,
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 12, right: 32, left: 12, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} tickFormatter={formatPeriodoLabel} />
        <YAxis
          yAxisId="left"
          tickFormatter={(value) => accidentsFormatter.format(value ?? 0)}
          tick={{ fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(value) => rateFormatter.format(value ?? 0)}
          tick={{ fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip formatters={formatterMap} />} />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Line
          type="monotone"
          dataKey={acidentesKey}
          name="Acidentes"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          yAxisId="left"
        />
        <Line
          type="monotone"
          dataKey={tfKey}
          name="Taxa de Frequência"
          stroke="#2563eb"
          strokeWidth={2}
          dot
          yAxisId="right"
        />
        <Line
          type="monotone"
          dataKey={tgKey}
          name="Taxa de Gravidade"
          stroke="#16a34a"
          strokeWidth={2}
          dot
          yAxisId="right"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

ChartTendencia.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  xKey: PropTypes.string,
  acidentesKey: PropTypes.string,
  tfKey: PropTypes.string,
  tgKey: PropTypes.string,
}

ChartTendencia.defaultProps = {
  data: [],
  xKey: 'mes',
  acidentesKey: 'total_acidentes',
  tfKey: 'taxa_frequencia',
  tgKey: 'taxa_gravidade',
}
