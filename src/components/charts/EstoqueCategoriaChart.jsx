import PropTypes from 'prop-types'
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell } from 'recharts'

const palette = ['#0ea5e9', '#14b8a6', '#f97316', '#6366f1', '#f43f5e', '#84cc16', '#ec4899', '#a855f7']

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function CustomTooltip({ active, payload, total }) {
  if (!active || !payload?.length) {
    return null
  }
  const entrada = payload[0]
  const quantidade = Number(entrada.value ?? 0)
  const percentual = total > 0 ? ((quantidade / total) * 100).toFixed(1) : '0.0'
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{entrada.name}</span>
      <ul>
        <li>
          <strong>Quantidade:</strong> {quantityFormatter.format(quantidade)}
        </li>
        <li>
          <strong>Participação:</strong> {percentual}%
        </li>
      </ul>
    </div>
  )
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  total: PropTypes.number,
}

export function EstoquePorCategoriaChart({ data = [], height = 320, onItemClick }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponível</div>
  }
  const total = data.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 16, right: 24, left: 24, bottom: 12 }}>
        <Pie
          data={data}
          dataKey="quantidade"
          nameKey="categoria"
          innerRadius={70}
          outerRadius={120}
          paddingAngle={3}
          stroke="none"
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(entry) => {
            if (onItemClick && entry?.payload) {
              onItemClick(entry.payload)
            }
          }}
          labelLine={false}
          label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`${entry?.categoria ?? index}`} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
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

EstoquePorCategoriaChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  height: PropTypes.number,
  onItemClick: PropTypes.func,
}

