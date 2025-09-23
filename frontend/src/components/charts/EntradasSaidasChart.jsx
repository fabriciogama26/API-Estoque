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

function CustomTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{labelFormatter ? labelFormatter(label) : label}</span>
      <ul>
        {payload.map((entry) => (
          <li key={entry.dataKey} style={{ color: entry.color }}>
            <strong>{entry.name}:</strong> {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </li>
        ))}
      </ul>
    </div>
  )
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  labelFormatter: PropTypes.func,
  valueFormatter: PropTypes.func,
}

export function EntradasSaidasChart({ data, labelFormatter, valueFormatter }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 12, right: 20, left: 12, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey="periodo" tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
        <YAxis tickFormatter={valueFormatter} tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip
          content={<CustomTooltip labelFormatter={labelFormatter} valueFormatter={valueFormatter} />}
        />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22d3ee" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="saidas" name="Saidas" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

EntradasSaidasChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  labelFormatter: PropTypes.func,
  valueFormatter: PropTypes.func,
}

export function ValorMovimentadoChart({ data, valueFormatter }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 12, right: 20, left: 12, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey="periodo" tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
        <YAxis tickFormatter={valueFormatter} tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip
          content={<CustomTooltip valueFormatter={valueFormatter} />}
        />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Line type="monotone" dataKey="valorEntradas" name="Valor das entradas" stroke="#38bdf8" strokeWidth={2} dot />
        <Line type="monotone" dataKey="valorSaidas" name="Valor das saidas" stroke="#f97316" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  )
}

ValorMovimentadoChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  valueFormatter: PropTypes.func,
}

