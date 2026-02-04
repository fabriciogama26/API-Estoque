import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { supabaseAdmin } from './supabaseClient.js'
import { CONSUME_LOCAL_DATA } from './environment.js'
import { getLocalTermoContext } from './localDocumentContext.js'
import {
  parsePeriodo,
  resolvePeriodoRange,
  montarEstoqueAtual,
  montarDashboard,
  calcularSaldoMaterial,
} from '../../src/lib/estoque.js'
import { normalizarTermo, filtrarPorTermo } from '../../src/utils/dashboardEstoqueUtils.js'
import {
  buildParetoList,
  buildRiscoOperacional,
  buildSaidasResumo,
  buildResumoPorCentroCusto,
  buildResumoPorCentroServico,
  buildResumoPorCategoria,
  buildResumoPorSetor,
  computePercentile,
  formatCurrency,
  formatNumber,
  formatPercent,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_RISK_WEIGHTS,
  DEFAULT_VARIACAO_RELEVANTE,
} from '../../src/utils/inventoryReportUtils.js'
import { PDF_REPORT_LIMIT_PER_MONTH } from '../../src/config/RelatorioEstoqueConfig.js'
import { resolveUsuarioNome } from './auth.js'
import { createHttpError } from './http.js'

const GENERIC_SUPABASE_ERROR = 'Falha ao comunicar com o Supabase.'

const DEFAULT_MATERIAIS_VIEW = 'vw_materiais_vinculos'
const MATERIAIS_VIEW = process.env.MATERIAIS_VIEW || DEFAULT_MATERIAIS_VIEW
const MATERIAL_COR_RELATION_TABLE = 'material_grupo_cor'
const MATERIAL_CARACTERISTICA_RELATION_TABLE = 'material_grupo_caracteristica_epi'
const CENTRO_ESTOQUE_TABLE = 'centros_estoque'
const REPORT_TYPE_MENSAL = 'mensal'
const REPORT_TYPE_TRIMESTRAL = 'trimestral'
const REPORT_TEMPLATE_MENSAL = new URL(
  '../../shared/documents/RELATÓRIO MENSAL DE ESTOQUE.txt',
  import.meta.url,
)
const REPORT_TEMPLATE_TRIMESTRAL = new URL(
  '../../shared/documents/RELATÓRIO TRIMESTRAL DE ESTOQUE (COMPARATIVO).txt',
  import.meta.url,
)

const CARACTERISTICA_ID_KEYS = [
  'caracteristicasIds',
  'caracteristicaIds',
  'caracteristicaId',
  'caracteristica_id',
  'caracteristicas_id',
  'caracteristicas',
  'caracteristicasSelecionadas',
  'caracteristicasVinculos',
]

const COR_ID_KEYS = [
  'corIds',
  'coreIds',
  'coresIds',
  'cor_id',
  'cores_id',
  'cores',
  'coresSelecionadas',
  'coresVinculos',
]

const MATERIAL_CARACTERISTICAS_KEYS = [
  'caracteristicas',
  'caracteristicasEpi',
  'caracteristicas_epi',
  'caracteristicas_vinculos',
  'caracteristica_vinculos',
  'caracteristicasAgg',
  'caracteristicas_agg',
  'caracteristicasList',
  'caracteristicas_list',
]

const MATERIAL_CORES_KEYS = [
  'cores',
  'cores_vinculos',
  'coresAgg',
  'cores_agg',
  'coresRelacionadas',
  'cores_relacionadas',
  'coresList',
  'cores_list',
]

const MATERIAL_CARACTERISTICAS_TEXTO_KEYS = [
  'caracteristicasTexto',
  'caracteristicas_texto',
  'caracteristicaEpi',
  'caracteristica_epi',
]

const MATERIAL_CORES_TEXTO_KEYS = [
  'coresTexto',
  'cores_texto',
  'corMaterial',
  'cor_material',
]

async function execute(builder, fallbackMessage) {
  const { data, error } = await builder
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

async function executeSingle(builder, fallbackMessage) {
  const { data, error } = await builder.single()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

async function executeMaybeSingle(builder, fallbackMessage) {
  const { data, error } = await builder.maybeSingle()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

function mapSupabaseError(error, fallbackMessage = GENERIC_SUPABASE_ERROR) {
  if (!error) {
    return createHttpError(500, fallbackMessage)
  }
  const message = error.message || fallbackMessage
  const httpError = createHttpError(error.status || 500, message)
  httpError.code = error.code
  httpError.details = error.details || null
  httpError.hint = error.hint || null
  httpError.table = error.table || null

  console.error('[SUPABASE]', {
    code: error?.code,
    status: error?.status,
    table: error?.table,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  })
  return httpError
}

function randomId() {
  return randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

const trim = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const normalizeSearchTerm = (value) => (value ? String(value).trim().toLowerCase() : '')

const isAllFilter = (value) => {
  if (value === undefined || value === null) {
    return true
  }
  return String(value).trim().toLowerCase() === 'todos'
}

const toStartOfDayIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

const toEndOfDayIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

const toStartOfMonthUtc = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))

const toEndOfMonthUtc = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))

const isLastDayOfMonthUtc = (date) => {
  const end = toEndOfMonthUtc(date)
  return (
    date.getUTCFullYear() === end.getUTCFullYear() &&
    date.getUTCMonth() === end.getUTCMonth() &&
    date.getUTCDate() === end.getUTCDate()
  )
}

const buildMonthPeriods = (startDate, endDate) => {
  const periods = []
  if (!startDate || !endDate) {
    return periods
  }
  let cursor = toStartOfMonthUtc(startDate)
  const end = toEndOfMonthUtc(endDate)
  while (cursor <= end) {
    const start = new Date(cursor)
    const finish = toEndOfMonthUtc(cursor)
    periods.push({ start, end: finish })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return periods
}

const resolveQuarterStart = (date) => {
  const startMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), startMonth, 1))
}

const resolveQuarterEnd = (date) => {
  const startMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), startMonth + 3, 0))
}

const resolvePreviousQuarterRange = (quarterStart) => {
  const prevStart = new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth() - 3, 1))
  const prevEnd = new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth(), 0))
  return { start: prevStart, end: prevEnd }
}

const resolveMonthRangeFromString = (mes) => {
  const raw = trim(mes)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null
  }
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  return { start, end }
}

const resolveQuarterRangeFromParams = (ano, trimestre) => {
  const year = Number(ano)
  const quarter = Number(trimestre)
  if (!year || !quarter || quarter < 1 || quarter > 4) {
    return null
  }
  const startMonth = (quarter - 1) * 3
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0))
  return { start, end }
}

const buildQuarterPeriods = (startDate, endDate) => {
  const periods = []
  if (!startDate || !endDate) {
    return periods
  }
  let cursor = resolveQuarterStart(startDate)
  const endQuarter = resolveQuarterEnd(endDate)
  while (cursor <= endQuarter) {
    const start = new Date(cursor)
    const finish = resolveQuarterEnd(cursor)
    periods.push({ start, end: finish })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1))
  }
  return periods
}

const toDateOnlyUtcIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const datePart = raw.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  const utc = Date.UTC(year, month - 1, day)
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const formatDateBr = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('pt-BR')
}

const formatMonthRef = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const ano = d.getUTCFullYear()
  return `${mes}/${ano}`
}

const diffMesesInclusivo = (inicio, fim) => {
  const [anoInicio, mesInicio] = String(inicio || '').split('-').map(Number)
  const [anoFim, mesFim] = String(fim || '').split('-').map(Number)
  if (!anoInicio || !mesInicio || !anoFim || !mesFim) {
    return null
  }
  return (anoFim - anoInicio) * 12 + (mesFim - mesInicio) + 1
}

const calcularDiasPeriodo = (range) => {
  if (!range?.start || !range?.end) return 0
  const diff = range.end.getTime() - range.start.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

const toDateOnly = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

function matchesEntradaSearch(entrada, termo, materiaisMap) {
  const material = materiaisMap.get(entrada.materialId)
  const alvo = [
    material?.nome || '',
    material?.fabricante || '',
    entrada.centroCusto || '',
    entrada.centroCustoId || '',
    entrada.usuarioResponsavel || '',
  ]
    .join(' ')
    .toLowerCase()

  return alvo.includes(termo)
}

function matchesSaidaSearch(saida, termo, pessoasMap, materiaisMap) {
  const pessoa = pessoasMap.get(saida.pessoaId)
  const material = materiaisMap.get(saida.materialId)
  const centroPessoa = pessoa?.centroServico ?? pessoa?.local ?? ''
  const alvo = [
    material?.nome || '',
    material?.fabricante || '',
    pessoa?.nome || '',
    centroPessoa,
    saida.centroCusto || '',
    saida.centroServico || '',
    saida.usuarioResponsavel || '',
    saida.status || '',
  ]
    .join(' ')
    .toLowerCase()

  return alvo.includes(termo)
}

function sanitizePessoaPayload(payload = {}) {
  const centroServico = trim(payload.centroServico ?? payload.local)
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    cargo: trim(payload.cargo),
    centroServico,
  }
}

function validatePessoaPayload(payload) {
  if (!payload.nome) throw createHttpError(400, 'Nome obrigat?rio.')
  if (!payload.matricula) throw createHttpError(400, 'Matr?cula obrigat?ria.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servi?o obrigat?rio.')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigat?rio.')
}

function mapPessoaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  }
  const centroServico = record.centroServico ?? record.local ?? ''
  return {
    ...record,
    centroServico,
    local: record.local ?? centroServico,
  }
}

function mapEntradaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  }
  const centroEstoqueValor = record.centroEstoque ?? record.centro_estoque ?? record.centroCusto ?? null
  const centroCustoRaw = record.centroCusto ?? ''
  const centroCustoId =
    typeof centroEstoqueValor === 'string' && UUID_REGEX.test(String(centroEstoqueValor).trim())
      ? String(centroEstoqueValor).trim()
      : null
  const centroCustoNome =
    trim(
      record.centroCustoNome ??
        record.centro_estoque_nome ??
        record.centroEstoqueNome ??
        '',
    ) || (centroCustoId ? '' : trim(centroCustoRaw))
  const usuarioRaw = record.usuarioResponsavel ?? record.usuario_responsavel ?? ''
  const usuarioId =
    typeof usuarioRaw === 'string' && UUID_REGEX.test(usuarioRaw.trim())
      ? usuarioRaw.trim()
      : null
  const usuarioTexto = trim(usuarioRaw)
  return {
    ...record,
    centroCustoId: centroCustoId ?? null,
    centroCusto: centroCustoNome || centroCustoRaw || '',
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? '' : usuarioTexto,
  }
}

function mapSaidaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  }
  return {
    ...record,
    centroCusto: record.centroCusto ?? '',
    centroServico: record.centroServico ?? '',
  }
}

function mapAcidenteRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  }
  const centroServico = record.centro_servico ?? record.centroServico ?? record.setor ?? ''
  const local = record.local ?? record.local_nome ?? centroServico
  return {
    ...record,
    centroServico,
    setor: record.setor ?? centroServico,
    local,
  }
}

function mapMaterialResumo(record) {
  if (!record || typeof record !== 'object') {
    return null
  }
  return {
    id: record.id,
    nome: record.nome || '',
    fabricante: record.fabricante || '',
    ca: record.ca || '',
    numeroEspecifico: record.numeroEspecifico || '',
    numeroCalcado: record.numeroCalcado || '',
    numeroVestimenta: record.numeroVestimenta || '',
    grupoMaterial: record.grupoMaterial || '',
  }
}

function mapMaterialRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  }

  const caracteristicasFonte = getFirstAvailable(record, MATERIAL_CARACTERISTICAS_KEYS)
  const coresFonte = getFirstAvailable(record, MATERIAL_CORES_KEYS)

  const caracteristicas = normalizeMaterialRelationItems(caracteristicasFonte)
  const cores = normalizeMaterialRelationItems(coresFonte)

  const caracteristicasTextoBase = getFirstAvailable(record, MATERIAL_CARACTERISTICAS_TEXTO_KEYS)
  const coresTextoBase = getFirstAvailable(record, MATERIAL_CORES_TEXTO_KEYS)

  const caracteristicasTexto =
    (typeof caracteristicasTextoBase === 'string' ? caracteristicasTextoBase.trim() : '') ||
    buildCatalogoTexto(caracteristicas)

  const coresTexto =
    (typeof coresTextoBase === 'string' ? coresTextoBase.trim() : '') || buildCatalogoTexto(cores)

  const corMaterial = coresTexto || ''
  const caracteristicaEpi = caracteristicasTexto || ''

  const mapped = {
    ...record,
    caracteristicas,
    cores,
    caracteristicasTexto,
    coresTexto,
    corMaterial,
    caracteristicaEpi,
  }

  mapped.cor_material = corMaterial
  mapped.caracteristica_epi = caracteristicaEpi

  return mapped
}

function resolveEmpresaInfo() {
  return {
    nome: process.env.TERMO_EPI_EMPRESA_NOME || '',
    documento: process.env.TERMO_EPI_EMPRESA_DOCUMENTO || '',
    endereco: process.env.TERMO_EPI_EMPRESA_ENDERECO || '',
    contato: process.env.TERMO_EPI_EMPRESA_CONTATO || '',
    logoUrl: process.env.TERMO_EPI_EMPRESA_LOGO_URL || '',
    logoSecundarioUrl: process.env.TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL || '',
}

function normalizePessoaHistorico(lista) {
  if (!Array.isArray(lista)) {
    return []
  }
  return lista
    .map((registro) => {
      if (!registro || typeof registro !== 'object') {
        return null
      }

      const camposOrigem = registro.camposAlterados ?? registro.campos_alterados ?? []
      const campos = Array.isArray(camposOrigem)
        ? camposOrigem
            .map((campo) => {
              if (!campo || typeof campo !== 'object') {
                return null
              }
              const nomeOriginal = campo.campo ?? campo.nome ?? ''
              const nomeNormalizado = nomeOriginal === 'local' ? 'centroServico' : nomeOriginal
              return {
                campo: nomeNormalizado,
                de: campo.de ?? campo.valorAnterior ?? campo.de_valor ?? '',
                para: campo.para ?? campo.valorAtual ?? campo.para_valor ?? '',
              }
            })
            .filter(Boolean)
        : []

      return {
        id: registro.id ?? registro.history_id ?? registro.entry_id ?? randomId(),
        dataEdicao: registro.dataEdicao ?? registro.data_edicao ?? registro.data ?? null,
        usuarioResponsavel:
          registro.usuarioResponsavel ?? registro.usuario_responsavel ?? registro.usuario ?? 'sistema',
        camposAlterados: campos,
      }
    })
    .filter(Boolean)
}

async function ensureMatriculaDisponivel(matricula, ignoreId) {
  if (!matricula) {
    return
  }
  let query = supabaseAdmin.from('pessoas').select('id').eq('matricula', matricula).limit(1)
  if (ignoreId) {
    query = query.neq('id', ignoreId)
  }
  const existente = await executeMaybeSingle(query, 'Falha ao validar matrícula.')
  if (existente) {
    throw createHttpError(409, 'Já existe uma pessoa com essa matrícula.')
  }
}

const sanitizeDigits = (value = '') => String(value).replace(/\\D/g, '')

const normalizeKeyPart = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
    : ''

const normalizeGrupoMaterial = (value) => {
  const base = normalizeKeyPart(value)
  return base.endsWith('s') ? base.slice(0, -1) : base
}

const isGrupo = (value, target) => normalizeGrupoMaterial(value) === normalizeGrupoMaterial(target)

const requiresTamanho = (grupoMaterial) =>
  isGrupo(grupoMaterial, 'Vestimenta') || isGrupo(grupoMaterial, 'Prote��o das M�os')

const buildNumeroReferenciaMaterial = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, 'Cal�ado')) {
    return sanitizeDigits(numeroCalcado)
  }
  if (requiresTamanho(grupoMaterial)) {
    return String(numeroVestimenta || '').trim()
  }
  return ''
}

