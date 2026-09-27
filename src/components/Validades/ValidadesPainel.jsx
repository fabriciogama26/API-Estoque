import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertIcon, BarsIcon, ChecklistIcon, InfoIcon, PersonIcon, TrendIcon } from '../icons.jsx'
import { GRUPOS_ATENCAO, STATUS_OPTIONS } from '../../config/ValidadesConfig.js'
import { formatNumber } from '../../utils/validadesUtils.js'
import '../../styles/charts.css'

const CARD_DEFINITIONS = [
  {
    id: 'monitorados',
    label: 'Monitorados',
    icon: ChecklistIcon,
    variant: 'blue',
    drill: { status: '' },
    tooltip:
      'Pares colaborador x requisito exigidos pelas regras (colaboradores ativos, requisitos ativos). Soma de validos, a vencer, vencidos e pendentes. Dispensados ficam fora.',
  },
  {
    id: 'validos',
    label: 'Validos',
    icon: ChecklistIcon,
    variant: 'green',
    drill: { status: 'valido,sem_validade' },
    tooltip: 'Realizacao vigente com mais dias restantes que a janela critica, ou requisito sem validade ja realizado.',
  },
  {
    id: 'proximos',
    label: 'Proximos do vencimento',
    icon: TrendIcon,
    variant: 'orange',
    drill: { status: 'proximo_vencimento' },
    tooltip: 'Vencem de 1 ate N dias, onde N e a janela critica configurada (padrao 7).',
  },
  {
    id: 'vence_hoje',
    label: 'Vencem hoje',
    icon: AlertIcon,
    variant: 'red',
    drill: { status: 'vence_hoje' },
    tooltip: 'O vencimento e hoje (ultimo dia valido), pelo fuso horario configurado do tenant.',
  },
  {
    id: 'vencidos',
    label: 'Vencidos',
    icon: AlertIcon,
    variant: 'red',
    drill: { status: 'vencido' },
    tooltip: 'Realizacao vigente com vencimento anterior a hoje e sem renovacao.',
  },
  {
    id: 'pendentes',
    label: 'Pendentes / nao realizados',
    icon: PersonIcon,
    variant: 'slate',
    drill: { status: 'pendente' },
    tooltip: 'Requisito exigido do colaborador sem nenhuma realizacao registrada.',
  },
]

const AGRUPAMENTOS = [
  { value: 'por_centro_servico', label: 'Centro de servico', filtro: 'centro_servico_id' },
  { value: 'por_setor', label: 'Setor', filtro: 'setor_id' },
  { value: 'por_centro_custo', label: 'Centro de custo', filtro: 'centro_custo_id' },
]

const statusColor = new Map(STATUS_OPTIONS.map((item) => [item.value, item.color]))
const ordemGrupos = new Map(GRUPOS_ATENCAO.map((grupo, index) => [grupo.key, index]))
const ordenarLegenda = (item) => ordemGrupos.get(item?.dataKey) ?? 99
const BAR_STROKE = '#ffffff'
const AXIS_TICK = { fill: '#475569', fontSize: 11 }

function TooltipLista({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label}</span>
      <ul>
        {payload.map((entry) => (
          <li key={entry.dataKey} style={{ color: '#0f172a' }}>
            <span style={{ color: entry.color || entry.payload?.cor }}>&#9632;</span> {entry.name}:{' '}
            <strong>{formatNumber(entry.value)}</strong>
          </li>
        ))}
      </ul>
      <span className="chart-tooltip__meta">Clique para abrir a lista</span>
    </div>
  )
}

function ChartCard({ title, icon, info, actions, children }) {
  const Icon = icon
  return (
    <section className="card dashboard-card--chart dashboard-card--chart-lg">
      <header className="card__header dashboard-card__header">
        <div className="dashboard-card__title-group">
          {info ? (
            <button type="button" className="summary-tooltip dashboard-card__info" aria-label={`Informacoes sobre ${title}`}>
              <InfoIcon size={14} />
              <span>{info}</span>
            </button>
          ) : null}
          <h2 className="dashboard-card__title">
            <Icon size={20} /> <span>{title}</span>
          </h2>
        </div>
        {actions ? <div className="dashboard-card__actions">{actions}</div> : null}
      </header>
      <div className="dashboard-chart-container dashboard-chart-container--simple">{children}</div>
    </section>
  )
}

const semDados = (lista, chave = 'total') => !Array.isArray(lista) || !lista.some((item) => Number(item?.[chave]) > 0)

// Converte vence_hoje + proximos no grupo "A vencer" dos graficos empilhados.
const agruparAtencao = (lista = []) =>
  lista.map((item) => ({
    ...item,
    vencidos: Number(item.vencidos) || 0,
    a_vencer: (Number(item.vence_hoje) || 0) + (Number(item.proximos) || 0),
    pendentes: Number(item.pendentes) || 0,
  }))

