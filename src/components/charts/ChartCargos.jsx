import PropTypes from 'prop-types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import '../../styles/charts.css'

const valueFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label}</span>
      <ul>
        {payload.map((entry) => (
          <li key={entry.dataKey} style={{ color: entry.color }}>
            <strong>Total:</strong> {valueFormatter.format(entry.value ?? 0)}
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
}

export function ChartCargos({ data, nameKey, valueKey }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel</div>
  }

  const sanitizedData = data.map((item) => ({
    ...item,
    [valueKey]: Number.parseFloat(item?.[valueKey] ?? 0) || 0,
  }))

  const possuiValores = sanitizedData.some((item) => item[valueKey] > 0)
  if (!possuiValores) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel para os filtros escolhidos</div>
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={sanitizedData} margin={{ top: 16, right: 16, left: 16, bottom: 24 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
        <XAxis
          dataKey={nameKey}
          tick={{ fill: '#475569' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-12}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tickFormatter={(value) => valueFormatter.format(value ?? 0)}
          tick={{ fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={valueKey} name="Total" fill="#0ea5e9" radius={[8, 8, 0, 0]} minPointSize={6} />
      </BarChart>
    </ResponsiveContainer>
  )
}

ChartCargos.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  nameKey: PropTypes.string,
  valueKey: PropTypes.string,
}

ChartCargos.defaultProps = {
  data: [],
  nameKey: 'cargo',
  valueKey: 'total',
}
