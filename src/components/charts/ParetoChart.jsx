import PropTypes from 'prop-types'
import { buildParetoList } from '../../utils/inventoryReportUtils.js'
import { copyTextToClipboard } from '../../utils/clipboard.js'
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

const PARETO_PALETTE = {
  A: '#3b82f6',
  B: '#f97316',
  C: '#94a3b8',
  limit: '#7c3aed',
}

const RISK_PALETTE = {
  A: '#ef4444',
  B: '#facc15',
  C: '#22c55e',
  limit: '#7c3aed',
}

const resolvePalette = (palette) => (palette === 'risk' ? RISK_PALETTE : PARETO_PALETTE)

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

const resolveParetoItemKey = (item, fallbackIndex) => {
  const key =
    item?.materialIdDisplay ||
    item?.materialId ||
    item?.id ||
    item?.descricaoCompleta ||
    item?.descricao ||
    item?.nome
  const normalized = key ? String(key).trim().toLowerCase() : ''
  return normalized || `__item_${fallbackIndex}`
}

function ParetoLegend({ valueLabel, palette, labels }) {
  const colors = resolvePalette(palette)
  const safeLabels = {
    A: labels?.A || 'Classe A',
    B: labels?.B || 'Classe B',
    C: labels?.C || 'Classe C',
  }
  return (
    <div className="pareto-legend">
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--line" aria-hidden="true" />
        % acumulado
      </div>
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--value" aria-hidden="true" />
        {valueLabel}
      </div>
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--a" style={{ background: colors.A }} aria-hidden="true" />
        {safeLabels.A}
      </div>
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--b" style={{ background: colors.B }} aria-hidden="true" />
        {safeLabels.B}
      </div>
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--c" style={{ background: colors.C }} aria-hidden="true" />
        {safeLabels.C}
      </div>
      <div className="pareto-legend__item">
        <span className="pareto-legend__dot pareto-legend__dot--limit" style={{ borderTopColor: colors.limit }} aria-hidden="true" />
        Linha 80%
      </div>
    </div>
  )
}

ParetoLegend.propTypes = {
  valueLabel: PropTypes.string.isRequired,
  palette: PropTypes.oneOf(['pareto', 'risk']),
  labels: PropTypes.shape({
    A: PropTypes.string,
    B: PropTypes.string,
    C: PropTypes.string,
  }),
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
  palette = 'pareto',
  legendLabels,
}) {
  const paletteColors = resolvePalette(palette)
  const normalizedData = (() => {
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }
    const merged = new Map()
    data.forEach((item) => {
      const mapKey = resolveParetoItemKey(item, merged.size + 1)
      const atual = merged.get(mapKey)
      if (!atual) {
        merged.set(mapKey, { ...item })
        return
      }
      merged.set(mapKey, {
        ...atual,
        [valueKey]: Number(atual?.[valueKey] ?? 0) + Number(item?.[valueKey] ?? 0),
        quantidade: Number(atual?.quantidade ?? 0) + Number(item?.quantidade ?? 0),
        valorTotal: Number((Number(atual?.valorTotal ?? 0) + Number(item?.valorTotal ?? 0)).toFixed(2)),
        score: Number(atual?.score ?? 0) + Number(item?.score ?? 0),
      })
    })
    return buildParetoList(Array.from(merged.values()), valueKey).lista
  })()

  if (!normalizedData.length) {
    return <div className="dashboard-card__empty">Nenhum dado disponivel</div>
  }

  const handleCopyId = (payload) => {
    const id = payload?.materialIdDisplay || payload?.materialId || payload?.id
    if (id) {
      copyTextToClipboard(id)
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={normalizedData} margin={{ top: 18, right: 28, left: 24, bottom: 72 }}>
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
          padding={{ left: 10, right: 10 }}
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
        <Legend
          verticalAlign="top"
          height={34}
          content={<ParetoLegend valueLabel={valueLabel} palette={palette} labels={legendLabels} />}
        />
        <ReferenceLine yAxisId="right" y={80} stroke={paletteColors.limit} strokeDasharray="4 4" />
        <Bar
          dataKey={valueKey}
          name={valueLabel}
          radius={[6, 6, 0, 0]}
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(entry) => {
            handleCopyId(entry?.payload)
            if (onItemClick) {
              onItemClick(entry?.payload)
            }
          }}
        >
          {normalizedData.map((entry, index) => {
            const key = resolveParetoItemKey(entry, index + 1)
            return <Cell key={key} fill={paletteColors[entry?.classe] || paletteColors.A} />
          })}
        </Bar>
        <Line
          type="monotone"
          dataKey="percentualAcumulado"
          name="% acumulado"
          yAxisId="right"
          stroke="#166534"
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
  palette: PropTypes.oneOf(['pareto', 'risk']),
  legendLabels: PropTypes.shape({
    A: PropTypes.string,
    B: PropTypes.string,
    C: PropTypes.string,
  }),
}
