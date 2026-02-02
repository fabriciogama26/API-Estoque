import PropTypes from 'prop-types'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts'

const defaultPercentFormatter = (value) => `${Number(value ?? 0).toFixed(1)}%`

const colorMap = {
  A: '#22c55e',
  B: '#f59e0b',
  C: '#94a3b8',
}

const defaultLabelFormatter = (value) => {
  const label = String(value ?? '').trim()
  if (!label) {
    return ''
  }
  if (label.length <= 20) {
    return label
  }
  return `${label.slice(0, 17)}...`
}

function ParetoTooltip({
  active,
  payload,
  label,
  valueFormatter,
  percentFormatter,
  nameKey,
  valueKey,
  valueLabel,
}) {
  if (!active || !payload?.length) {
    return null
  }
  const entry = payload[0]?.payload ?? {}
  const valor = entry?.[valueKey]
  const acumulado = entry?.percentualAcumulado
  const classe = entry?.classe
  const nome = entry?.[nameKey] ?? label
  const descricaoCompleta = entry?.descricaoCompleta || entry?.descricao || nome
  const materialId = entry?.materialIdDisplay || entry?.materialId || entry?.id

  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{descricaoCompleta}</span>
      {materialId ? <span className="chart-tooltip__meta">ID: {materialId}</span> : null}
      <ul>
        <li>
          <strong>{valueLabel}:</strong> {valueFormatter ? valueFormatter(valor) : valor}
        </li>
        <li>
          <strong>Acumulado:</strong> {percentFormatter ? percentFormatter(acumulado) : acumulado}
        </li>
        {classe ? (
          <li>
            <strong>Classe:</strong> {classe}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

ParetoTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  valueFormatter: PropTypes.func,
  percentFormatter: PropTypes.func,
  nameKey: PropTypes.string.isRequired,
  valueKey: PropTypes.string.isRequired,
  valueLabel: PropTypes.string,
}

export function ParetoChart({
  data = [],
  nameKey = 'nome',
  valueKey = 'quantidade',
  height = 360,
  valueLabel = 'Valor',
  valueFormatter,
  percentFormatter = defaultPercentFormatter,
  onItemClick,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 32, left: 28, bottom: 52 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis
          dataKey={nameKey}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickMargin={8}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-15}
          height={90}
          padding={{ left: 12, right: 12 }}
          tickFormatter={defaultLabelFormatter}
          textAnchor="end"
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={percentFormatter}
        />
        <Tooltip
          content={
            <ParetoTooltip
              valueFormatter={valueFormatter}
              percentFormatter={percentFormatter}
              nameKey={nameKey}
              valueKey={valueKey}
              valueLabel={valueLabel}
            />
          }
        />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <ReferenceLine yAxisId="right" y={80} stroke="#f97316" strokeDasharray="4 4" />
        <Bar
          dataKey={valueKey}
          name={valueLabel}
          radius={[6, 6, 0, 0]}
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(entry) => {
            if (onItemClick) {
              onItemClick(entry?.payload)
            }
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`${entry?.[nameKey] ?? index}`} fill={colorMap[entry?.classe] || '#38bdf8'} />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="percentualAcumulado"
          name="% acumulado"
          yAxisId="right"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

ParetoChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  nameKey: PropTypes.string,
  valueKey: PropTypes.string,
  height: PropTypes.number,
  valueLabel: PropTypes.string,
  valueFormatter: PropTypes.func,
  percentFormatter: PropTypes.func,
  onItemClick: PropTypes.func,
}
