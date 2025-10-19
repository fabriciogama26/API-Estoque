import PropTypes from 'prop-types'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import '../../styles/charts.css'

const palette = ['#22d3ee', '#f97316', '#34d399', '#6366f1', '#facc15', '#f472b6', '#10b981', '#ef4444']
const valueFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const entry = payload[0]
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{entry.name}</span>
      <ul>
        <li style={{ color: entry.color }}>
          <strong>Total:</strong> {valueFormatter.format(entry.value ?? 0)}
        </li>
      </ul>
    </div>
  )
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
}

export function ChartAgentes({ data, nameKey, valueKey }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel</div>
  }

  const sanitizedData = data
    .map((item) => ({
      ...item,
      [valueKey]: Number.parseFloat(item?.[valueKey] ?? 0) || 0,
    }))
    .filter((item) => item[valueKey] > 0)

  if (sanitizedData.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel para os filtros escolhidos</div>
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={sanitizedData}
          dataKey={valueKey}
          nameKey={nameKey}
          outerRadius={120}
          paddingAngle={4}
          strokeWidth={0}
        >
          {sanitizedData.map((entry, index) => (
            <Cell key={`${entry[nameKey]}-${index}`} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ color: '#475569' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

ChartAgentes.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  nameKey: PropTypes.string,
  valueKey: PropTypes.string,
}

ChartAgentes.defaultProps = {
  data: [],
  nameKey: 'agente',
  valueKey: 'total',
}
