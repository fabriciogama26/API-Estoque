import { ASO_FILTER_DEFAULT, ASO_FORM_DEFAULT } from '../config/AsoConfig.js'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

const padDatePart = (value) => String(value).padStart(2, '0')

const parseDateOnly = (value) => {
  const normalized = String(value || '').trim()
  const match = DATE_ONLY_REGEX.exec(normalized)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatDateOnly = (date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

export const normalizeAsoFormDefaults = () => ({ ...ASO_FORM_DEFAULT })
export const normalizeAsoFilterDefaults = () => ({ ...ASO_FILTER_DEFAULT })

export const formatDateInputValue = (value) => {
  if (!value) return ''
  const parsedDateOnly = parseDateOnly(value)
  if (parsedDateOnly) {
    return formatDateOnly(parsedDateOnly)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateOnly(date)
}

export const formatDate = (value) => {
  if (!value) return 'Nao informado'
  const parsedDateOnly = parseDateOnly(value)
  const date = parsedDateOnly || new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return date.toLocaleDateString('pt-BR')
}

export const formatDateTime = (value) => {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

export const resolveAsoStatusMeta = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  const map = {
    demissional: { label: 'Demissional', variant: 'neutral' },
    sem_vencimento: { label: 'Sem vencimento', variant: 'neutral' },
    em_dia: { label: 'Em dia', variant: 'ok' },
    vence_60: { label: 'Vence em 60 dias', variant: 'warning-soft' },
    vence_30: { label: 'Vence em 30 dias', variant: 'warning' },
    vence_15: { label: 'Vence em 15 dias', variant: 'warning-strong' },
    vence_hoje: { label: 'Vence hoje', variant: 'today' },
    vencido: { label: 'Vencido', variant: 'danger' },
  }
  return map[normalized] || { label: normalized || 'Nao informado', variant: 'neutral' }
}

export const buildAsoRowClassName = (aso = {}) => {
  const status = resolveAsoStatusMeta(aso.statusVencimento)
  return `data-table__row--aso-${status.variant}`
}

export const computeAsoNextDue = (dataExame, tipo = null) => {
  if (!dataExame || !tipo) return ''
  if (tipo.gera_vencimento === false || tipo.anos_validade === null || tipo.anos_validade === undefined) {
    return ''
  }
  const date = parseDateOnly(dataExame) || new Date(`${dataExame}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setFullYear(date.getFullYear() + Number(tipo.anos_validade || 1))
  return formatDateOnly(date)
}

export const summarizePessoa = (pessoa) => {
  if (!pessoa) return ''
  const nome = String(pessoa.nome || '').trim()
  const matricula = String(pessoa.matricula || '').trim()
  if (nome && matricula) return `${nome} - ${matricula}`
  return nome || matricula || ''
}

export const detailPessoa = (pessoa) => {
  if (!pessoa) return ''
  const partes = [
    pessoa.centroServico || pessoa.local || '',
    pessoa.setor || '',
    pessoa.cargo || '',
  ].filter(Boolean)
  return partes.join(' | ')
}

export const uniqueSorted = (lista = []) =>
  Array.from(new Set((lista || []).map((item) => String(item || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )

export const buildAsoSummary = (lista = []) => {
  const registros = Array.isArray(lista) ? lista : []
  const summary = {
    totalRegistros: registros.length,
    vencendo60: 0,
    vencendo30: 0,
    vencendo15: 0,
    venceHoje: 0,
    vencidos: 0,
    demissionais: 0,
  }

  registros.forEach((item) => {
    const status = String(item?.statusVencimento || '').trim().toLowerCase()
    if (status === 'vence_60') summary.vencendo60 += 1
    if (status === 'vence_30') summary.vencendo30 += 1
    if (status === 'vence_15') summary.vencendo15 += 1
    if (status === 'vence_hoje') summary.venceHoje += 1
    if (status === 'vencido') summary.vencidos += 1
    if ((item?.tipoExameCodigo || '').toLowerCase() === 'demissional') summary.demissionais += 1
  })

  return summary
}

export const buildAsoCards = (lista = []) => {
  const summary = buildAsoSummary(lista)
  return [
    { id: 'total', title: 'Total de registros', value: numberFormatter.format(summary.totalRegistros), variant: 'blue' },
    { id: '60', title: 'Vencendo em 60 dias', value: numberFormatter.format(summary.vencendo60), variant: 'cyan' },
    { id: '30', title: 'Vencendo em 30 dias', value: numberFormatter.format(summary.vencendo30), variant: 'amber' },
    { id: '15', title: 'Vencendo em 15 dias', value: numberFormatter.format(summary.vencendo15), variant: 'orange' },
    { id: 'hoje', title: 'Vence hoje', value: numberFormatter.format(summary.venceHoje), variant: 'red' },
    { id: 'vencidos', title: 'Vencidos', value: numberFormatter.format(summary.vencidos), variant: 'danger' },
    { id: 'demissionais', title: 'Demissionais', value: numberFormatter.format(summary.demissionais), variant: 'slate' },
  ]
}

const HISTORY_FIELDS = [
  { key: 'funcionario', label: 'Funcionario' },
  { key: 'matricula', label: 'Matricula' },
  { key: 'tipoExame', label: 'Tipo de exame' },
  { key: 'dataExame', label: 'Data do exame' },
  { key: 'proximoVencimento', label: 'Proximo vencimento' },
  { key: 'diasParaVencer', label: 'Dias para vencer' },
  { key: 'statusVencimento', label: 'Status' },
  { key: 'observacao', label: 'Observacao' },
]

const normalizeCompareValue = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const buildAsoHistoryChanges = (registro = {}) => {
  const before = registro?.dadosAntes || {}
  const after = registro?.dadosDepois || {}
  return HISTORY_FIELDS
    .map((field) => {
      const de = before?.[field.key]
      const para = after?.[field.key]
      if (normalizeCompareValue(de) === normalizeCompareValue(para)) {
        return null
      }
      return {
        campo: field.label,
        de: field.key.toLowerCase().includes('data') ? formatDate(de) : normalizeCompareValue(de) || 'Nao informado',
        para: field.key.toLowerCase().includes('data') ? formatDate(para) : normalizeCompareValue(para) || 'Nao informado',
      }
    })
    .filter(Boolean)
}
