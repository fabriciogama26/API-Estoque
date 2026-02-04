import PropTypes from 'prop-types'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { copyTextToClipboard } from '../../utils/clipboard.js'

function MaterialTooltip({ active, payload, label, valueFormatter, valueLabel }) {
  if (!active || !payload?.length) {
    return null
  }
  const entry = payload[0]?.payload ?? {}
  const descricaoCompleta = entry?.descricaoCompleta || entry?.descricao || label
  const materialId = entry?.materialIdDisplay || entry?.materialId || entry?.id
  const valor = entry?.quantidade ?? payload[0]?.value

  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{descricaoCompleta}</span>
      {materialId ? <span className="chart-tooltip__meta">ID: {materialId}</span> : null}
      <ul>
        <li>
          <strong>{valueLabel}:</strong> {valueFormatter ? valueFormatter(valor) : valor}
        </li>
      </ul>
    </div>
  )
}

export function EstoquePorMaterialChart({ data, valueFormatter, height = 320, onItemClick }) {
  const valueLabel = 'Quantidade'
  const handleCopyId = (payload) => {
    const id = payload?.materialIdDisplay || payload?.materialId || payload?.id
    if (id) {
      copyTextToClipboard(id)
    }
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
        <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nome"
          width={180}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
        />
        <Tooltip
          content={
            <MaterialTooltip valueFormatter={valueFormatter} valueLabel={valueLabel} />
          }
        />
        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ color: '#475569' }} />
        <Bar
          dataKey="quantidade"
          name={valueLabel}
          radius={[8, 8, 8, 8]}
          fill="#22d3ee"
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(entry) => {
            handleCopyId(entry?.payload)
            if (onItemClick) {
              onItemClick(entry?.payload)
            }
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

EstoquePorMaterialChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  valueFormatter: PropTypes.func,
  height: PropTypes.number,
  onItemClick: PropTypes.func,
}

export function MateriaisMaisUsadosChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="4 4" />
        <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
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

