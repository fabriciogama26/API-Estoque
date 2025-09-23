import PropTypes from 'prop-types'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts'

const COLORS = ['#22d3ee', '#0ea5e9', '#34d399', '#fbbf24', '#f97316', '#a855f7', '#ec4899']

export function EstoquePorCategoriaChart({ data }) {
  const total = data.reduce((acc, item) => acc + item.quantidade, 0)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="quantidade"
          nameKey="categoria"
          innerRadius={70}
          outerRadius={105}
          paddingAngle={4}
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={entry.categoria} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="middle" align="right" layout="vertical" />
        <Tooltip
          formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

EstoquePorCategoriaChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
}

