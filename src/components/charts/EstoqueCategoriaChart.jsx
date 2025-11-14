import PropTypes from 'prop-types'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export function EstoquePorCategoriaChart({ data, height = 320, onItemClick }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
        <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis type="number" tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="categoria"
          width={180}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
        />
        <Tooltip />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Bar
          dataKey="quantidade"
          name="Quantidade"
          radius={[8, 8, 8, 8]}
          fill="#818cf8"
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(entry) => {
            if (onItemClick) {
              onItemClick(entry?.payload)
            }
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

EstoquePorCategoriaChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  height: PropTypes.number,
  onItemClick: PropTypes.func,
}