async function sanitizeMaterialPayload(payload = {}) {
  const nome = trim(payload.nome ?? payload.materialItemNome ?? payload.nomeItemRelacionado)
  const fabricante = trim(payload.fabricante ?? payload.fabricante)
  const grupoMaterialNome = trim(payload.grupoMaterialNome ?? payload.grupoMaterial)
  const grupoMaterialId = trim(payload.grupoMaterialId)
  const numeroCalcadoRaw = sanitizeDigits(payload.numeroCalcado)
  const numeroVestimentaRaw = trim(payload.numeroVestimenta)
  const numeroCalcado = isGrupo(grupoMaterialNome, 'Cal�ado') ? numeroCalcadoRaw : ''
  const numeroVestimenta = requiresTamanho(grupoMaterialNome) ? numeroVestimentaRaw : ''
  const descricao = trim(payload.descricao)
  const ca = sanitizeDigits(payload.ca)
  const numeroEspecifico = buildNumeroReferenciaMaterial({
    grupoMaterial: grupoMaterialNome,
    numeroCalcado,
    numeroVestimenta,
  })

  const caracteristicaIds = collectUuidListFromPayload(
    payload,
    CARACTERISTICA_ID_KEYS,
    'caracter�sticas de EPI',
  )
  const corIds = collectUuidListFromPayload(payload, COR_ID_KEYS, 'cores')

  const [caracteristicas, cores] = await Promise.all([
    resolveCaracteristicasByIds(caracteristicaIds),
    resolveCoresByIds(corIds),
  ])

  const caracteristicaEpi = buildCatalogoTexto(caracteristicas)
  const corMaterial = buildCatalogoTexto(cores)

  return {
    nome,
    nomeItemRelacionado: nome,
    materialItemNome: nome,
    fabricante,
    fabricanteNome: fabricante,
    validadeDias: payload.validadeDias !== undefined ? Number(payload.validadeDias) : null,
    ca,
    valorUnitario: Number(payload.valorUnitario ?? 0),
    estoqueMinimo:
      payload.estoqueMinimo !== undefined && payload.estoqueMinimo !== null
        ? Number(payload.estoqueMinimo)
        : null,
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
    grupoMaterial: grupoMaterialNome,
    grupoMaterialNome,
    grupoMaterialId: grupoMaterialId || null,
    numeroCalcado,
    numeroVestimenta,
    numeroEspecifico,
    descricao,
    caracteristicaEpi,
    corMaterial,
    caracteristicas,
    cores,
    caracteristicaIds,
    corIds,
  }
}

function validateMaterialPayload(payload) {
  if (!payload.nome) throw createHttpError(400, 'Nome do EPI obrigatorio.')
  if (/\\d/.test(payload.nome)) throw createHttpError(400, 'O campo EPI nao pode conter numeros.')
  if (!payload.grupoMaterial && !payload.grupoMaterialNome) {
    throw createHttpError(400, 'Grupo de material obrigatorio.')
  }
  if (!payload.fabricante && !payload.fabricante)
    throw createHttpError(400, 'Fabricante obrigatorio.')
  }
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw createHttpError(400, 'Validade deve ser maior que zero.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw createHttpError(400, 'Valor unitario deve ser maior que zero.')
  }
  const grupoNome = payload.grupoMaterialNome || payload.grupoMaterial || ''
  if (isGrupo(grupoNome, 'Cal�ado') && !payload.numeroCalcado) {
    throw createHttpError(400, 'Informe o numero do calcado.')
  }
  if (requiresTamanho(grupoNome) && !payload.numeroVestimenta) {
    throw createHttpError(400, 'Informe o tamanho.')
  }
  if (
    payload.estoqueMinimo !== null &&
    (Number.isNaN(Number(payload.estoqueMinimo)) || Number(payload.estoqueMinimo) < 0)
  ) {
    throw createHttpError(400, 'Estoque minimo deve ser zero ou positivo.')
  }
  if (!Array.isArray(payload.caracteristicas) || payload.caracteristicas.length === 0) {
    throw createHttpError(400, 'Informe ao menos uma caracteristica.')
  }
}


const resolveCatalogoNome = (registro) => {
  if (!registro || typeof registro !== 'object') {
    return ''
  }
  const keys = [
    'nome',
    'descricao',
    'label',
    'valor',
    'value',
    'caracteristica_material',
    'caracteristicaMaterial',
    'numero_calcado',
    'numeroCalcado',
    'medidas',
    'tamanho',
    'cor',
    'cor_material',
  ]
  for (const key of keys) {
    const valor = registro[key]
    if (typeof valor === 'string' && valor.trim()) {
      return valor.trim()
    }
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return String(valor)
    }
  }
  return ''
}

const normalizeCatalogoLista = (lista) => {
  const valores = new Set()
  ;(lista ?? []).forEach((item) => {
    const nome = resolveCatalogoNome(item)
    if (nome) {
      valores.add(nome)
    }
  })
  return Array.from(valores).sort((a, b) => a.localeCompare(b))
}

const normalizeDomainOptions = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map((item) => {
      const nome = trim(item?.nome ?? item?.descricao ?? item ?? '')
      if (!nome) {
        return null
      }
      return {
        id: item?.id ?? null,
        nome,
      }
    })
    .filter(Boolean)

async function resolveCentroCustoNome(valor) {
  const raw = trim(valor)
  if (!raw) {
    return ''
  }
  if (!UUID_REGEX.test(raw)) {
    return raw
  }
  try {
    const registro = await executeMaybeSingle(
      supabaseAdmin.from(CENTRO_ESTOQUE_TABLE).select('almox').eq('id', raw),
      'Falha ao consultar centro de estoque.'
    )
    return trim(registro?.almox ?? '') || raw
  } catch (error) {
    console.warn('Nao foi possivel resolver o centro de estoque.', error)
    return raw
  }
}

async function registrarHistoricoEntrada(entrada, material, usuarioNome, entradaAnterior = null) {
  if (!entrada || !entrada.id) {
    return
  }
  try {
    const snapshotAtual = await buildEntradaHistoricoSnapshot(entrada, material, usuarioNome)
    const snapshotAnterior = entradaAnterior ? await buildEntradaHistoricoSnapshot(entradaAnterior, null, usuarioNome) : null
    const payload =
      snapshotAnterior && Object.keys(snapshotAnterior).length > 0
        ? { atual: snapshotAtual, anterior: snapshotAnterior }
        : { atual: snapshotAtual }
    await execute(
      supabaseAdmin.from('entrada_historico').insert({
        id: randomId(),
        entrada_id: entrada.id,
        material_id: snapshotAtual.materialId,
        material_ent: payload,
        usuarioResponsavel: entrada.usuarioResponsavelId || null,
      }),
      'Falha ao registrar historico de entrada.'
    )
  } catch (error) {
    console.warn('Nao foi possivel registrar historico de entrada.', error)
  }
}

async function buildEntradaHistoricoSnapshot(entrada, materialCache = null, usuarioNomePadrao = '') {
  if (!entrada) {
    return null
  }
  const material =
    materialCache && materialCache.id === entrada.materialId
      ? materialCache
      : await obterMaterialPorId(entrada.materialId)
  const centroNome = await resolveCentroCustoNome(entrada.centroCustoId || entrada.centroCusto)
  return {
    entradaId: entrada.id,
    materialId: entrada.materialId,
    materialResumo: buildMaterialResumo(material),
    descricao: material?.descricao ?? '',
    quantidade: entrada.quantidade,
    centroCusto: centroNome || entrada.centroCusto || '',
    centroCustoId: entrada.centroCustoId || '',
    dataEntrada: entrada.dataEntrada,
    usuarioResponsavel: entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || usuarioNomePadrao || '',
    usuarioResponsavelNome: entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || usuarioNomePadrao || '',
    valorUnitario: material?.valorUnitario ?? null,
  }
}

const buildMaterialResumo = (material) => {
  if (!material || typeof material !== 'object') {
    return ''
  }
  const nome =
    material.materialItemNome ||
    material.nome ||
    material.nomeId ||
    material.id ||
    ''
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ''
  const detalhes = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes.join(', ') : '',
  ].filter(Boolean)
  const caracteristicas =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes)
      ? material.caracteristicasNomes.join(', ')
      : '')
  const fabricante = material.fabricanteNome || material.fabricante || ''
  const partes = [nome, grupo, ...detalhes, caracteristicas, fabricante]
  const vistos = new Set()
  const resumo = partes
    .map((parte) => (parte || '').toString().trim())
    .filter((parte) => {
      if (!parte) {
        return false
      }
      const key = parte.toLowerCase()
      if (vistos.has(key)) {
        return false
      }
      vistos.add(key)
      return true
    })
  return resumo.join(' | ')
}

function mapEntradaHistoricoRecord(record) {
  const snapshot = record.material_ent ?? record.materialEnt ?? {}
  const usuarioNome =
    trim(
      record.usuario?.display_name ??
        record.usuario?.username ??
        record.usuario?.email ??
        snapshot.usuarioResponsavelNome ??
        snapshot.usuarioResponsavel ??
        ''
    ) || ''
  return {
    id: record.id,
    entradaId: record.entrada_id ?? snapshot.entradaId ?? null,
    materialId: record.material_id ?? snapshot.materialId ?? null,
    criadoEm: record.created_at ?? record.createdAt ?? null,
    usuarioResponsavel: usuarioNome,
    snapshot,
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MATERIAL_RELATION_ID_KEYS = [
  'id',
  'uuid',
  'catalogoId',
  'catalogo_id',
  'caracteristicaId',
  'caracteristica_id',
  'corId',
  'cor_id',
]

function normalizeMixedArray(value) {
  if (value === undefined || value === null) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return [value]
}

function extractUuidFromCandidate(candidate) {
  if (!candidate) {
    return null
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim()
    if (!trimmed) {
      return null
    }
    if (!UUID_REGEX.test(trimmed)) {
      return undefined
    }
    return trimmed
  }
  if (typeof candidate === 'object') {
    for (const key of MATERIAL_RELATION_ID_KEYS) {
      const valor = candidate[key]
      if (typeof valor === 'string' && UUID_REGEX.test(valor.trim())) {
        return valor.trim()
      }
    }
  }
  return null
}

function collectUuidListFromSources(sources, { label }) {
  const ids = new Set()
  const invalid = new Set()
  sources.forEach((source) => {
    normalizeMixedArray(source).forEach((item) => {
      const uuid = extractUuidFromCandidate(item)
      if (uuid === null) {
        return
      }
      if (uuid === undefined) {
        invalid.add(item)
        return
      }
      ids.add(uuid)
    })
  })

  if (invalid.size > 0) {
    throw createHttpError(400, `Alguns identificadores de ${label} s�o inv�lidos.`)
  }

  return Array.from(ids)
}

function collectUuidListFromPayload(payload, keys, label) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const sources = keys
    .map((key) => payload[key])
    .filter((value) => value !== undefined)

  return collectUuidListFromSources(sources, { label })
}

async function fetchCatalogRecordsByIds({
  table,
  ids,
  nameColumn,
  errorLabel,
  errorMessage,
}) {
  if (!ids || ids.length === 0) {
    return []
  }

  const registros =
    (await execute(
      supabaseAdmin.from(table).select(`id, ${nameColumn}`).in('id', ids),
      errorMessage,
    )) ?? []

  const encontrados = new Set((registros ?? []).map((item) => item.id))
  const faltantes = ids.filter((id) => !encontrados.has(id))
  if (faltantes.length > 0) {
    throw createHttpError(400, `${errorLabel} informadas n�o foram encontradas.`)
  }

  return registros.map((registro) => ({
    id: registro.id,
    nome: resolveCatalogoNome({
      ...registro,
      [nameColumn]: registro[nameColumn],
    }),
  }))
}

async function resolveCaracteristicasByIds(ids) {
  return fetchCatalogRecordsByIds({
    table: 'caracteristica_epi',
    ids,
    nameColumn: 'caracteristica_material',
    errorLabel: 'Caracter�sticas de EPI',
    errorMessage: 'Falha ao consultar caracter�sticas de EPI.',
  })
}

async function resolveCoresByIds(ids) {
  return fetchCatalogRecordsByIds({
    table: 'cor',
    ids,
    nameColumn: 'cor',
    errorLabel: 'Cores',
    errorMessage: 'Falha ao consultar cores.',
  })
}

async function replaceMaterialRelations({
  table,
  materialId,
  columnName,
  values,
  deleteMessage,
  insertMessage,
}) {
  await execute(
    supabaseAdmin.from(table).delete().eq('material_id', materialId),
    deleteMessage,
  )

  if (!values || values.length === 0) {
    return
  }

  const rows = values.map((value) => ({
    material_id: materialId,
    [columnName]: value,
  }))

  await execute(supabaseAdmin.from(table).insert(rows), insertMessage)
}

async function replaceMaterialRelationsWithFallback({
  table,
  materialId,
  columnCandidates,
  values,
  deleteMessage,
  insertMessage,
}) {
  let lastColumnError = null

  for (const columnName of columnCandidates) {
    try {
      await replaceMaterialRelations({
        table,
        materialId,
        columnName,
        values,
        deleteMessage,
        insertMessage,
      })
      return
    } catch (error) {
      if (!error || error.code !== '42703') {
        throw error
      }

      lastColumnError = error
    }
  }

  if (lastColumnError) {
    throw lastColumnError
  }
}

async function replaceMaterialCorVinculos(materialId, corIds) {
  await replaceMaterialRelationsWithFallback({
    table: MATERIAL_COR_RELATION_TABLE,
    materialId,
    columnCandidates: ['grupo_cor_id', 'grupo_material_cor'],
    values: corIds,
    deleteMessage: 'Falha ao limpar v�nculos de cores do material.',
    insertMessage: 'Falha ao vincular cores ao material.',
  })
}

async function replaceMaterialCaracteristicaVinculos(materialId, caracteristicaIds) {
  await replaceMaterialRelationsWithFallback({
    table: MATERIAL_CARACTERISTICA_RELATION_TABLE,
    materialId,
    columnCandidates: [
      'grupo_caracteristica_epi_id',
      'caracteristica_epi_id',
      'grupo_caracteristica_epi',
    ],
    values: caracteristicaIds,
    deleteMessage: 'Falha ao limpar v�nculos de caracter�sticas do material.',
    insertMessage: 'Falha ao vincular caracter�sticas ao material.',
  })
}

async function syncMaterialVinculos(materialId, { corIds, caracteristicaIds }) {
  await replaceMaterialCorVinculos(materialId, corIds)
  await replaceMaterialCaracteristicaVinculos(materialId, caracteristicaIds)
}

const getFirstAvailable = (obj, keys) => {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      if (value !== undefined && value !== null) {
        return value
      }
    }
  }
  return undefined
}