function StackedAtencaoChart({ data, categoriaKey, onSelect, height }) {
  if (!data.length) {
    return <div className="dashboard-card__empty">Nenhum vencimento ou pendencia para os filtros escolhidos</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barCategoryGap={6}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={categoriaKey} width={150} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipLista />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} itemSorter={ordenarLegenda} />
        {GRUPOS_ATENCAO.map((grupo, index) => (
          <Bar
            key={grupo.key}
            dataKey={grupo.key}
            name={grupo.label}
            stackId="atencao"
            fill={grupo.color}
            stroke={BAR_STROKE}
            strokeWidth={2}
            radius={index === GRUPOS_ATENCAO.length - 1 ? [0, 4, 4, 0] : 0}
            cursor="pointer"
            onClick={(entry) => onSelect(entry?.payload ?? entry, grupo)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ValidadesPainel({ resumo, isLoading, onDrill }) {
  const [agrupamento, setAgrupamento] = useState(AGRUPAMENTOS[0].value)
  const cards = resumo?.cards || {}
  const extras = resumo?.extras || {}
  const janela = resumo?.janela ?? 7

  const porStatus = useMemo(
    () =>
      (resumo?.por_status || []).map((item) => ({
        ...item,
        total: Number(item.total) || 0,
        cor: statusColor.get(item.status) || '#64748b',
      })),
    [resumo],
  )
  const porRequisito = useMemo(() => agruparAtencao(resumo?.por_requisito || []), [resumo])
  const porFaixa = useMemo(() => (resumo?.por_faixa || []).map((item) => ({ ...item, total: Number(item.total) || 0 })), [resumo])
  const agrupamentoAtual = AGRUPAMENTOS.find((item) => item.value === agrupamento) || AGRUPAMENTOS[0]
  const porDimensao = useMemo(() => agruparAtencao(resumo?.[agrupamento] || []), [resumo, agrupamento])

  if (!resumo && isLoading) {
    return <p className="feedback">Carregando painel...</p>
  }

  return (
    <div className="stack">
      <section className="dashboard-highlights validades-cards">
        {CARD_DEFINITIONS.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.id}
              type="button"
              className={`dashboard-insight-card dashboard-insight-card--${card.variant} dashboard-insight-card--has-tooltip validades-card-button`}
              onClick={() => onDrill(card.drill)}
              aria-label={`${card.label}: ${formatNumber(cards[card.id])}. Abrir lista`}
            >
              <span className="summary-tooltip summary-tooltip--floating" role="tooltip">
                <InfoIcon size={16} />
                <span>{card.tooltip}</span>
              </span>
              <span className="dashboard-insight-card__header">
                <span className="dashboard-insight-card__title">{card.label}</span>
                <span className="dashboard-insight-card__avatar">
                  <Icon size={22} />
                </span>
              </span>
              <strong className="dashboard-insight-card__value">{formatNumber(cards[card.id])}</strong>
              <span className="dashboard-insight-card__helper">Clique para ver a lista</span>
            </button>
          )
        })}
      </section>

      <p className="data-table__muted validades-painel__nota">
        Janela critica: {janela} dias. Fora dos cards: {formatNumber(extras.dispensados)} dispensado(s) e{' '}
        {formatNumber(extras.nao_exigidos)} registro(s) sem exigencia atual. Cards e graficos respeitam os filtros aplicados.
      </p>

      <div className="dashboard-grid dashboard-grid--two">
        <ChartCard
          title="Status dos requisitos exigidos"
          icon={BarsIcon}
          info="Quantidade de pares colaborador x requisito exigidos em cada status. Clique na barra para abrir a lista."
        >
          {semDados(porStatus) ? (
            <div className="dashboard-card__empty">Nenhum requisito exigido para os filtros escolhidos</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porStatus} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barCategoryGap={8}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={150} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipLista />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                <Bar
                  dataKey="total"
                  name="Quantidade"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(entry) => onDrill({ status: (entry?.payload ?? entry)?.status })}
                >
                  {porStatus.map((item) => (
                    <Cell key={item.status} fill={item.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Proximos vencimentos"
          icon={TrendIcon}
          info="Requisitos exigidos com realizacao vigente que vencem em cada faixa de dias a partir de hoje (faixas sem sobreposicao)."
        >
          {semDados(porFaixa) ? (
            <div className="dashboard-card__empty">Nenhum vencimento nos proximos 90 dias</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porFaixa} margin={{ top: 16, right: 16, left: 0, bottom: 8 }} barCategoryGap="30%">
                <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipLista />} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                <Bar
                  dataKey="total"
                  name="Vencimentos"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => onDrill({ faixa: (entry?.payload ?? entry)?.faixa, status: '' })}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="dashboard-grid dashboard-grid--two">
        <ChartCard
          title="Pendencias e vencimentos por requisito"
          icon={BarsIcon}
          info="Top 15 requisitos com mais itens de atencao. A vencer = vence hoje + janela critica. Clique no segmento para abrir a lista."
        >
          <StackedAtencaoChart
            data={porRequisito.filter((item) => item.vencidos + item.a_vencer + item.pendentes > 0)}
            categoriaKey="requisito"
            height={Math.max(260, porRequisito.length * 34)}
            onSelect={(item, grupo) => onDrill({ requisito_id: item?.requisito_id, status: grupo.status })}
          />
        </ChartCard>

        <ChartCard
          title={`Concentracao por ${agrupamentoAtual.label.toLowerCase()}`}
          icon={BarsIcon}
          info="Onde estao os vencidos, a vencer e pendentes (top 15). Clique no segmento para abrir a lista."
          actions={
            <select
              className="validades-select-compacto"
              value={agrupamento}
              onChange={(event) => setAgrupamento(event.target.value)}
              aria-label="Agrupar por"
            >
              {AGRUPAMENTOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          }
        >
          <StackedAtencaoChart
            data={porDimensao}
            categoriaKey="nome"
            height={Math.max(260, porDimensao.length * 34)}
            onSelect={(item, grupo) =>
              item?.id ? onDrill({ [agrupamentoAtual.filtro]: item.id, status: grupo.status }) : onDrill({ status: grupo.status })
            }
          />
        </ChartCard>
      </div>
    </div>
  )
}
