// Utilitarios da reposicao por politica (aba Compra da Analise de Estoque).
// Regra de exibicao: `null` vindo da RPC significa "nao calculavel" e nunca e convertido em zero.

import { formatCurrency, formatNumber } from './inventoryReportUtils.js'

export const SITUACAO_REPOSICAO = {
  ruptura_atual: { label: 'Ruptura', prioridade: 'P0', tone: 'red' },
  reposicao_necessaria: { label: 'Reposicao necessaria', prioridade: 'P1', tone: 'orange' },
  reposicao_programada: { label: 'Reposicao programada', prioridade: 'P2', tone: 'blue' },
  manter: { label: 'Manter estoque', prioridade: 'P3', tone: 'green' },
  acima_do_alvo: { label: 'Acima do alvo', prioridade: null, tone: 'slate' },
  sem_consumo_recente: { label: 'Sem consumo recente', prioridade: null, tone: 'slate' },
  sem_base_para_calculo: { label: 'Sem base para calculo', prioridade: null, tone: 'slate' },
}

export const SITUACAO_REPOSICAO_ORDEM = [
  'ruptura_atual',
  'reposicao_necessaria',
  'reposicao_programada',
  'manter',
  'acima_do_alvo',
  'sem_consumo_recente',
  'sem_base_para_calculo',
]

const FONTE_REGRA_LABELS = {
  manual: 'Minimo cadastrado',
  automatico: 'Automatico (consumo)',
  fallback_manual: 'Cadastrado (sem historico)',
  override: 'Override',
  sem_politica: 'Sem regra',
}

const BASE_CALCULO_LABELS = {
  '90d': 'Saidas 90 dias',
  '180d': 'Saidas 180 dias',
  sem_historico: 'Sem historico',
}

const CRITERIO_COMPRA_LABELS = {
  ate_maximo_efetivo: 'Ate o maximo efetivo',
  ate_minimo_manual: 'Ate o minimo cadastrado',
  ate_maximo_automatico: 'Ate o maximo automatico',
  sem_compra: 'Sem compra',
}

const MOTIVO_SITUACAO_LABELS = {
  estoque_zerado: 'Estoque zerado com consumo ou limite definido',
  sem_limite_definido: 'Sem minimo cadastrado e sem consumo',
  abaixo_do_minimo_efetivo: 'Abaixo do minimo efetivo',
  cobertura_abaixo_da_minima: 'Cobertura abaixo da minima',
  abaixo_do_maximo_efetivo: 'Abaixo do maximo efetivo',
  cobertura_acima_do_excesso: 'Cobertura acima do limite de excesso',
  sem_consumo_e_acima_do_dobro_do_maximo: 'Sem consumo e acima do dobro do maximo',
  minimo_manual_sem_consumo_na_janela: 'Minimo cadastrado sem saida na janela',
  dentro_dos_limites: 'Dentro dos limites',
}

