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

export function ChartPartesLesionadas({ data, nameKey, valueKey, height, autoHeight, labelMaxLength }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel</div>
  }

  const sortedData = data
  const baseHeight = Number.isFinite(height) ? height : 360
  const rowHeight = 26
  const padding = 140
  const computedHeight = autoHeight ? Math.max(baseHeight, sortedData.length * rowHeight + padding) : baseHeight
  const maxLabelLength = Number.isFinite(labelMaxLength) ? labelMaxLength : 34
  const formatLabel = (value) => {
    const text = value === undefined || value === null ? '' : String(value).trim()
    if (!text || text.length <= maxLabelLength) {
      return text
    }
    return `${text.slice(0, maxLabelLength - 3)}...`
  }

  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 16, right: 24, left: 80, bottom: 16 }}
      >
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value) => valueFormatter.format(value ?? 0)}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={nameKey}
          tickFormatter={formatLabel}
          tick={{ fill: '#475569', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={valueKey} name="Total" fill="#22d3ee" radius={[0, 8, 8, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

ChartPartesLesionadas.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  nameKey: PropTypes.string,
  valueKey: PropTypes.string,
  height: PropTypes.number,
  autoHeight: PropTypes.bool,
  labelMaxLength: PropTypes.number,
}

ChartPartesLesionadas.defaultProps = {
  data: [],
  nameKey: 'parte_lesionada',
  valueKey: 'total',
  height: 360,
  autoHeight: false,
  labelMaxLength: 34,
}