function normalizeMaterialRelationItems(value) {
  const lista = normalizeMixedArray(value)
  const unique = new Map()

  lista.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const uuid = extractUuidFromCandidate(item)
    if (!uuid || uuid === undefined) {
      return
    }

    const nome = resolveCatalogoNome(item)
    if (!nome) {
      return
    }

    if (!unique.has(uuid)) {
      unique.set(uuid, { id: uuid, nome })
    }
  })

  return Array.from(unique.values())
}

const buildCatalogoTexto = (lista) => normalizeCatalogoLista(lista).join('; ')


function sanitizeEntradaPayload(payload = {}) {
  const dataEntradaRaw = trim(payload.dataEntrada)
  let dataEntradaIso = null

  if (!dataEntradaRaw) {
    throw createHttpError(400, 'Data de entrada obrigatoria.')
  }

  dataEntradaIso = toDateOnlyUtcIso(dataEntradaRaw)
  if (!dataEntradaIso) {
    throw createHttpError(400, 'Data de entrada invalida.')
  }

  const centroEstoqueId = trim(payload.centroCusto)
  if (!centroEstoqueId) {
    throw createHttpError(400, 'Centro de estoque obrigatorio.')
  }
  if (!UUID_REGEX.test(centroEstoqueId)) {
    throw createHttpError(400, 'Selecione um centro de estoque valido.')
  }

  return {
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: centroEstoqueId,
    dataEntrada: dataEntradaIso,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
  }
}

function validateEntradaPayload(payload) {
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatorio para entrada.')
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de estoque obrigatorio.')
  if (!payload.dataEntrada) throw createHttpError(400, 'Data de entrada obrigatoria.')
}

function sanitizeSaidaPayload(payload = {}) {
  const dataEntregaRaw = trim(payload.dataEntrega)
  let dataEntregaIso = null

  if (!dataEntregaRaw) {
    throw createHttpError(400, 'Data de entrega obrigatoria.')
  }

  const data = new Date(dataEntregaRaw)
  if (Number.isNaN(data.getTime())) {
    throw createHttpError(400, 'Data de entrega invalida.')
  }

  if (payload.validadeDias) {
    const validade = Number(payload.validadeDias)
    if (!Number.isNaN(validade) && validade > 0) {
      data.setUTCDate(data.getUTCDate() + validade)
    }
  }

  dataEntregaIso = data.toISOString()

  return {
    pessoaId: trim(payload.pessoaId),
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrega: dataEntregaIso,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
    status: trim(payload.status) || 'entregue',
  }
}

function validateSaidaPayload(payload) {
  if (!payload.pessoaId) throw createHttpError(400, 'Pessoa obrigatoria para saida.')
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatorio para saida.')
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatorio.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servico obrigatorio.')
  if (!payload.dataEntrega) throw createHttpError(400, 'Data de entrega obrigatoria.')
}


const sanitizeOptional = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = trim(value)
  return trimmed || null
}

function sanitizeOptionalIntegerString(value, fieldName = 'Valor') {
  const sanitized = sanitizeOptional(value)
  if (sanitized === undefined) {
    return undefined
  }
  if (sanitized === null) {
    return null
  }
  if (!/^[0-9]+$/.test(sanitized)) {
    throw createHttpError(400, `${fieldName} deve conter apenas numeros inteiros.`)
  }
  return sanitized
}

function sanitizeNonNegativeInteger(value, { defaultValue = 0, allowNull = false, fieldName = 'Valor' } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (allowNull) {
      return null
    }
    return defaultValue
  }
  if (!/^-?[0-9]+$/.test(String(value).trim())) {
    throw createHttpError(400, `${fieldName} deve ser um numero inteiro.`)
  }
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || Number.isNaN(numeric)) {
    throw createHttpError(400, `${fieldName} deve ser um numero inteiro.`)
  }
  if (numeric < 0) {
    throw createHttpError(400, `${fieldName} nao pode ser negativo.`)
  }
  return numeric
}

function sanitizeAcidentePayload(payload = {}) {
  const pessoaId = extractUuidFromCandidate(
    payload.pessoaId ?? payload.pessoa_id ?? payload.peopleId ?? payload.people_id
  )
  if (pessoaId === undefined) {
    throw createHttpError(400, 'Pessoa invalida.')
  }
  const agenteId = extractUuidFromCandidate(payload.agenteId ?? payload.agente_id ?? payload.agente)
  if (agenteId === undefined) {
    throw createHttpError(400, 'Agente invalido.')
  }
  const centroServicoId = extractUuidFromCandidate(
    payload.centroServicoId ?? payload.centro_servico_id ?? payload.centroServico_id
  )
  if (centroServicoId === undefined) {
    throw createHttpError(400, 'Centro de servico invalido.')
  }
  const localId = extractUuidFromCandidate(payload.localId ?? payload.local_id)
  if (localId === undefined) {
    throw createHttpError(400, 'Local invalido.')
  }
  const tiposIds = collectUuidListFromPayload(
    payload,
    ['tiposIds', 'tipos_ids', 'tipoIds', 'tipo_ids', 'tipos'],
    'tipos'
  )
  const lesoesIds = collectUuidListFromPayload(
    payload,
    ['lesoesIds', 'lesoes_ids', 'lesaoIds', 'lesao_ids', 'lesoes'],
    'lesoes'
  )
  const partesIds = collectUuidListFromPayload(
    payload,
    ['partesIds', 'partes_ids', 'partesLesionadasIds', 'partes_lesionadas_ids', 'partes', 'partesLesionadas'],
    'partes'
  )
  const cat = sanitizeOptionalIntegerString(payload.cat, 'CAT')
  return {
    pessoaId: pessoaId ?? null,
    agenteId: agenteId ?? null,
    centroServicoId: centroServicoId ?? null,
    localId: localId ?? null,
    tiposIds,
    lesoesIds,
    partesIds,
    matricula: trim(payload.matricula),
    nome: trim(payload.nome),
    cargo: trim(payload.cargo),
    data: payload.data ? new Date(payload.data).toISOString() : '',
    diasPerdidos: sanitizeNonNegativeInteger(payload.diasPerdidos, {
      defaultValue: 0,
      fieldName: 'Dias perdidos',
    }),
    diasDebitados: sanitizeNonNegativeInteger(payload.diasDebitados, {
      defaultValue: 0,
      fieldName: 'Dias debitados',
    }),
    cid: sanitizeOptional(payload.cid),
    cat: cat ?? null,
    observacao: sanitizeOptional(payload.observacao),
    dataEsocial: payload.dataEsocial ? new Date(payload.dataEsocial).toISOString() : null,
    sesmt: Boolean(payload.sesmt),
    dataSesmt: payload.dataSesmt ? new Date(payload.dataSesmt).toISOString() : null,
    esocial: payload.esocial !== undefined ? Boolean(payload.esocial) : Boolean(payload.dataEsocial),
  }
}

