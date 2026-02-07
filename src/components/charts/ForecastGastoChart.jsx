import PropTypes from 'prop-types'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

function ForecastTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) {
    return null
  }
  const values = payload.filter((item) => item?.value !== null && item?.value !== undefined)
  if (!values.length) {
    return null
  }
  const payloadData = payload?.[0]?.payload || {}
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label}</span>
      <ul>
        {values.map((item) => (
          <li key={item.dataKey}>
            <strong>{item.name}:</strong> {valueFormatter ? valueFormatter(item.value) : item.value}
          </li>
        ))}
        {payloadData?.contingencia ? (
          <li>
            <strong>Contingencia (P75):</strong>{' '}
            {valueFormatter ? valueFormatter(payloadData.contingencia) : payloadData.contingencia}
          </li>
        ) : null}
        {payloadData?.p90 ? (
          <li>
            <strong>P90:</strong> {valueFormatter ? valueFormatter(payloadData.p90) : payloadData.p90}
          </li>
        ) : null}
        {payloadData?.mediana ? (
          <li>
            <strong>Mediana:</strong>{' '}
            {valueFormatter ? valueFormatter(payloadData.mediana) : payloadData.mediana}
          </li>
        ) : null}
        {payloadData?.cv ? (
          <li>
            <strong>CV:</strong> {payloadData.cv.toFixed ? payloadData.cv.toFixed(2) : payloadData.cv}
          </li>
        ) : null}
        {payloadData?.alertaVolatil ? (
          <li>
            <strong>Alerta:</strong> mes com historico volatil
          </li>
        ) : null}
      </ul>
    </div>
  )
}

ForecastTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  valueFormatter: PropTypes.func,
}

export function ForecastGastoChart({ data, valueFormatter, height = 320 }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="dashboard-card__empty">Sem dados para previsao</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ForecastTooltip valueFormatter={valueFormatter} />} />
        <Legend
          verticalAlign="top"
          height={32}
          iconType="circle"
          wrapperStyle={{ color: '#475569' }}
          payload={[
            { value: 'Gasto real', type: 'circle', id: 'historico', color: '#0ea5e9' },
            { value: 'Media movel (3m)', type: 'circle', id: 'mediaMovel', color: '#22c55e' },
            { value: 'Saida prevista', type: 'circle', id: 'previsao', color: '#7c3aed' },
            { value: 'Entrada prevista', type: 'circle', id: 'previsaoEntrada', color: '#f97316' },
          ]}
        />
        <Line type="monotone" dataKey="historico" name="Gasto real" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="mediaMovel"
          name="Media movel (3m)"
          stroke="#22c55e"
          strokeDasharray="2 2"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="previsao"
          name="Saida prevista"
          stroke="#7c3aed"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="previsaoEntrada"
          name="Entrada prevista"
          stroke="#f97316"
          strokeDasharray="3 3"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

ForecastGastoChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  valueFormatter: PropTypes.func,
  height: PropTypes.number,
}
