import PropTypes from 'prop-types'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export function EstoquePorMaterialChart({ data, valueFormatter }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
        <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis type="number" tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nome"
          width={180}
          tick={{ fill: '#475569' }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => (valueFormatter ? valueFormatter(value) : value)}
        />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Bar dataKey="quantidade" name="Quantidade" radius={[8, 8, 8, 8]} fill="#22d3ee" />
      </BarChart>
    </ResponsiveContainer>
  )
}

EstoquePorMaterialChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  valueFormatter: PropTypes.func,
}

export function MateriaisMaisUsadosChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey="nome" tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Bar dataKey="totalQuantidade" name="Movimentacoes" radius={[6, 6, 0, 0]} fill="#34d399" />
      </BarChart>
    </ResponsiveContainer>
  )
}

MateriaisMaisUsadosChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
}