function validateAcidentePayload(payload) {
  if (!payload.pessoaId && !payload.matricula) {
    throw createHttpError(400, 'Pessoa obrigatoria')
  }
  if (!payload.centroServicoId) throw createHttpError(400, 'Centro de servico obrigatorio')
  if (!payload.localId) throw createHttpError(400, 'Local obrigatorio')
  if (!payload.agenteId) throw createHttpError(400, 'Agente causador obrigatorio')
  if (!payload.tiposIds || payload.tiposIds.length === 0) {
    throw createHttpError(400, 'Tipo de acidente obrigatorio')
  }
  if (!payload.lesoesIds || payload.lesoesIds.length === 0) {
    throw createHttpError(400, 'Lesao obrigatoria')
  }
  if (!payload.partesIds || payload.partesIds.length === 0) {
    throw createHttpError(400, 'Parte lesionada obrigatoria')
  }
  if (payload.tiposIds.length !== payload.lesoesIds.length) {
    throw createHttpError(400, 'Tipos e lesoes devem ter a mesma quantidade')
  }
  if (!payload.data || Number.isNaN(Date.parse(payload.data))) {
    throw createHttpError(400, 'Data do acidente obrigatoria')
  }
  if (!Number.isInteger(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createHttpError(400, 'Dias perdidos deve ser zero ou positivo')
  }
  if (!Number.isInteger(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createHttpError(400, 'Dias debitados deve ser zero ou positivo')
  }
  if (payload.cat && !/^[0-9]+$/.test(String(payload.cat))) {
    throw createHttpError(400, 'CAT deve conter apenas numeros inteiros')
  }
}

async function obterPessoaPorId(id) {
  return executeMaybeSingle(
    supabaseAdmin.from('pessoas').select('*').eq('id', id),
    'Falha ao obter pessoa.'
  )
}

async function obterPessoaPorMatricula(matricula) {
  if (!matricula) {
    return null
  }
  const pessoa = await executeMaybeSingle(
    supabaseAdmin.from('pessoas').select('*').eq('matricula', matricula).limit(1),
    'Falha ao consultar pessoa por matr�cula.'
  )
  return mapPessoaRecord(pessoa)
}

async function obterPessoaPorNome(nome) {
  if (!nome) {
    return null
  }
  const pattern = `%${nome.trim().replace(/\s+/g, '%')}%`
  const registros =
    (await execute(
      supabaseAdmin.from('pessoas').select('*').ilike('nome', pattern).order('nome').limit(5),
      'Falha ao consultar pessoa por nome.'
    )) ?? []
  if (registros.length === 0) {
    return null
  }
  if (registros.length > 1) {
    throw createHttpError(
      409,
      'Mais de um colaborador encontrado para o nome informado. Refine a busca ou informe a matr???cula.'
    )
  }
  return mapPessoaRecord(registros[0])
}

async function obterMaterialPorId(id) {
  if (!id) {
    return null
  }
  const registro = await executeMaybeSingle(
    supabaseAdmin.from(MATERIAIS_VIEW).select('*').eq('id', id),
    'Falha ao obter material.',
  )
  if (!registro) {
    return null
  }
  return mapMaterialRecord(registro)
}

async function buscarMateriaisPorTermo(termo, limit = 10) {
  const termoNormalizado = trim(termo)
  if (!termoNormalizado) {
    return []
  }
  const limiteSeguro = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(Number(limit), 50))
    : 10
  const like = `%${termoNormalizado.replace(/\s+/g, '%')}%`
  const filtros = [
    `materialItemNome.ilike.${like}`,
    `fabricanteNome.ilike.${like}`,
    `grupoMaterialNome.ilike.${like}`,
    `numeroCalcadoNome.ilike.${like}`,
    `numeroVestimentaNome.ilike.${like}`,
    `numeroEspecifico.ilike.${like}`,
    `ca.ilike.${like}`,
    `descricao.ilike.${like}`,
    `usuarioCadastroNome.ilike.${like}`,
    `usuarioAtualizacaoNome.ilike.${like}`,
    `coresTexto.ilike.${like}`,
    `caracteristicasTexto.ilike.${like}`,
  ]
  const registros = await execute(
    supabaseAdmin
      .from(MATERIAIS_VIEW)
      .select('*')
      .or(filtros.join(','))
      .order('nome', { ascending: true })
      .order('fabricante', { ascending: true, nullsFirst: false })
      .limit(limiteSeguro),
    'Falha ao buscar materiais.',
  )
  return (registros ?? []).map(mapMaterialRecord)
}

function calcularDataTroca(dataEntregaIso, validadeDias) {
  if (!validadeDias) {
    return null
  }
  const data = new Date(dataEntregaIso)
  if (Number.isNaN(data.getTime())) {
    return null
  }
  const prazo = Number(validadeDias)
  if (Number.isNaN(prazo) || prazo <= 0) {
    return null
  }
  data.setUTCDate(data.getUTCDate() + prazo)
  return data.toISOString()
}

async function registrarHistoricoPreco(materialId, valorUnitario, usuario) {
  if (!materialId) {
    return
  }
  await execute(
    supabaseAdmin.from('material_price_history').insert({
      id: randomId(),
      materialId,
      valorUnitario,
      usuarioResponsavel: usuario || 'sistema',
      criadoEm: nowIso(),
    }),
    'Falha ao registrar histórico de preço.'
  )
}

async function carregarMovimentacoes(params) {
  const periodo = parsePeriodo(params)
  const resolvedRange = resolvePeriodoRange(periodo)

  const entradasQuery = supabaseAdmin
    .from('entradas')
    .select('*')
    .order('dataEntrada', { ascending: false })

  const saidasQuery = supabaseAdmin
    .from('saidas')
    .select('*')
    .order('dataEntrega', { ascending: false })

  let entradasFiltered = entradasQuery
  let saidasFiltered = saidasQuery

  if (resolvedRange?.start) {
    const inicioIso = resolvedRange.start.toISOString()
    entradasFiltered = entradasFiltered.gte('dataEntrada', inicioIso)
    saidasFiltered = saidasFiltered.gte('dataEntrega', inicioIso)
  }
  if (resolvedRange?.end) {
    const fimIso = resolvedRange.end.toISOString()
    entradasFiltered = entradasFiltered.lte('dataEntrada', fimIso)
    saidasFiltered = saidasFiltered.lte('dataEntrega', fimIso)
  }

  const [materiaisRegistros, entradas, saidas] = await Promise.all([
    execute(
      supabaseAdmin.from(MATERIAIS_VIEW).select('*').order('nome'),
      'Falha ao listar materiais.',
    ),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saídas.'),
  ])

  const entradasNormalizadas = await preencherCentrosEstoque(
    (entradas ?? []).map(mapEntradaRecord)
  )
  const saidasNormalizadas = (saidas ?? []).map(mapSaidaRecord)

  return {
    materiais: (materiaisRegistros ?? []).map(mapMaterialRecord),
    entradas: entradasNormalizadas,
    saidas: saidasNormalizadas,
    periodo,
  }
}

async function resolveOwnerId(userId) {
  if (!userId) {
    throw createHttpError(400, 'Usuario invalido para resolver owner.')
  }
  const data = await execute(
    supabaseAdmin.rpc('my_owner_id_v2', { p_user_id: userId }),
    'Falha ao resolver owner do usuario.'
  )
  if (!data) {
    throw createHttpError(404, 'Owner nao encontrado para o usuario informado.')
  }
  return Array.isArray(data) ? data[0] : data
}

async function carregarMateriaisPorOwner(ownerId) {
  const registrosIds = await execute(
    supabaseAdmin.from('materiais').select('id').eq('account_owner_id', ownerId),
    'Falha ao listar materiais.'
  )
  const ids = (registrosIds ?? []).map((item) => item.id).filter(Boolean)
  if (!ids.length) {
    return []
  }
  const materiaisRegistros = await execute(
    supabaseAdmin.from(MATERIAIS_VIEW).select('*').in('id', ids).order('nome'),
    'Falha ao listar materiais.'
  )
  return (materiaisRegistros ?? []).map(mapMaterialRecord)
}

async function preencherNomesSaidas(registros = []) {
  const centroCustoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )
  const centroServicoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.centroServicoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )
  const setorIds = Array.from(
    new Set(
      registros
        .map((saida) => saida.setorId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )

  const [centrosCusto, centrosServico, setores] = await Promise.all([
    centroCustoIds.length
      ? execute(
          supabaseAdmin.from('centros_custo').select('id, nome').in('id', centroCustoIds),
          'Falha ao consultar centros de custo.'
        )
      : [],
    centroServicoIds.length
      ? execute(
          supabaseAdmin.from('centros_servico').select('id, nome').in('id', centroServicoIds),
          'Falha ao consultar centros de servico.'
        )
      : [],
    setorIds.length
      ? execute(
          supabaseAdmin.from('setores').select('id, nome').in('id', setorIds),
          'Falha ao consultar setores.'
        )
      : [],
  ])

  const centroCustoMap = new Map(
    (centrosCusto ?? []).map((item) => [item.id, trim(item.nome ?? '')]).filter(([, nome]) => Boolean(nome))
  )
  const centroServicoMap = new Map(
    (centrosServico ?? [])
      .map((item) => [item.id, trim(item.nome ?? '')])
      .filter(([, nome]) => Boolean(nome))
  )
  const setorMap = new Map(
    (setores ?? []).map((item) => [item.id, trim(item.nome ?? '')]).filter(([, nome]) => Boolean(nome))
  )

  return registros.map((saida) => ({
    ...saida,
    centroCusto: centroCustoMap.get(saida.centroCustoId) || saida.centroCusto || '',
    centroServico: centroServicoMap.get(saida.centroServicoId) || saida.centroServico || '',
    setor: setorMap.get(saida.setorId) || saida.setor || '',
  }))
}

async function carregarMovimentacoesPorOwner({ ownerId, periodoRange }) {
  if (!ownerId) {
    return { materiais: [], entradas: [], saidas: [], pessoas: [], periodo: null }
  }
  const entradasQuery = supabaseAdmin.from('entradas').select('*').eq('account_owner_id', ownerId)
  const saidasQuery = supabaseAdmin.from('saidas').select('*').eq('account_owner_id', ownerId)

  let entradasFiltered = entradasQuery
  let saidasFiltered = saidasQuery

  if (periodoRange?.start) {
    const inicioIso = periodoRange.start.toISOString()
    entradasFiltered = entradasFiltered.gte('dataEntrada', inicioIso)
    saidasFiltered = saidasFiltered.gte('dataEntrega', inicioIso)
  }
  if (periodoRange?.end) {
    const fimIso = periodoRange.end.toISOString()
    entradasFiltered = entradasFiltered.lte('dataEntrada', fimIso)
    saidasFiltered = saidasFiltered.lte('dataEntrega', fimIso)
  }

  const [materiais, entradas, saidas, pessoas] = await Promise.all([
    carregarMateriaisPorOwner(ownerId),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saidas.'),
    execute(supabaseAdmin.from('pessoas').select('*').eq('account_owner_id', ownerId), 'Falha ao listar pessoas.'),
  ])

  const entradasNormalizadas = await preencherCentrosEstoque((entradas ?? []).map(mapEntradaRecord))
  const saidasNormalizadas = await preencherNomesSaidas((saidas ?? []).map(mapSaidaRecord))

  return {
    materiais,
    entradas: entradasNormalizadas,
    saidas: saidasNormalizadas,
    pessoas: pessoas ?? [],
  }
}

async function calcularSaldoMaterialAtual(materialId) {
  const [entradas, saidas] = await Promise.all([
    execute(
      supabaseAdmin.from('entradas').select('materialId, quantidade, dataEntrada').eq('materialId', materialId),
      'Falha ao consultar entradas do material.'
    ),
    execute(
      supabaseAdmin.from('saidas').select('materialId, quantidade, dataEntrega').eq('materialId', materialId),
      'Falha ao consultar saídas do material.'
    ),
  ])

  return calcularSaldoMaterial(materialId, entradas, saidas, null)
}

async function obterSaidasDetalhadasPorPessoa(pessoaId) {
  if (!pessoaId) {
    return []
  }
  const registros =
    (await execute(
      supabaseAdmin
        .from('saidas')
        .select(
          `
          id,
          pessoaId,
          materialId,
          quantidade,
          centroCusto,
          centroServico,
          dataEntrega,
          dataTroca,
          status,
          usuarioResponsavel,
          material:materialId (
            id,
            nome,
            fabricante,
            ca,
            numeroEspecifico,
            numeroCalcado,
            numeroVestimenta,
            grupoMaterial
          )
        `
        )
        .eq('pessoaId', pessoaId)
        .order('dataEntrega', { ascending: true }),
      'Falha ao listar saidas do colaborador.'
    )) ?? []

  return registros.map((registro) => {
    const material = mapMaterialResumo(registro.material)
    const saidaNormalizada = mapSaidaRecord(registro)
    return {
      ...saidaNormalizada,
      material,
    }
  })
}

function buildDescricaoMaterial(material) {
  if (!material) {
    return ''
  }
  const partes = [material.nome]
  if (material.fabricante) {
    partes.push(material.fabricante)
  }
  const numeroEspecifico = material.numeroEspecifico || material.numeroCalcado || material.numeroVestimenta
  if (numeroEspecifico) {
    partes.push(numeroEspecifico)
  }
  return partes.filter(Boolean).join(' ')
}

function montarContextoTermoEpi(pessoa, saidas) {
  const entregasOrdenadas = saidas
    .slice()
    .sort((a, b) => {
      const aTime = a.dataEntrega ? new Date(a.dataEntrega).getTime() : 0
      const bTime = b.dataEntrega ? new Date(b.dataEntrega).getTime() : 0
      return aTime - bTime
    })

  const entregas = entregasOrdenadas.map((saida, index) => {
    const quantidade = Number(saida.quantidade ?? 0)
    const numeroCa = saida.material?.ca || ''
    return {
      ordem: index + 1,
      id: saida.id,
      dataEntrega: saida.dataEntrega || null,
      quantidade,
      descricao: buildDescricaoMaterial(saida.material),
      numeroCa,
      centroCusto: saida.centroCusto || '',
      centroServico: saida.centroServico || '',
      status: saida.status || '',
      usuarioResponsavel: saida.usuarioResponsavel || '',
      dataTroca: saida.dataTroca || null,
    }
  })

  const totalItensEntregues = entregas.reduce((acc, entrega) => acc + Number(entrega.quantidade ?? 0), 0)
  const ultimaEntrega =
    entregasOrdenadas.length > 0 ? entregasOrdenadas[entregasOrdenadas.length - 1].dataEntrega || null : null

  return {
    colaborador: {
      id: pessoa.id,
      nome: pessoa.nome || '',
      matricula: pessoa.matricula || '',
      cargo: pessoa.cargo || '',
      centroServico: pessoa.centroServico || pessoa.local || '',
      unidade: pessoa.unidade || pessoa.centroServico || pessoa.local || '',
      dataAdmissao: pessoa.dataAdmissao || null,
      tipoExecucao: pessoa.tipoExecucao || '',
      usuarioCadastro: pessoa.usuarioCadastro || '',
      usuarioEdicao: pessoa.usuarioEdicao || '',
      criadoEm: pessoa.criadoEm || null,
      atualizadoEm: pessoa.atualizadoEm || null,
    },
    entregas,
    totais: {
      quantidadeEntregas: entregas.length,
      totalItensEntregues,
      ultimaEntrega,
    },
  }
}

export const PessoasOperations = {
  async list(params = {}) {
    let query = supabaseAdmin.from('pessoas').select('*').order('nome')

    const centroServico = trim(params.centroServico ?? params.local ?? '')
    if (!isAllFilter(centroServico)) {
      query = query.eq('local', centroServico)
    }

    const cargo = trim(params.cargo ?? '')
    if (!isAllFilter(cargo)) {
      query = query.eq('cargo', cargo)
    }

    const termo = trim(params.termo)
    if (termo) {
      const like = '%' + termo + '%'
      query = query.or(
        [
          `nome.ilike.${like}`,
          `matricula.ilike.${like}`,
          `local.ilike.${like}`,
          `cargo.ilike.${like}`,
          `tipoExecucao.ilike.${like}`,
          `usuarioCadastro.ilike.${like}`,
          `usuarioEdicao.ilike.${like}`,
        ].join(',')
      )
    }

    const pessoas =
      (await execute(query, 'Falha ao listar pessoas.')) ?? []
    return pessoas.map(mapPessoaRecord)
  },
  async create(payload, user) {
    const dados = sanitizePessoaPayload(payload)
    validatePessoaPayload(dados)
    await ensureMatriculaDisponivel(dados.matricula)

    const agora = nowIso()
    const usuario = resolveUsuarioNome(user)

    const pessoa = await executeSingle(
      supabaseAdmin
        .from('pessoas')
        .insert({
          id: randomId(),
          nome: dados.nome,
          matricula: dados.matricula,
          local: dados.centroServico,
          cargo: dados.cargo,
          usuarioCadastro: usuario,
          criadoEm: agora,
          atualizadoEm: null,
          usuarioEdicao: null,
        })
        .select(),
      'Falha ao criar pessoa.'
    )

    return mapPessoaRecord(pessoa)
  },
  async update(id, payload, user) {
    if (!id) {
      throw createHttpError(400, 'Entrada invalida.')
    }
    const dados = sanitizeEntradaPayload(payload)
    validateEntradaPayload(dados)
    const material = await obterMaterialPorId(dados.materialId)
    if (!material) {
      throw createHttpError(404, 'Material nao encontrado.')
    }
    const usuario = resolveUsuarioNome(user)
    const entradaAtualizada = await executeSingle(
      supabaseAdmin
        .from('entradas')
        .update({
          materialId: dados.materialId,
          quantidade: dados.quantidade,
          centroCusto: dados.centroCusto,
          dataEntrada: dados.dataEntrada,
          usuarioResponsavel: usuario,
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar entrada.'
    )
    const normalizada = (
      await preencherUsuariosResponsaveis([mapEntradaRecord(entradaAtualizada)])
    )[0]
    await registrarHistoricoEntrada(normalizada, material, usuario)
    return normalizada
  },

  async get(id) {
    const pessoa = await executeMaybeSingle(
      supabaseAdmin.from('pessoas').select('*').eq('id', id),
      'Falha ao obter pessoa.'
    )
    return mapPessoaRecord(pessoa)
  },
  async history(id) {
    const registros =
      (await execute(
        supabaseAdmin
          .from('pessoas_historico')
          .select('id, data_edicao, usuario_responsavel, campos_alterados')
          .eq('pessoa_id', id)
          .order('data_edicao', { ascending: true }),
        'Falha ao obter hist?rico.'
      )) ?? []
    return normalizePessoaHistorico(registros)
  },
}

export const MateriaisOperations = {
  async list() {
    const registros =
      (await execute(
        supabaseAdmin.from(MATERIAIS_VIEW).select('*').order('nome'),
        'Falha ao listar materiais.',
      )) ?? []
    return registros.map(mapMaterialRecord)
  },
  async search(params = {}) {
    const termo = params?.termo ?? params?.q ?? params?.query ?? ''
    const limit = params?.limit ?? 10
    return buscarMateriaisPorTermo(termo, limit)
  },
  async groups() {
    const registros =
      (await execute(
        supabaseAdmin
          .from('grupos_material')
          .select('id, nome, ativo, ordem')
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('nome', { ascending: true }),
        'Falha ao listar grupos de materiais.'
      )) ?? []
    return registros
      .filter((item) => item && item.nome && item.ativo !== false)
      .map((item) => ({ id: item.id ?? null, nome: item.nome.trim() }))
      .filter((item) => Boolean(item.nome))
  },
  async caracteristicas() {
    const registros = await execute(
      supabaseAdmin
        .from('caracteristica_epi')
        .select('caracteristica_material')
        .order('caracteristica_material'),
      'Falha ao listar caracteristicas de EPI.',
    )
    return normalizeCatalogoLista(registros)
  },
  async fabricantes() {
    const registros = await execute(
      supabaseAdmin
        .from('fabricantes')
        .select('id, fabricante')
        .order('fabricante'),
      'Falha ao listar fabricantes.',
    )
    return (registros ?? [])
      .filter((item) => item && item.fabricante)
      .map((item) => ({ id: item.id ?? null, nome: item.fabricante.trim() }))
      .filter((item) => Boolean(item.nome))
  },
  async cores() {
    const registros = await execute(
      supabaseAdmin.from('cor').select('cor').order('cor'),
      'Falha ao listar cores.',
    )
    return normalizeCatalogoLista(registros)
  },
  async medidasCalcado() {
    const registros = await execute(
      supabaseAdmin
        .from('medidas_calcado')
        .select('numero_calcado')
        .order('numero_calcado'),
      'Falha ao listar medidas de cal�ado.',
    )
    return normalizeCatalogoLista(registros)
  },
  async medidasVestimenta() {
    const registros = await execute(
      supabaseAdmin
        .from('medidas_vestimentas')
        .select('medidas')
        .order('medidas'),
      'Falha ao listar tamanhos.',
    )
    return normalizeCatalogoLista(registros)
  },
  async create(payload, user) {
    const dados = await sanitizeMaterialPayload(payload)
    validateMaterialPayload(dados)

    const agora = nowIso()
    const usuario = resolveUsuarioNome(user)
    const materialId = randomId()

    const materialPayload = {
      id: materialId,
      nome: dados.nome,
      fabricante: dados.fabricante,
      validadeDias: dados.validadeDias,
      ca: dados.ca,
      valorUnitario: dados.valorUnitario,
      estoqueMinimo: dados.estoqueMinimo,
      ativo: dados.ativo,
      grupoMaterial: dados.grupoMaterialId || dados.grupoMaterial,
      numeroCalcado: dados.numeroCalcado,
      numeroVestimenta: dados.numeroVestimenta,
      numeroEspecifico: dados.numeroEspecifico,
      descricao: dados.descricao,
      usuarioCadastro: usuario,
      dataCadastro: agora,
    }

    await executeSingle(
      supabaseAdmin.from('materiais').insert(materialPayload).select('id'),
      'Falha ao criar material.',
    )

    await syncMaterialVinculos(materialId, {
      corIds: dados.corIds || [],
      caracteristicaIds: dados.caracteristicaIds || [],
    })

    await registrarHistoricoPreco(materialId, dados.valorUnitario, usuario)

    return await obterMaterialPorId(materialId)
  },
  async update(id, payload, user) {
    const atual = await obterMaterialPorId(id)
    if (!atual) {
      throw createHttpError(404, 'Material não encontrado.')
    }

    const dados = await sanitizeMaterialPayload({
      ...atual,
      ...payload,
    })
    validateMaterialPayload(dados)

    const usuario = resolveUsuarioNome(user)
    const agora = nowIso()

    await executeSingle(
      supabaseAdmin
        .from('materiais')
        .update({
          nome: dados.nome,
          fabricante: dados.fabricante,
          validadeDias: dados.validadeDias,
          ca: dados.ca,
          valorUnitario: dados.valorUnitario,
          estoqueMinimo: dados.estoqueMinimo,
          ativo: dados.ativo,
          grupoMaterial: dados.grupoMaterialId || dados.grupoMaterial,
          numeroCalcado: dados.numeroCalcado,
          numeroVestimenta: dados.numeroVestimenta,
          numeroEspecifico: dados.numeroEspecifico,
          descricao: dados.descricao,
          usuarioAtualizacao: usuario,
          atualizadoEm: agora,
        })
        .eq('id', id)
        .select('id'),
      'Falha ao atualizar material.',
    )

    await syncMaterialVinculos(id, {
      corIds: dados.corIds || [],
      caracteristicaIds: dados.caracteristicaIds || [],
    })

    if (Number(dados.valorUnitario) !== Number(atual.valorUnitario)) {
      await registrarHistoricoPreco(id, dados.valorUnitario, usuario)
    }

    return await obterMaterialPorId(id)
  },
  async get(id) {
    return await obterMaterialPorId(id)
  },
  async priceHistory(id) {
    return (
      (await execute(
        supabaseAdmin
          .from('material_price_history')
          .select('*')
          .eq('materialId', id)
          .order('criadoEm', { ascending: false }),
        'Falha ao listar histórico de preços.'
      )) ?? []
    )
  },
}

export const EntradasOperations = {
  async list(params = {}) {
    let query = supabaseAdmin
      .from('entradas')
      .select('*')
      .order('dataEntrada', { ascending: false })

    const materialId = trim(params.materialId)
    if (materialId) {
      query = query.eq('materialId', materialId)
    }

    const centroCusto = trim(params.centroCusto)
    let centroFiltroTerm = ''
    if (centroCusto) {
      if (UUID_REGEX.test(centroCusto)) {
        query = query.eq('centro_estoque', centroCusto)
      } else {
        const centroIds = await buscarCentrosEstoqueIdsPorTermo(centroCusto)
        if (centroIds.length) {
          query = query.in('centro_estoque', centroIds)
        } else {
          centroFiltroTerm = normalizeSearchTerm(centroCusto)
        }
      }
    }
    const registradoPor = trim(params.registradoPor)
    if (registradoPor) {
      query = UUID_REGEX.test(registradoPor)
        ? query.eq('usuarioResponsavel', registradoPor)
        : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
    }

    const dataInicio = toStartOfDayIso(params.dataInicio)
    if (dataInicio) {
      query = query.gte('dataEntrada', dataInicio)
    }

    const dataFim = toEndOfDayIso(params.dataFim)
    if (dataFim) {
      query = query.lte('dataEntrada', dataFim)
    }

    let entradas =
      (await execute(query, 'Falha ao listar entradas.')) ?? []
    entradas = await preencherUsuariosResponsaveis(
      entradas.map(mapEntradaRecord)
    )
    entradas = await preencherCentrosEstoque(entradas)
    if (centroFiltroTerm) {
      entradas = entradas.filter((entrada) =>
        normalizeSearchTerm(entrada?.centroCusto).includes(centroFiltroTerm)
      )
    }

    const termo = normalizeSearchTerm(params.termo)
    if (termo) {
      const materiais = await execute(
        supabaseAdmin.from('materiais').select('id, nome, fabricante'),
        'Falha ao listar materiais.'
      )
      const materiaisMap = new Map((materiais ?? []).map((material) => [material.id, material]))
      entradas = entradas.filter((entrada) =>
        matchesEntradaSearch(entrada, termo, materiaisMap)
      )
    }

    return entradas
  },
  async create(payload, user) {
    const dados = sanitizeEntradaPayload(payload)
    validateEntradaPayload(dados)

    const material = await obterMaterialPorId(dados.materialId)
    if (!material) {
      throw createHttpError(404, 'Material não encontrado.')
    }

    const usuario = resolveUsuarioNome(user)

    const entrada = await executeSingle(
        supabaseAdmin
          .from('entradas')
          .insert({
            id: randomId(),
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centro_estoque: dados.centroCusto,
            dataEntrada: dados.dataEntrada,
            usuarioResponsavel: usuario,
          })
        .select(),
      'Falha ao registrar entrada.'
    )

    const normalizada = (
      await preencherCentrosEstoque(
        await preencherUsuariosResponsaveis([mapEntradaRecord(entrada)])
      )
    )[0]
    await registrarHistoricoEntrada(normalizada, material, usuario)
    return normalizada
  },
  async update(id, payload, user) {
    if (!id) {
      throw createHttpError(400, 'Entrada invalida.')
    }
    const registroAtual = await executeMaybeSingle(
      supabaseAdmin.from('entradas').select('*').eq('id', id),
      'Falha ao obter entrada.'
    )
    const entradaAnterior = registroAtual ? mapEntradaRecord(registroAtual) : null
    const dados = sanitizeEntradaPayload(payload)
    validateEntradaPayload(dados)
    const material = await obterMaterialPorId(dados.materialId)
    if (!material) {
      throw createHttpError(404, 'Material nao encontrado.')
    }
    const usuario = resolveUsuarioNome(user)
    const entradaAtualizada = await executeSingle(
      supabaseAdmin
        .from('entradas')
        .update({
          materialId: dados.materialId,
          quantidade: dados.quantidade,
          centro_estoque: dados.centroCusto,
          dataEntrada: dados.dataEntrada,
          usuarioResponsavel: usuario,
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar entrada.'
    )
    const normalizada = (
      await preencherCentrosEstoque(
        await preencherUsuariosResponsaveis([mapEntradaRecord(entradaAtualizada)])
      )
    )[0]
    await registrarHistoricoEntrada(normalizada, material, usuario, entradaAnterior)
    return normalizada
  },
  async history(id) {
    if (!id) {
      throw createHttpError(400, 'Entrada invalida.')
    }
    const registros = await execute(
      supabaseAdmin
        .from('entrada_historico')
        .select(
          `
            id,
            entrada_id,
            material_id,
            material_ent,
            created_at,
            usuarioResponsavel,
            usuario:usuarioResponsavel ( id, display_name, username, email )
          `
        )
        .eq('entrada_id', id)
        .order('created_at', { ascending: false }),
      'Falha ao obter historico da entrada.'
    )
    return (registros ?? []).map(mapEntradaHistoricoRecord)
  },
  async history(id) {
    if (!id) {
      throw createHttpError(400, 'Entrada invalida.')
    }
    const registros = await execute(
      supabaseAdmin
        .from('entrada_historico')
        .select(
          `
            id,
            entrada_id,
            material_id,
            material_ent,
            created_at,
            usuarioResponsavel,
            usuario:usuarioResponsavel ( id, display_name, username, email )
          `
        )
        .eq('entrada_id', id)
        .order('created_at', { ascending: false }),
      'Falha ao obter historico de entrada.'
    )
    return (registros ?? []).map(mapEntradaHistoricoRecord)
  },
}

async function preencherUsuariosResponsaveis(registros) {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((entrada) => entrada.usuarioResponsavelId)
        .filter(Boolean)
    )
  )
  if (!ids.length) {
    return registros.map((entrada) => ({
      ...entrada,
      usuarioResponsavel:
        entrada.usuarioResponsavel && !UUID_REGEX.test(entrada.usuarioResponsavel)
          ? entrada.usuarioResponsavel
          : entrada.usuarioResponsavel || '',
      usuarioResponsavelNome:
        entrada.usuarioResponsavel && !UUID_REGEX.test(entrada.usuarioResponsavel)
          ? entrada.usuarioResponsavel
          : '',
    }))
  }
  const usuarios = await execute(
    supabaseAdmin
      .from('app_users')
      .select('id, display_name, username, email')
      .in('id', ids),
    'Falha ao consultar usuarios.'
  )
  const mapa = new Map(
    (usuarios ?? []).map((usuario) => [
      usuario.id,
      trim(usuario.display_name ?? usuario.username ?? usuario.email ?? ''),
    ])
  )

  return registros.map((entrada) => {
    const nome =
      entrada.usuarioResponsavelId && mapa.has(entrada.usuarioResponsavelId)
        ? mapa.get(entrada.usuarioResponsavelId)
        : entrada.usuarioResponsavel
    return {
      ...entrada,
      usuarioResponsavel: nome || entrada.usuarioResponsavel || '',
      usuarioResponsavelNome: nome || entrada.usuarioResponsavel || '',
    }
  })
}

async function preencherCentrosEstoque(registros = []) {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((entrada) => entrada.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )
  if (!ids.length) {
    return registros
  }
  try {
    const centros = await execute(
      supabaseAdmin
        .from(CENTRO_ESTOQUE_TABLE)
        .select('id, almox')
        .in('id', ids),
      'Falha ao consultar centros de estoque.'
    )
    const mapa = new Map(
      (centros ?? [])
        .map((centro) => [centro.id, trim(centro.almox ?? '')])
        .filter(([, nome]) => Boolean(nome))
    )
    if (!mapa.size) {
      return registros
    }
    return registros.map((entrada) => {
      if (!entrada.centroCustoId) {
        return entrada
      }
      const nome =
        mapa.get(entrada.centroCustoId)
      if (!nome) {
        return entrada
      }
      return {
        ...entrada,
        centroCusto: nome,
        centroCustoNome: nome,
      }
    })
  } catch (error) {
    console.warn('Falha ao resolver centros de estoque.', error)
    return registros
  }
}

async function buscarCentrosEstoqueIdsPorTermo(valor) {
  const termo = trim(valor)
  if (!termo) {
    return []
  }
  const like = `%${termo.replace(/\s+/g, '%')}%`
  try {
    const registros = await execute(
      supabaseAdmin.from(CENTRO_ESTOQUE_TABLE).select('id').ilike('almox', like).limit(50),
      'Falha ao consultar centros de estoque.'
    )
    return (registros ?? []).map((item) => item?.id).filter(Boolean)
  } catch (error) {
    console.warn('Falha ao aplicar filtro por centro de estoque.', error)
    return []
  }
}

export const SaidasOperations = {
  async list(params = {}) {
    let query = supabaseAdmin
      .from('saidas')
      .select('*')
      .order('dataEntrega', { ascending: false })

    const pessoaId = trim(params.pessoaId)
    if (pessoaId) {
      query = query.eq('pessoaId', pessoaId)
    }

    const materialId = trim(params.materialId)
    if (materialId) {
      query = query.eq('materialId', materialId)
    }

    const status = trim(params.status)
    if (status) {
      query = query.eq('status', status)
    }

    const registradoPor = trim(params.registradoPor)
    if (registradoPor) {
      query = UUID_REGEX.test(registradoPor)
        ? query.eq('usuarioResponsavel', registradoPor)
        : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
    }

    const centroCusto = trim(params.centroCusto)
    if (centroCusto) {
      query = query.ilike('centroCusto', centroCusto)
    }

    const centroServico = trim(params.centroServico)
    if (centroServico) {
      query = query.ilike('centroServico', centroServico)
    }

    const dataInicio = toStartOfDayIso(params.dataInicio)
    if (dataInicio) {
      query = query.gte('dataEntrega', dataInicio)
    }

    const dataFim = toEndOfDayIso(params.dataFim)
    if (dataFim) {
      query = query.lte('dataEntrega', dataFim)
    }

    let saidas =
      (await execute(query, 'Falha ao listar sa�das.')) ?? []
    saidas = saidas.map(mapSaidaRecord)

    const termo = normalizeSearchTerm(params.termo)
    if (termo) {
      const [pessoas, materiais] = await Promise.all([
        execute(
          supabaseAdmin.from('pessoas').select('id, nome, local, centroServico'),
          'Falha ao listar pessoas.'
        ),
        execute(
          supabaseAdmin.from('materiais').select('id, nome, fabricante'),
          'Falha ao listar materiais.'
        ),
      ])
      const pessoasMap = new Map((pessoas ?? []).map((pessoa) => [pessoa.id, mapPessoaRecord(pessoa)]))
      const materiaisMap = new Map((materiais ?? []).map((material) => [material.id, material]))
      saidas = saidas.filter((saida) =>
        matchesSaidaSearch(saida, termo, pessoasMap, materiaisMap)
      )
    }

    return saidas
  },
  async create(payload, user) {
    const dados = sanitizeSaidaPayload(payload)
    validateSaidaPayload(dados)

    const [pessoa, material] = await Promise.all([
      obterPessoaPorId(dados.pessoaId),
      obterMaterialPorId(dados.materialId),
    ])

    if (!pessoa) {
      throw createHttpError(404, 'Pessoa não encontrada.')
    }
    if (!material) {
      throw createHttpError(404, 'Material não encontrado.')
    }

    const estoqueDisponivel = await calcularSaldoMaterialAtual(material.id)
    if (Number(dados.quantidade) > estoqueDisponivel) {
      throw createHttpError(400, 'Quantidade informada maior que estoque disponível.')
    }

    const centroServico = dados.centroServico || pessoa.centroServico || pessoa.local || ''
    const dataTroca = calcularDataTroca(dados.dataEntrega, material.validadeDias)
    const usuario = resolveUsuarioNome(user)

    const saida = await executeSingle(
      supabaseAdmin
        .from('saidas')
        .insert({
          id: randomId(),
          pessoaId: dados.pessoaId,
          materialId: dados.materialId,
          quantidade: dados.quantidade,
                centroServico: dados.centroServico,
          dataEntrega: dados.dataEntrega,
          usuarioResponsavel: usuario,
          status: dados.status,
          dataTroca,
        })
        .select(),
      'Falha ao registrar saída.'
    )

    return {
      ...mapSaidaRecord(saida),
      estoqueAtual: estoqueDisponivel - Number(dados.quantidade),
    }
  },
}

async function loadReportTemplate(tipo) {
  if (tipo === REPORT_TYPE_TRIMESTRAL) {
    return readFile(REPORT_TEMPLATE_TRIMESTRAL, 'utf8')
  }
  return readFile(REPORT_TEMPLATE_MENSAL, 'utf8')
}

function renderReportTemplate(template, context = {}) {
  if (!template) return ''
  return template.replace(/{{\\s*([^}]+)\\s*}}/g, (_match, key) => {
    const value = context[key]
    if (value === undefined || value === null) {
      return ''
    }
    return String(value)
  })
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderReportHtml(template, context = {}) {
  const texto = renderReportTemplate(template, context)
  const safe = escapeHtml(texto)
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Relatorio de estoque</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 32px; }
      .report { white-space: pre-wrap; line-height: 1.5; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="report">${safe}</div>
  </body>
</html>`
}


function calcularVariacaoPercentual(atual, anterior) {
  const atualNum = Number(atual ?? 0)
  const anteriorNum = Number(anterior ?? 0)
  if (anteriorNum === 0) {
    return atualNum === 0 ? 0 : 100
  }
  return ((atualNum - anteriorNum) / anteriorNum) * 100
}

function interpretarVariacao(variacao, positivo, negativo) {
  if (variacao > DEFAULT_VARIACAO_RELEVANTE * 100) return positivo
  if (variacao < -DEFAULT_VARIACAO_RELEVANTE * 100) return negativo
  return 'Estavel'
}

function formatQuarterLabel(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  const month = date.getUTCMonth() + 1
  const quarter = Math.floor((month - 1) / 3) + 1
  const year = date.getUTCFullYear()
  return `T${quarter}/${year}`
}

function buildParetoResumo(pareto) {
  const totalMateriais = pareto.lista.length
  const itensA = pareto.lista.filter((item) => item.classe === 'A')
  const percentualMateriais = totalMateriais ? (itensA.length / totalMateriais) * 100 : 0
  const ultimoA = itensA.length ? itensA[itensA.length - 1] : null
  const percentualPareto = ultimoA?.percentualAcumulado ?? 0
  return { percentualMateriais, percentualPareto }
}

function buildListaPareto(lista = [], valueKey, valueFormatter, maxItems = 10) {
  const linhas = lista.slice(0, maxItems).map((item) => {
    const valor = valueFormatter ? valueFormatter(item?.[valueKey]) : item?.[valueKey]
    const acumulado = formatPercent(item?.percentualAcumulado ?? 0)
    return `${item?.nome || item?.descricao || 'Nao informado'} - ${valor} - ${acumulado}`
  })
  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildListaCriticos(lista = []) {
  const linhas = lista.map((item) => item?.nome || item?.descricao || 'Nao informado')
  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildListaConsumo(setores = [], centros = []) {
  const linhas = []
  setores.slice(0, 5).forEach((item) => {
    linhas.push(`Setor: ${item.nome || 'Nao informado'} - ${formatNumber(item.quantidade)}`)
  })
  centros.slice(0, 5).forEach((item) => {
    linhas.push(`Centro: ${item.nome || 'Nao informado'} - ${formatNumber(item.quantidade)}`)
  })
  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildListaFinanceiro(pareto = [], categorias = []) {
  const linhas = []
  pareto.slice(0, 5).forEach((item) => {
    linhas.push(`Material: ${item.nome || 'Nao informado'} - ${formatCurrency(item.valorTotal)}`)
  })
  categorias.slice(0, 5).forEach((item) => {
    linhas.push(`Categoria: ${item.nome || 'Nao informado'} - ${formatCurrency(item.valorTotal)}`)
  })
  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildCoberturaResumo(consumoPorTrabalhador) {
  if (consumoPorTrabalhador === null) {
    return { status: 'SEM DADOS', interpretacao: 'Sem trabalhadores ativos no periodo.' }
  }
  if (consumoPorTrabalhador >= 1) {
    return { status: 'OK', interpretacao: 'Cobertura adequada para o consumo medio atual.' }
  }
  if (consumoPorTrabalhador >= 0.5) {
    return { status: 'ATENCAO', interpretacao: 'Cobertura moderada, requer acompanhamento.' }
  }
  return { status: 'CRITICO', interpretacao: 'Cobertura baixa para o consumo observado.' }
}

function buildNivelRiscoResumo(qtdCriticos, qtdAtencao) {
  if (qtdCriticos > 0) return 'CRITICO'
  if (qtdAtencao > 0) return 'ATENCAO'
  return 'OK'
}

function buildReportSummary({ dashboard, pessoas = [], periodoRange, termo, estoqueBase }) {
  const termoNormalizado = normalizarTermo(termo)
  const entradasDetalhadas = filtrarPorTermo(dashboard?.entradasDetalhadas ?? [], termoNormalizado)
  const saidasDetalhadas = filtrarPorTermo(dashboard?.saidasDetalhadas ?? [], termoNormalizado)

  const saidasResumo = buildSaidasResumo(saidasDetalhadas)
  const diasPeriodo = calcularDiasPeriodo(periodoRange)

  const totalEntradasQuantidade = entradasDetalhadas.reduce(
    (acc, item) => acc + Number(item.quantidade ?? 0),
    0
  )
  const totalSaidasQuantidade = saidasDetalhadas.reduce(
    (acc, item) => acc + Number(item.quantidade ?? 0),
    0
  )
  const totalEntradasValor = entradasDetalhadas.reduce(
    (acc, item) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
    0
  )
  const totalSaidasValor = saidasDetalhadas.reduce(
    (acc, item) => acc + Number(item.material?.valorUnitario ?? 0) * Number(item.quantidade ?? 0),
    0
  )
  const totalMovimentacoes = entradasDetalhadas.length + saidasDetalhadas.length

  const p80Quantidade = computePercentile(saidasResumo.map((item) => item.quantidade), 0.8)
  const p90Quantidade = computePercentile(saidasResumo.map((item) => item.quantidade), 0.9)
  const p80Giro = diasPeriodo
    ? computePercentile(saidasResumo.map((item) => item.quantidade / diasPeriodo), 0.8)
    : 0

  const riscoLista = buildRiscoOperacional({
    saidasResumo,
    estoqueAtual: estoqueBase?.itens ?? dashboard?.estoqueAtual?.itens ?? [],
    diasPeriodo,
    p80Quantidade,
    p90Quantidade,
    p80Giro,
  })

  const paretoQuantidade = buildParetoList(saidasResumo, 'quantidade')
  const paretoFinanceiro = buildParetoList(saidasResumo, 'valorTotal')
  const paretoRisco = buildParetoList(riscoLista.filter((item) => item.score > 0), 'score')
  const paretoResumo = buildParetoResumo(paretoQuantidade)

  const categorias = buildResumoPorCategoria(saidasResumo)
  const setores = buildResumoPorSetor(saidasDetalhadas)
  const centros = buildResumoPorCentroServico(saidasDetalhadas)
  const centrosCusto = buildResumoPorCentroCusto(saidasDetalhadas)

  const qtdCriticos = riscoLista.filter((item) => item.classe === 'A').length
  const qtdAtencao = riscoLista.filter((item) => item.classe === 'B').length
  const qtdControlados = riscoLista.filter((item) => item.classe === 'C').length

  const criticosLista = riscoLista.filter((item) => item.classe === 'A')
  const criticosIds = new Set(criticosLista.map((item) => item.materialId))

  const hoje = new Date()
  const limiteVencendo = new Date()
  limiteVencendo.setDate(limiteVencendo.getDate() + 30)

  let qtdVencidos = 0
  let qtdVencendo = 0
  saidasDetalhadas.forEach((saida) => {
    if (!saida?.dataTroca) return
    const dataTroca = new Date(saida.dataTroca)
    if (Number.isNaN(dataTroca.getTime())) return
    if (dataTroca < hoje) qtdVencidos += 1
    else if (dataTroca <= limiteVencendo) qtdVencendo += 1
  })

  const qtdExcesso = riscoLista.filter(
    (item) => item.estoqueAtual > item.pressaoVidaUtil * 1.5 && item.pressaoVidaUtil > 0
  ).length
  const qtdRiscosImediatos = riscoLista.filter((item) => item.flags?.rupturaPressao).length
  const qtdAbaixoMinimo = riscoLista.filter((item) => item.flags?.estoqueBaixo).length

  const pessoasAtivas = (pessoas ?? []).filter((pessoa) => pessoa?.ativo !== false)
  const consumoPorTrabalhador =
    pessoasAtivas.length > 0 ? totalSaidasQuantidade / pessoasAtivas.length : null
  const coberturaResumo = buildCoberturaResumo(consumoPorTrabalhador)

  const baseGiro = criticosLista.length ? criticosLista : riscoLista
  const giroMedioCriticos = baseGiro.length
    ? baseGiro.reduce((acc, item) => acc + Number(item.giroDiario ?? 0), 0) / baseGiro.length
    : 0

  return {
    entradasDetalhadas,
    saidasDetalhadas,
    saidasResumo,
    diasPeriodo,
    totalEntradasQuantidade,
    totalSaidasQuantidade,
    totalEntradasValor,
    totalSaidasValor,
    totalMovimentacoes,
    paretoQuantidade,
    paretoFinanceiro,
    paretoRisco,
    paretoResumo,
    categorias,
    setores,
    centros,
    centrosCusto,
    qtdCriticos,
    qtdAtencao,
    qtdControlados,
    criticosLista,
    criticosIds,
    qtdVencidos,
    qtdVencendo,
    qtdExcesso,
    qtdRiscosImediatos,
    qtdAbaixoMinimo,
    consumoPorTrabalhador,
    coberturaResumo,
    giroMedioCriticos,
    valorTotalMovimentado: totalEntradasValor + totalSaidasValor,
    alertasAtivos: estoqueBase?.alertas?.length ?? dashboard?.estoqueAtual?.alertas?.length ?? 0,
  }
}

function buildMonthlyContext({ resumo, periodoRange }) {
  const nivelRisco = buildNivelRiscoResumo(resumo.qtdCriticos, resumo.qtdAtencao)
  const listaParetoQuantidade = buildListaPareto(
    resumo.paretoQuantidade.lista,
    'quantidade',
    formatNumber
  )
  const listaParetoValor = buildListaFinanceiro(resumo.paretoFinanceiro.lista, resumo.categorias)
  const listaCriticos = buildListaCriticos(resumo.criticosLista)
  const listaConsumoSetor = buildListaConsumo(resumo.setores, resumo.centros)

  return {
    mes_referencia: formatMonthRef(periodoRange?.start),
    periodo_inicio: formatDateBr(periodoRange?.start),
    periodo_fim: formatDateBr(periodoRange?.end),
    data_emissao: formatDateBr(new Date()),
    total_movimentacoes: formatNumber(resumo.totalMovimentacoes),
    total_entradas: formatNumber(resumo.entradasDetalhadas.length),
    total_saidas: formatNumber(resumo.saidasDetalhadas.length),
    valor_total_movimentado: formatCurrency(resumo.valorTotalMovimentado),
    alertas_ativos: formatNumber(resumo.alertasAtivos),
    nivel_risco_geral: nivelRisco,
    status_estoque: nivelRisco,
    percentual_pareto: formatPercent(resumo.paretoResumo.percentualPareto),
    percentual_materiais: formatPercent(resumo.paretoResumo.percentualMateriais),
    lista_pareto_quantidade: listaParetoQuantidade,
    qtd_criticos: formatNumber(resumo.qtdCriticos),
    qtd_atencao: formatNumber(resumo.qtdAtencao),
    qtd_controlados: formatNumber(resumo.qtdControlados),
    lista_materiais_criticos: listaCriticos,
    lista_pareto_valor: listaParetoValor,
    lista_consumo_setor: listaConsumoSetor,
    qtd_vencidos: formatNumber(resumo.qtdVencidos),
    qtd_vencendo: formatNumber(resumo.qtdVencendo),
    qtd_excesso: formatNumber(resumo.qtdExcesso),
    status_cobertura: resumo.coberturaResumo.status,
    interpretacao_cobertura: resumo.coberturaResumo.interpretacao,
    qtd_abaixo_minimo: formatNumber(resumo.qtdAbaixoMinimo),
    qtd_riscos_imediatos: formatNumber(resumo.qtdRiscosImediatos),
    status_final: nivelRisco,
  }
}

function buildQuarterContext({ resumoAtual, resumoAnterior, periodoRange, periodoAnteriorRange }) {
  const variacaoValor = calcularVariacaoPercentual(
    resumoAtual.valorTotalMovimentado,
    resumoAnterior.valorTotalMovimentado
  )
  const variacaoQtd = calcularVariacaoPercentual(
    resumoAtual.totalSaidasQuantidade,
    resumoAnterior.totalSaidasQuantidade
  )
  const variacaoConsumo = calcularVariacaoPercentual(
    resumoAtual.consumoPorTrabalhador ?? 0,
    resumoAnterior.consumoPorTrabalhador ?? 0
  )
  const variacaoGiro = calcularVariacaoPercentual(
    resumoAtual.giroMedioCriticos,
    resumoAnterior.giroMedioCriticos
  )

  const diagnosticoTrimestral = interpretarVariacao(
    variacaoValor,
    resumoAtual.totalSaidasQuantidade >= resumoAnterior.totalSaidasQuantidade
      ? 'Aumento justificado por maior uso'
      : 'Aumento por custo ou desperdicio',
    'Reducao de consumo'
  )

  const evolucaoPareto =
    resumoAtual.qtdCriticos > resumoAnterior.qtdCriticos
      ? 'Concentracao maior'
      : resumoAtual.qtdCriticos < resumoAnterior.qtdCriticos
        ? 'Mais distribuida'
        : 'Estavel'

  const interpretacaoRisco =
    resumoAtual.qtdCriticos > resumoAnterior.qtdCriticos
      ? 'Risco aumentado no trimestre atual.'
      : resumoAtual.qtdCriticos < resumoAnterior.qtdCriticos
        ? 'Risco reduzido no trimestre atual.'
        : 'Risco estavel entre trimestres.'

  const novosRiscos = resumoAtual.criticosLista.filter((item) => !resumoAnterior.criticosIds.has(item.materialId))
  const riscosRecorrentes = resumoAtual.criticosLista.filter((item) => resumoAnterior.criticosIds.has(item.materialId))
  const riscosResolvidos = resumoAnterior.criticosLista.filter((item) => !resumoAtual.criticosIds.has(item.materialId))

  const nivelRiscoFinal = buildNivelRiscoResumo(resumoAtual.qtdCriticos, resumoAtual.qtdAtencao)

  return {
    trimestre_atual: formatQuarterLabel(periodoRange?.start),
    trimestre_anterior: formatQuarterLabel(periodoAnteriorRange?.start),
    periodo_inicio: formatDateBr(periodoRange?.start),
    periodo_fim: formatDateBr(periodoRange?.end),
    data_emissao: formatDateBr(new Date()),
    valor_trimestre_atual: formatCurrency(resumoAtual.valorTotalMovimentado),
    valor_trimestre_anterior: formatCurrency(resumoAnterior.valorTotalMovimentado),
    variacao_percentual_valor: formatPercent(variacaoValor),
    qtd_saida_trimestre_atual: formatNumber(resumoAtual.totalSaidasQuantidade),
    qtd_saida_trimestre_anterior: formatNumber(resumoAnterior.totalSaidasQuantidade),
    variacao_percentual_quantidade: formatPercent(variacaoQtd),
    diagnostico_trimestral: diagnosticoTrimestral,
    interpretacao_variacao_quantidade: interpretarVariacao(
      variacaoQtd,
      'Aumento de consumo no trimestre.',
      'Reducao de consumo no trimestre.'
    ),
    interpretacao_variacao_valor: interpretarVariacao(
      variacaoValor,
      'Aumento de gasto no trimestre.',
      'Reducao de gasto no trimestre.'
    ),
    percentual_pareto: formatPercent(resumoAtual.paretoResumo.percentualPareto),
    percentual_materiais: formatPercent(resumoAtual.paretoResumo.percentualMateriais),
    qtd_criticos_atual: formatNumber(resumoAtual.qtdCriticos),
    qtd_criticos_anterior: formatNumber(resumoAnterior.qtdCriticos),
    evolucao_pareto: evolucaoPareto,
    criticos_atual: formatNumber(resumoAtual.qtdCriticos),
    criticos_anterior: formatNumber(resumoAnterior.qtdCriticos),
    atencao_atual: formatNumber(resumoAtual.qtdAtencao),
    atencao_anterior: formatNumber(resumoAnterior.qtdAtencao),
    controlado_atual: formatNumber(resumoAtual.qtdControlados),
    controlado_anterior: formatNumber(resumoAnterior.qtdControlados),
    interpretacao_risco_trimestral: interpretacaoRisco,
    consumo_trabalhador_atual: formatNumber(resumoAtual.consumoPorTrabalhador ?? 0, 2),
    consumo_trabalhador_anterior: formatNumber(resumoAnterior.consumoPorTrabalhador ?? 0, 2),
    variacao_consumo_trabalhador: formatPercent(variacaoConsumo),
    diagnostico_consumo_trabalhador: interpretarVariacao(
      variacaoConsumo,
      'Consumo medio por trabalhador aumentou.',
      'Consumo medio por trabalhador reduziu.'
    ),
    giro_diario_atual: formatNumber(resumoAtual.giroMedioCriticos, 2),
    giro_diario_anterior: formatNumber(resumoAnterior.giroMedioCriticos, 2),
    interpretacao_giro: interpretarVariacao(
      variacaoGiro,
      'Giro mais acelerado no trimestre atual.',
      'Giro mais baixo no trimestre atual.'
    ),
    qtd_vencendo_atual: formatNumber(resumoAtual.qtdVencendo),
    qtd_vencendo_anterior: formatNumber(resumoAnterior.qtdVencendo),
    evolucao_perdas: interpretarVariacao(
      calcularVariacaoPercentual(resumoAtual.qtdVencendo, resumoAnterior.qtdVencendo),
      'Perdas em aumento.',
      'Perdas em reducao.'
    ),
    novos_riscos: formatNumber(novosRiscos.length),
    riscos_recorrentes: formatNumber(riscosRecorrentes.length),
    riscos_resolvidos: formatNumber(riscosResolvidos.length),
    nivel_risco_final: nivelRiscoFinal,
    status_trimestral_final: diagnosticoTrimestral,
  }
}

async function resolveReportTypeFromPeriodo(periodoInicio, periodoFim) {
  const diffMeses = diffMesesInclusivo(periodoInicio, periodoFim)
  if (diffMeses === 1) return REPORT_TYPE_MENSAL
  if (diffMeses === 3) return REPORT_TYPE_TRIMESTRAL
  throw createHttpError(400, 'Periodo precisa ser mensal ou trimestral.')
}

async function listarAdminsOwner(ownerId, credenciaisAdminIds) {
  if (!ownerId) return []
  const credIds = credenciaisAdminIds ?? []
  if (!credIds.length) return []

  const { data } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, email, parent_user_id, credential')
    .in('credential', credIds)
    .or(`id.eq.${ownerId},parent_user_id.eq.${ownerId}`)

  return (data ?? [])
    .filter((item) => item?.email)
    .map((item) => ({
      id: item.id,
      nome: trim(item.display_name ?? item.username ?? item.email ?? ''),
      email: trim(item.email ?? ''),
    }))
    .filter((item) => item.email)
}

async function carregarCredenciaisAdminIds() {
  const registros = await execute(
    supabaseAdmin.from('app_credentials_catalog').select('id_text'),
    'Falha ao listar credenciais.'
  )
  const credenciais = Array.from(
    new Set(
      (registros ?? [])
        .map((item) => String(item.id_text ?? '').trim().toLowerCase())
        .filter((id) => id && ['admin', 'master'].includes(id))
    )
  )

  return credenciais.length ? credenciais : ['admin', 'master']
}

async function obterUsuarioPorId(userId) {
  if (!userId) return null
  const registro = await executeMaybeSingle(
    supabaseAdmin.from('app_users').select('id, username, display_name, email').eq('id', userId),
    'Falha ao consultar usuario.'
  )
  return registro ?? null
}

async function sendBrevoEmail({ sender, to, subject, text }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim()
  if (!apiKey) {
    return { ok: false, error: 'BREVO_API_KEY nao configurada.' }
  }
  if (!to?.length) {
    return { ok: false, error: 'Sem destinatarios para envio.' }
  }

  const payload = {
    sender,
    to,
    subject,
    textContent: text,
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { ok: false, error: errorText || `Erro ao enviar email (${response.status}).` }
  }

  return { ok: true }
}

function buildReportSummaryPayload({ dashboard, pessoas, periodoRange, termo, estoqueBase }) {
  const resumo = buildReportSummary({ dashboard, pessoas, periodoRange, termo, estoqueBase })
  return resumo
}

async function buildInventoryReport({
  ownerId,
  createdById,
  periodoInicio,
  periodoFim,
  termo,
  tipo,
  origem,
  periodoRange,
  periodoRangeAnterior,
  dadosAtual,
  dadosAnterior,
}) {
  const resumoAtual = buildReportSummaryPayload({
    dashboard: dadosAtual.dashboard,
    pessoas: dadosAtual.pessoas,
    periodoRange,
    termo,
    estoqueBase: dadosAtual.estoqueBase,
  })

  const resumoAnterior = dadosAnterior
    ? buildReportSummaryPayload({
        dashboard: dadosAnterior.dashboard,
        pessoas: dadosAnterior.pessoas,
        periodoRange: periodoRangeAnterior,
        termo,
        estoqueBase: dadosAnterior.estoqueBase,
      })
    : null

  const context =
    tipo === REPORT_TYPE_TRIMESTRAL && resumoAnterior
      ? buildQuarterContext({
          resumoAtual,
          resumoAnterior,
          periodoRange,
          periodoAnteriorRange: periodoRangeAnterior,
        })
      : buildMonthlyContext({ resumo: resumoAtual, periodoRange })

  const template = await loadReportTemplate(tipo)
  const texto = renderReportTemplate(template, context)

  const metadados = {
    tipo,
    origem,
    contexto: context,
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    pesos_risco: DEFAULT_RISK_WEIGHTS,
    limites_risco: DEFAULT_RISK_THRESHOLDS,
    variacao_relevante: DEFAULT_VARIACAO_RELEVANTE,
    totais: {
      entradas: resumoAtual.totalEntradasQuantidade,
      saidas: resumoAtual.totalSaidasQuantidade,
    },
  }

  const registro = await executeSingle(
    supabaseAdmin
      .from('inventory_report')
      .insert({
        account_owner_id: ownerId,
        created_by: createdById,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        termo: termo || '',
        pareto_saida: resumoAtual.paretoQuantidade,
        pareto_risco: resumoAtual.paretoRisco,
        pareto_financeiro: resumoAtual.paretoFinanceiro,
        metadados,
      })
      .select('id, created_at'),
    'Falha ao registrar relatorio de estoque.'
  )

  return {
    registro,
    texto,
    tipo,
    metadados,
    resumoAtual,
    resumoAnterior,
  }
}

async function resolveEarliestMovimentacao(ownerId) {
  const [entrada, saida] = await Promise.all([
    executeMaybeSingle(
      supabaseAdmin
        .from('entradas')
        .select('dataEntrada')
        .eq('account_owner_id', ownerId)
        .order('dataEntrada', { ascending: true })
        .limit(1),
      'Falha ao consultar entradas.'
    ),
    executeMaybeSingle(
      supabaseAdmin
        .from('saidas')
        .select('dataEntrega')
        .eq('account_owner_id', ownerId)
        .order('dataEntrega', { ascending: true })
        .limit(1),
      'Falha ao consultar saidas.'
    ),
  ])

  const datas = []
  if (entrada?.dataEntrada) {
    const data = new Date(entrada.dataEntrada)
    if (!Number.isNaN(data.getTime())) datas.push(data)
  }
  if (saida?.dataEntrega) {
    const data = new Date(saida.dataEntrega)
    if (!Number.isNaN(data.getTime())) datas.push(data)
  }
  if (!datas.length) {
    return null
  }
  return new Date(Math.min(...datas.map((data) => data.getTime())))
}

async function loadReportRegistry(ownerId, tipo) {
  const registros = await execute(
    supabaseAdmin
      .from('inventory_report')
      .select('periodo_inicio, periodo_fim')
      .eq('account_owner_id', ownerId)
      .eq('metadados->>tipo', tipo),
    'Falha ao consultar relatorios.'
  )
  const set = new Set()
  registros?.forEach((item) => {
    const key = `${item?.periodo_inicio || ''}|${item?.periodo_fim || ''}`
    if (key !== '|') {
      set.add(key)
    }
  })
  return set
}

export const EstoqueOperations = {
  async current(params = {}) {
    const { materiais, entradas, saidas, periodo } = await carregarMovimentacoes(params)
    return montarEstoqueAtual(materiais, entradas, saidas, periodo)
  },
  async dashboard(params = {}) {
    const [{ materiais, entradas, saidas, periodo }, pessoas] = await Promise.all([
      carregarMovimentacoes(params),
      execute(supabaseAdmin.from('pessoas').select('*'), 'Falha ao listar pessoas.'),
    ])
    return montarDashboard({ materiais, entradas, saidas, pessoas }, periodo)
  },
  async report(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para gerar relatorio.')
    }
    const periodoInicio = trim(params.periodoInicio || params.periodo_inicio)
    const periodoFim = trim(params.periodoFim || params.periodo_fim)
    if (!periodoInicio || !periodoFim) {
      throw createHttpError(400, 'Periodo inicial e final sao obrigatorios.')
    }
    const tipo = await resolveReportTypeFromPeriodo(periodoInicio, periodoFim)
    const ownerId = await resolveOwnerId(user.id)
    const periodo = parsePeriodo({ periodoInicio, periodoFim })
    const periodoRange = resolvePeriodoRange(periodo)
    const termo = trim(params.termo)
    if (!periodoRange?.start || !periodoRange?.end) {
      throw createHttpError(400, 'Periodo invalido para gerar relatorio.')
    }

    const dadosAtual = await carregarMovimentacoesPorOwner({ ownerId, periodoRange })
    const estoqueBaseAtual = montarEstoqueAtual(
      dadosAtual.materiais,
      dadosAtual.entradas,
      dadosAtual.saidas,
      null,
    )
    const dashboardAtual = montarDashboard(
      {
        materiais: dadosAtual.materiais,
        entradas: dadosAtual.entradas,
        saidas: dadosAtual.saidas,
        pessoas: dadosAtual.pessoas,
      },
      periodo
    )

    const resumoAtual = buildReportSummary({
      dashboard: dashboardAtual,
      pessoas: dadosAtual.pessoas,
      periodoRange,
      termo,
      estoqueBase: estoqueBaseAtual,
    })
    if (resumoAtual.totalMovimentacoes === 0) {
      throw createHttpError(404, 'Nenhuma movimentacao encontrada para o periodo informado.')
    }

    let dadosAnterior = null
    let periodoRangeAnterior = null
    if (tipo === REPORT_TYPE_TRIMESTRAL) {
      const inicioAnterior = new Date(periodoRange.start)
      inicioAnterior.setUTCMonth(inicioAnterior.getUTCMonth() - 3)
      const fimAnterior = new Date(periodoRange.end)
      fimAnterior.setUTCMonth(fimAnterior.getUTCMonth() - 3)
      periodoRangeAnterior = { start: inicioAnterior, end: fimAnterior }

      const dadosPrev = await carregarMovimentacoesPorOwner({ ownerId, periodoRange: periodoRangeAnterior })
      const estoqueBasePrev = montarEstoqueAtual(
        dadosPrev.materiais,
        dadosPrev.entradas,
        dadosPrev.saidas,
        null,
      )
      const dashboardPrev = montarDashboard(
        {
          materiais: dadosPrev.materiais,
          entradas: dadosPrev.entradas,
          saidas: dadosPrev.saidas,
          pessoas: dadosPrev.pessoas,
        },
        parsePeriodo({
          periodoInicio: `${inicioAnterior.getUTCFullYear()}-${String(inicioAnterior.getUTCMonth() + 1).padStart(2, '0')}`,
          periodoFim: `${fimAnterior.getUTCFullYear()}-${String(fimAnterior.getUTCMonth() + 1).padStart(2, '0')}`,
        })
      )
      const resumoAnterior = buildReportSummary({
        dashboard: dashboardPrev,
        pessoas: dadosPrev.pessoas,
        periodoRange: periodoRangeAnterior,
        termo,
        estoqueBase: estoqueBasePrev,
      })
      if (resumoAnterior.totalMovimentacoes === 0) {
        throw createHttpError(404, 'Sem dados no trimestre anterior para comparacao.')
      }
      dadosAnterior = { dashboard: dashboardPrev, pessoas: dadosPrev.pessoas, estoqueBase: estoqueBasePrev }
    }

    const report = await buildInventoryReport({
      ownerId,
      createdById: user.id,
      periodoInicio: toDateOnly(periodoRange.start),
      periodoFim: toDateOnly(periodoRange.end),
      termo,
      tipo,
      origem: 'manual',
      periodoRange,
      periodoRangeAnterior,
      dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
      dadosAnterior,
    })

    const credenciaisAdminIds = await carregarCredenciaisAdminIds()
    const admins = await listarAdminsOwner(ownerId, credenciaisAdminIds)
    const usuario = await obterUsuarioPorId(user.id)
    const senderEmail = usuario?.email || admins[0]?.email || ''
    const senderName = trim(usuario?.display_name ?? usuario?.username ?? usuario?.email ?? 'Sistema')

    let emailStatus = { ok: false, error: 'Sem destinatarios.' }
    if (senderEmail && admins.length) {
      const subject =
        tipo === REPORT_TYPE_TRIMESTRAL
          ? `Relatorio trimestral de estoque - ${formatQuarterLabel(periodoRange.start)}`
          : `Relatorio mensal de estoque - ${formatMonthRef(periodoRange.start)}`
      emailStatus = await sendBrevoEmail({
        sender: { name: senderName, email: senderEmail },
        to: admins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email })),
        subject,
        text: report.texto,
      })
    }

    return {
      reportId: report.registro?.id ?? null,
      createdAt: report.registro?.created_at ?? null,
      tipo,
      sent: Boolean(emailStatus.ok),
      emailError: emailStatus.ok ? null : emailStatus.error,
    }
  },
  async reportHistory(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para consultar relatorios.')
    }
    const ownerId = await resolveOwnerId(user.id)
    const tipoRaw = trim(params.tipo)
    const tipo = tipoRaw && tipoRaw !== 'todos' ? tipoRaw.toLowerCase() : ''
    const mesRange = resolveMonthRangeFromString(params.mes)
    const trimestreRange = resolveQuarterRangeFromParams(params.ano, params.trimestre)

    let query = supabaseAdmin
      .from('inventory_report')
      .select(
        'id, created_at, created_by, periodo_inicio, periodo_fim, termo, metadados, pdf_gerado_em, pdf_gerado_por'
      )
      .eq('account_owner_id', ownerId)

    if (tipo) {
      query = query.eq('metadados->>tipo', tipo)
    }
    if (mesRange) {
      query = query
        .eq('periodo_inicio', toDateOnly(mesRange.start))
        .eq('periodo_fim', toDateOnly(mesRange.end))
        .eq('metadados->>tipo', REPORT_TYPE_MENSAL)
    }
    if (trimestreRange) {
      query = query
        .eq('periodo_inicio', toDateOnly(trimestreRange.start))
        .eq('periodo_fim', toDateOnly(trimestreRange.end))
        .eq('metadados->>tipo', REPORT_TYPE_TRIMESTRAL)
    }

    const items = await execute(
      query.order('periodo_inicio', { ascending: false }).order('created_at', { ascending: false }),
      'Falha ao listar relatorios de estoque.'
    )

    return { items: items ?? [] }
  },
  async reportPdf(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para gerar PDF.')
    }
    const reportId = trim(params.reportId || params.id)
    if (!reportId) {
      throw createHttpError(400, 'ID do relatorio obrigatorio.')
    }
    const ownerId = await resolveOwnerId(user.id)
    const registro = await executeMaybeSingle(
      supabaseAdmin
        .from('inventory_report')
        .select('id, periodo_inicio, periodo_fim, metadados, pdf_gerado_em')
        .eq('account_owner_id', ownerId)
        .eq('id', reportId)
        .limit(1),
      'Falha ao consultar relatorio de estoque.'
    )
    if (!registro) {
      throw createHttpError(404, 'Relatorio nao encontrado.')
    }

    const agora = new Date()
    const mesRef = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`
    const metadados = registro?.metadados && typeof registro.metadados === 'object' ? registro.metadados : {}
    const geracoesRef = metadados.pdf_geracoes_mes_ref || ''
    const geracoesAtual =
      geracoesRef === mesRef ? Number(metadados.pdf_geracoes_mes ?? 0) : 0
    if (geracoesAtual >= PDF_REPORT_LIMIT_PER_MONTH) {
      throw createHttpError(429, 'PDF ja gerado para este relatorio no mes atual.')
    }

    const tipo = registro?.metadados?.tipo
    const contexto = registro?.metadados?.contexto
    if (!tipo || !contexto) {
      throw createHttpError(400, 'Contexto do relatorio nao encontrado para gerar PDF.')
    }

    const template = await loadReportTemplate(tipo)
    const html = renderReportHtml(template, contexto)
    const atualizacao = await executeSingle(
      supabaseAdmin
        .from('inventory_report')
        .update({
          pdf_gerado_em: nowIso(),
          pdf_gerado_por: user.id,
          metadados: {
            ...metadados,
            pdf_geracoes_mes_ref: mesRef,
            pdf_geracoes_mes: geracoesAtual + 1,
          },
        })
        .eq('account_owner_id', ownerId)
        .eq('id', reportId)
        .select('pdf_gerado_em'),
      'Falha ao registrar geracao de PDF.'
    )

    return {
      reportId: registro.id,
      tipo,
      periodo_inicio: registro.periodo_inicio,
      periodo_fim: registro.periodo_fim,
      pdfGeradoEm: atualizacao?.pdf_gerado_em ?? null,
      html,
    }
  },
  async forecast(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para previsao de gasto.')
    }
    const ownerId = await resolveOwnerId(user.id)
    const fatorInput = params?.fator_tendencia ?? params?.fatorTendencia ?? params?.fator
    if (fatorInput !== undefined && fatorInput !== null && String(fatorInput).trim() !== '') {
      return execute(
        supabaseAdmin.rpc('rpc_previsao_gasto_mensal_calcular', {
          p_owner_id: ownerId,
          p_fator_tendencia: Number(fatorInput),
        }),
        'Falha ao calcular previsao de gasto.'
      )
    }
    return execute(
      supabaseAdmin.rpc('rpc_previsao_gasto_mensal_consultar', { p_owner_id: ownerId }),
      'Falha ao consultar previsao de gasto.'
    )
  },
  async reportAuto() {
    const credenciaisAdminIds = await carregarCredenciaisAdminIds()
    const owners = await execute(
      supabaseAdmin
        .from('app_users')
        .select('id, email, username, display_name, ativo, parent_user_id')
        .is('parent_user_id', null),
      'Falha ao listar owners.'
    )

    const resultados = []
    const agora = new Date()
    const isUltimoDiaMes = isLastDayOfMonthUtc(agora)
    const monthLimit = isUltimoDiaMes
      ? toEndOfMonthUtc(agora)
      : toEndOfMonthUtc(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 0)))
    const currentQuarterStart = resolveQuarterStart(agora)
    const currentQuarterEnd = resolveQuarterEnd(agora)
    const isQuarterEndMonth = [2, 5, 8, 11].includes(agora.getUTCMonth())
    const quarterLimit = isUltimoDiaMes && isQuarterEndMonth
      ? currentQuarterEnd
      : new Date(Date.UTC(currentQuarterStart.getUTCFullYear(), currentQuarterStart.getUTCMonth(), 0))

    for (const owner of owners ?? []) {
      if (owner?.ativo === false) {
        continue
      }
      const ownerId = owner.id
      if (!ownerId) continue

      const ownerAdmins = await listarAdminsOwner(ownerId, credenciaisAdminIds)
      const senderEmail = trim(owner.email ?? '') || ownerAdmins[0]?.email || ''
      const senderName = trim(owner.display_name ?? owner.username ?? owner.email ?? 'Sistema')

      const earliestDate = await resolveEarliestMovimentacao(ownerId)
      if (!earliestDate) {
        resultados.push({
          ownerId,
          skipped: true,
          reason: 'sem_movimentacoes',
        })
        continue
      }

      const mensalRegistrados = await loadReportRegistry(ownerId, REPORT_TYPE_MENSAL)
      const trimestralRegistrados = await loadReportRegistry(ownerId, REPORT_TYPE_TRIMESTRAL)

      // Mensal (mes corrente fechado no ultimo dia, com backfill)
      const meses = buildMonthPeriods(earliestDate, monthLimit)
      for (const periodoRange of meses) {
        const chave = `${toDateOnly(periodoRange.start)}|${toDateOnly(periodoRange.end)}`
        if (mensalRegistrados.has(chave)) {
          continue
        }

        const dadosAtual = await carregarMovimentacoesPorOwner({ ownerId, periodoRange })
        const estoqueBaseAtual = montarEstoqueAtual(
          dadosAtual.materiais,
          dadosAtual.entradas,
          dadosAtual.saidas,
          null,
        )
        const dashboardAtual = montarDashboard(
          {
            materiais: dadosAtual.materiais,
            entradas: dadosAtual.entradas,
            saidas: dadosAtual.saidas,
            pessoas: dadosAtual.pessoas,
          },
          parsePeriodo({
            periodoInicio: `${periodoRange.start.getUTCFullYear()}-${String(periodoRange.start.getUTCMonth() + 1).padStart(2, '0')}`,
            periodoFim: `${periodoRange.end.getUTCFullYear()}-${String(periodoRange.end.getUTCMonth() + 1).padStart(2, '0')}`,
          })
        )
        const resumoAtual = buildReportSummary({
          dashboard: dashboardAtual,
          pessoas: dadosAtual.pessoas,
          periodoRange,
          termo: '',
          estoqueBase: estoqueBaseAtual,
        })
        if (resumoAtual.totalMovimentacoes === 0) {
          resultados.push({
            ownerId,
            tipo: REPORT_TYPE_MENSAL,
            skipped: true,
            reason: 'sem_dados_periodo',
            periodo_inicio: toDateOnly(periodoRange.start),
            periodo_fim: toDateOnly(periodoRange.end),
          })
          continue
        }

        const report = await buildInventoryReport({
          ownerId,
          createdById: ownerId,
          periodoInicio: toDateOnly(periodoRange.start),
          periodoFim: toDateOnly(periodoRange.end),
          termo: '',
          tipo: REPORT_TYPE_MENSAL,
          origem: 'auto',
          periodoRange,
          dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
        })

        let emailStatus = { ok: false, error: 'Sem destinatarios.' }
        if (senderEmail && ownerAdmins.length) {
          emailStatus = await sendBrevoEmail({
            sender: { name: senderName, email: senderEmail },
            to: ownerAdmins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email })),
            subject: `Relatorio mensal de estoque - ${formatMonthRef(periodoRange.start)}`,
            text: report.texto,
          })
        }

        mensalRegistrados.add(chave)
        resultados.push({
          ownerId,
          tipo: REPORT_TYPE_MENSAL,
          periodo_inicio: toDateOnly(periodoRange.start),
          periodo_fim: toDateOnly(periodoRange.end),
          reportId: report.registro?.id ?? null,
          sent: Boolean(emailStatus.ok),
          emailError: emailStatus.ok ? null : emailStatus.error,
        })
      }

      // Trimestral (trimestres fechados com backfill)
      const trimestreLimiteValido = quarterLimit && quarterLimit.getTime() > 0
      if (trimestreLimiteValido) {
        const trimestres = buildQuarterPeriods(earliestDate, quarterLimit)
        for (const periodoRange of trimestres) {
          const chave = `${toDateOnly(periodoRange.start)}|${toDateOnly(periodoRange.end)}`
          if (trimestralRegistrados.has(chave)) {
            continue
          }

          const periodoRangeAnterior = resolvePreviousQuarterRange(periodoRange.start)
          if (!periodoRangeAnterior?.start || !periodoRangeAnterior?.end) {
            continue
          }

          const dadosAtual = await carregarMovimentacoesPorOwner({ ownerId, periodoRange })
          const estoqueBaseAtual = montarEstoqueAtual(
            dadosAtual.materiais,
            dadosAtual.entradas,
            dadosAtual.saidas,
            null,
          )
          const dashboardAtual = montarDashboard(
            {
              materiais: dadosAtual.materiais,
              entradas: dadosAtual.entradas,
              saidas: dadosAtual.saidas,
              pessoas: dadosAtual.pessoas,
            },
            parsePeriodo({
              periodoInicio: `${periodoRange.start.getUTCFullYear()}-${String(periodoRange.start.getUTCMonth() + 1).padStart(2, '0')}`,
              periodoFim: `${periodoRange.end.getUTCFullYear()}-${String(periodoRange.end.getUTCMonth() + 1).padStart(2, '0')}`,
            })
          )
          const resumoAtual = buildReportSummary({
            dashboard: dashboardAtual,
            pessoas: dadosAtual.pessoas,
            periodoRange,
            termo: '',
            estoqueBase: estoqueBaseAtual,
          })
          if (resumoAtual.totalMovimentacoes === 0) {
            resultados.push({
              ownerId,
              tipo: REPORT_TYPE_TRIMESTRAL,
              skipped: true,
              reason: 'sem_dados_trimestre_atual',
              periodo_inicio: toDateOnly(periodoRange.start),
              periodo_fim: toDateOnly(periodoRange.end),
            })
            continue
          }

          const dadosPrev = await carregarMovimentacoesPorOwner({ ownerId, periodoRange: periodoRangeAnterior })
          const estoqueBasePrev = montarEstoqueAtual(
            dadosPrev.materiais,
            dadosPrev.entradas,
            dadosPrev.saidas,
            null,
          )
          const dashboardPrev = montarDashboard(
            {
              materiais: dadosPrev.materiais,
              entradas: dadosPrev.entradas,
              saidas: dadosPrev.saidas,
              pessoas: dadosPrev.pessoas,
            },
            parsePeriodo({
              periodoInicio: `${periodoRangeAnterior.start.getUTCFullYear()}-${String(periodoRangeAnterior.start.getUTCMonth() + 1).padStart(2, '0')}`,
              periodoFim: `${periodoRangeAnterior.end.getUTCFullYear()}-${String(periodoRangeAnterior.end.getUTCMonth() + 1).padStart(2, '0')}`,
            })
          )
          const resumoAnterior = buildReportSummary({
            dashboard: dashboardPrev,
            pessoas: dadosPrev.pessoas,
            periodoRange: periodoRangeAnterior,
            termo: '',
            estoqueBase: estoqueBasePrev,
          })
          if (resumoAnterior.totalMovimentacoes === 0) {
            resultados.push({
              ownerId,
              tipo: REPORT_TYPE_TRIMESTRAL,
              skipped: true,
              reason: 'sem_dados_trimestre_anterior',
              periodo_inicio: toDateOnly(periodoRange.start),
              periodo_fim: toDateOnly(periodoRange.end),
            })
            continue
          }

          const report = await buildInventoryReport({
            ownerId,
            createdById: ownerId,
            periodoInicio: toDateOnly(periodoRange.start),
            periodoFim: toDateOnly(periodoRange.end),
            termo: '',
            tipo: REPORT_TYPE_TRIMESTRAL,
            origem: 'auto',
            periodoRange,
            periodoRangeAnterior,
            dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
            dadosAnterior: { dashboard: dashboardPrev, pessoas: dadosPrev.pessoas, estoqueBase: estoqueBasePrev },
          })

          let emailStatus = { ok: false, error: 'Sem destinatarios.' }
          if (senderEmail && ownerAdmins.length) {
            emailStatus = await sendBrevoEmail({
              sender: { name: senderName, email: senderEmail },
              to: ownerAdmins.map((admin) => ({ name: admin.nome || admin.email, email: admin.email })),
              subject: `Relatorio trimestral de estoque - ${formatQuarterLabel(periodoRange.start)}`,
              text: report.texto,
            })
          }

          trimestralRegistrados.add(chave)
          resultados.push({
            ownerId,
            tipo: REPORT_TYPE_TRIMESTRAL,
            periodo_inicio: toDateOnly(periodoRange.start),
            periodo_fim: toDateOnly(periodoRange.end),
            reportId: report.registro?.id ?? null,
            sent: Boolean(emailStatus.ok),
            emailError: emailStatus.ok ? null : emailStatus.error,
          })
        }
      }

      if (isUltimoDiaMes) {
        try {
          await execute(
            supabaseAdmin.rpc('rpc_previsao_gasto_mensal_calcular', { p_owner_id: ownerId }),
            'Falha ao calcular previsao de gasto.'
          )
        } catch (error) {
          resultados.push({
            ownerId,
            tipo: 'previsao',
            skipped: true,
            reason: 'erro_previsao',
          })
        }
      }
    }

    return { ok: true, resultados }
  },
}