const AVISO_LABELS = {
  manual_divergente: 'Minimo cadastrado divergente',
  revisar_minimo_sem_consumo: 'Revisar minimo (sem consumo)',
  sem_historico: 'Sem historico',
  sem_politica: 'Sem regra',
  sem_preco: 'Sem preco',
  override_expirando: 'Override expirando',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isNullish(value) {
  return value === null || value === undefined || value === ''
}

export function toNumberOrNull(value) {
  if (isNullish(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function formatQuantidadeOuNaoCalculavel(value, decimals = 0) {
  const number = toNumberOrNull(value)
  return number === null ? 'Nao calculavel' : formatNumber(number, decimals)
}

export function formatCoberturaMeses(value) {
  const number = toNumberOrNull(value)
  if (number === null) return 'Nao calculavel'
  const dias = Math.max(0, number * 30)
  if (dias < 90) return `${formatNumber(dias, 0)} dias`
  return `${formatNumber(number, 1)} meses`
}

export function formatSituacaoReposicao(situacao) {
  return SITUACAO_REPOSICAO[situacao]?.label || situacao || '-'
}

export function formatFonteRegra(fonte) {
  return FONTE_REGRA_LABELS[fonte] || fonte || '-'
}

export function formatBaseCalculo(base) {
  return BASE_CALCULO_LABELS[base] || base || '-'
}

export function formatCriterioCompra(criterio) {
  return CRITERIO_COMPRA_LABELS[criterio] || criterio || '-'
}

export function formatMotivoSituacao(motivo) {
  return MOTIVO_SITUACAO_LABELS[motivo] || motivo || '-'
}

export function formatAvisos(avisos) {
  const list = Array.isArray(avisos) ? avisos : []
  return list.map((aviso) => AVISO_LABELS[aviso] || aviso)
}

// Nome amigavel: RPC primeiro; se vier UUID, usa o resumo do estoque carregado na pagina.
export function resolveReposicaoNome(item = {}, materialInfoMap) {
  const info = materialInfoMap?.get(String(item.material_id || '')) || {}
  const candidates = [item.nome, info.displayNome]
  const found = candidates.find((value) => value && !UUID_PATTERN.test(String(value).trim()))
  return found || 'Material sem nome cadastrado'
}

export function buildReposicaoResumo(payload) {
  const itens = Array.isArray(payload?.itens) ? payload.itens : []
  const resumo = payload?.resumo_reposicao || {}
  const bySituacao = Object.fromEntries(SITUACAO_REPOSICAO_ORDEM.map((key) => [key, []]))
  itens.forEach((item) => {
    if (bySituacao[item.situacao]) bySituacao[item.situacao].push(item)
  })
  return { itens, resumo, bySituacao }
}

// Faixas de cobertura mutuamente exclusivas; a soma fecha o total monitorado.
export function buildCoberturaFaixas(itens = []) {
  const faixas = [
    { id: 'cobertura-menos-30', label: 'Menos de 30 dias', test: (m) => m !== null && m < 1 },
    { id: 'cobertura-30-60', label: '30 a 60 dias', test: (m) => m !== null && m >= 1 && m < 2 },
    { id: 'cobertura-60-90', label: '60 a 90 dias', test: (m) => m !== null && m >= 2 && m < 3 },
    { id: 'cobertura-3-6m', label: '3 a 6 meses', test: (m) => m !== null && m >= 3 && m < 6 },
    { id: 'cobertura-6-12m', label: '6 a 12 meses', test: (m) => m !== null && m >= 6 && m <= 12 },
    { id: 'cobertura-acima-12m', label: 'Acima de 12 meses', test: (m) => m !== null && m > 12 },
    { id: 'cobertura-sem-consumo', label: 'Sem consumo em 180 dias', test: (m) => m === null },
  ]
  return faixas.map(({ test, ...faixa }) => {
    const items = itens
      .filter((item) => test(toNumberOrNull(item.cobertura_atual_meses)))
      .sort((a, b) => (toNumberOrNull(a.cobertura_atual_meses) ?? 9999) - (toNumberOrNull(b.cobertura_atual_meses) ?? 9999))
    return { ...faixa, items, value: formatNumber(items.length) }
  })
}

export function buildRevisaoRows(itens = []) {
  const rows = [
    {
      id: 'revisao-sem-consumo',
      label: 'Minimo cadastrado sem consumo',
      items: itens.filter((item) => item.situacao === 'sem_consumo_recente'),
    },
    {
      id: 'revisao-manual-acima',
      label: 'Minimo cadastrado acima do sugerido',
      items: itens.filter((item) => item.divergencia_manual === 'manual_acima'),
    },
    {
      id: 'revisao-manual-abaixo',
      label: 'Minimo cadastrado abaixo do sugerido',
      items: itens.filter((item) => item.divergencia_manual === 'manual_abaixo'),
    },
    {
      id: 'revisao-sem-base',
      label: 'Sem minimo e sem consumo',
      items: itens.filter((item) => item.situacao === 'sem_base_para_calculo'),
    },
    {
      id: 'revisao-overrides',
      label: 'Overrides ativos',
      items: itens.filter((item) => item.override),
    },
    {
      id: 'revisao-sem-preco',
      label: 'Sem preco valido',
      items: itens.filter((item) => Number(item.preco_unitario || 0) <= 0),
    },
  ]
  return rows.map((row) => ({ ...row, value: formatNumber(row.items.length) }))
}

// CSV: BOM + separador `;`, null distinto de zero e protecao contra formula injection.
function sanitizeCsvCell(value) {
  let raw = value === null || value === undefined ? '' : String(value)
  raw = raw.replace(/\r?\n|\r/g, ' ').trim()
  if (/^[=+\-@\t]/.test(raw) && !/^-?\d+(,\d+)?$/.test(raw)) {
    raw = `'${raw}`
  }
  if (/[;"]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function csvNumber(value, decimals = null) {
  const number = toNumberOrNull(value)
  if (number === null) return 'nao calculavel'
  const normalized = decimals === null ? String(number) : number.toFixed(decimals)
  return normalized.replace('.', ',')
}

export function buildReposicaoCsv(items = [], context = {}) {
  const headers = [
    'Categoria',
    'Calculado em',
    'Modo da politica',
    'Versao da politica',
    'Material ID',
    'Material',
    'Fabricante',
    'Situacao',
    'Prioridade',
    'Motivo',
    'Estoque atual',
    'Minimo cadastrado',
    'Minimo sugerido',
    'Maximo sugerido',
    'Minimo efetivo',
    'Maximo efetivo',
    'Fonte da regra',
    'Override minimo',
    'Override maximo',
    'Override motivo',
    'Override expira em',
    'Saidas 90d',
    'Saidas 180d',
    'Base do calculo',
    'Consumo medio mensal',
    'Cobertura atual (meses)',
    'Cobertura minima (meses)',
    'Cobertura alvo (meses)',
    'Compra sugerida',
    'Criterio da compra',
    'Preco unitario',
    'Valor da compra',
    'Referencia ate minimo cadastrado',
    'Valor da referencia',
    'Divergencia manual x sugerido (%)',
    'Avisos',
  ]
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const override = item.override || null
    const values = [
      context.label || '',
      context.calculadoEm || '',
      context.modo || '',
      context.versao ?? '',
      item.material_id || '',
      context.resolveNome ? context.resolveNome(item) : item.nome || '',
      item.fabricante || '',
      formatSituacaoReposicao(item.situacao),
      item.prioridade || '',
      formatMotivoSituacao(item.motivo_situacao),
      csvNumber(item.estoque_atual),
      csvNumber(item.minimo_manual),
      csvNumber(item.minimo_automatico),
      csvNumber(item.maximo_automatico),
      csvNumber(item.minimo_efetivo),
      csvNumber(item.maximo_efetivo),
      formatFonteRegra(item.fonte_regra),
      override ? csvNumber(override.minimo) : '',
      override ? csvNumber(override.maximo) : '',
      override?.motivo || '',
      override?.expira_em ? String(override.expira_em).slice(0, 10) : '',
      csvNumber(item.consumo_90d),
      csvNumber(item.consumo_180d),
      formatBaseCalculo(item.base_calculo),
      csvNumber(item.consumo_medio_mensal, 2),
      csvNumber(item.cobertura_atual_meses, 2),
      csvNumber(item.cobertura_minima_meses, 2),
      csvNumber(item.cobertura_alvo_meses, 2),
      csvNumber(item.compra_sugerida_qtd),
      formatCriterioCompra(item.criterio_compra),
      csvNumber(item.preco_unitario, 2),
      csvNumber(item.valor_compra_sugerida, 2),
      csvNumber(item.compra_referencia_manual_qtd),
      csvNumber(item.valor_referencia_manual, 2),
      csvNumber(item.divergencia_pct, 1),
      formatAvisos(item.avisos).join(' | '),
    ]
    return values.map(sanitizeCsvCell).join(';')
  })
  return [headers.join(';'), ...rows].join('\n')
}

export function downloadReposicaoCsv(items = [], context = {}) {
  const slug =
    String(context.label || 'materiais')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'materiais'
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([`\ufeff${buildReposicaoCsv(items, context)}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `analise-estoque-reposicao-${slug}-${date}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatValorOuTraco(value) {
  const number = toNumberOrNull(value)
  return number === null ? '-' : formatCurrency(number)
}