export const DocumentosOperations = {
  async termoEpiContext(params = {}) {
    if (CONSUME_LOCAL_DATA) {
      return getLocalTermoContext(params)
    }

    const matricula = trim(params.matricula)
    const nome = trim(params.nome)

    if (!matricula && !nome) {
      throw createHttpError(400, 'Informe a matricula ou o nome do colaborador.')
    }

    let pessoa = null
    if (matricula) {
      pessoa = await obterPessoaPorMatricula(matricula)
    }
    if (!pessoa && nome) {
      pessoa = await obterPessoaPorNome(nome)
    }

    if (!pessoa) {
      throw createHttpError(404, 'Colaborador nao encontrado para os dados informados.')
    }

    const saidas = await obterSaidasDetalhadasPorPessoa(pessoa.id)
    if (saidas.length === 0) {
      throw createHttpError(404, 'Nenhuma saida registrada para o colaborador informado.')
    }

    const contextoBase = montarContextoTermoEpi(pessoa, saidas)
    return {
      ...contextoBase,
      empresa: resolveEmpresaInfo(),
      origem: 'remoto',
    }
  },
}

export const AcidentesOperations = {
  async list() {
    const acidentes =
      (await execute(
        supabaseAdmin.from('vw_acidentes').select('*').order('data', { ascending: false }),
        'Falha ao listar acidentes.'
      )) ?? []
    return acidentes.map(mapAcidenteRecord)
  },
  async create(payload, user) {
    const dados = sanitizeAcidentePayload(payload)
    validateAcidentePayload(dados)

    let pessoaId = dados.pessoaId
    if (!pessoaId) {
      const pessoa = await obterPessoaPorMatricula(dados.matricula)
      if (!pessoa) {
        throw createHttpError(404, 'Pessoa nao encontrada para a matricula informada.')
      }
      pessoaId = pessoa.id
    }

    const usuario = resolveUsuarioNome(user)

    const acidente = await executeSingle(
      supabaseAdmin.rpc('rpc_acidentes_create_full', {
        p_pessoa_id: pessoaId,
        p_data: dados.data,
        p_dias_perdidos: dados.diasPerdidos,
        p_dias_debitados: dados.diasDebitados,
        p_cid: dados.cid,
        p_centro_servico_id: dados.centroServicoId,
        p_local_id: dados.localId,
        p_cat: dados.cat,
        p_observacao: dados.observacao,
        p_data_esocial: dados.dataEsocial,
        p_esocial: dados.esocial,
        p_sesmt: dados.sesmt,
        p_data_sesmt: dados.dataSesmt,
        p_agente_id: dados.agenteId,
        p_tipos_ids: dados.tiposIds,
        p_lesoes_ids: dados.lesoesIds,
        p_partes_ids: dados.partesIds,
        p_registrado_por: usuario,
      }),
      'Falha ao registrar acidente.'
    )

    const completo = await executeMaybeSingle(
      supabaseAdmin.from('vw_acidentes').select('*').eq('id', acidente.id),
      'Falha ao obter acidente.'
    )
    return mapAcidenteRecord(completo ?? acidente)
  },

}

export async function healthCheck() {
  const { error } = await supabaseAdmin
    .from('materiais')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (error) {
    throw mapSupabaseError(error, GENERIC_SUPABASE_ERROR)
  }
  return { status: 'ok' }
}

export const CentrosCustoOperations = {
  async list() {
    const registros = await execute(
      supabaseAdmin.from(CENTRO_ESTOQUE_TABLE).select('id, almox').order('almox'),
      'Falha ao listar centros de estoque.'
    )
    const normalizados = (registros ?? [])
      .map((item) => ({
        id: item?.id ?? null,
        nome: trim(item?.almox ?? ''),
      }))
      .filter((item) => item.nome)
    return normalizeDomainOptions(normalizados)
  },
}









