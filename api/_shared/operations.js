import { randomUUID } from 'node:crypto'
import { supabaseAdmin, createUserClient } from './supabaseClient.js'
import { CONSUME_LOCAL_DATA } from './environment.js'
const loadLocalTermoContext = async () => {
  const module = await import('./localDocumentContext.js')
  return module.getLocalTermoContext
}
import {
  parsePeriodo,
  resolvePeriodoRange,
  montarEstoqueAtual,
  montarDashboard,
  calcularSaldoMaterial,
} from '../../src/lib/estoque.js'
import {
  normalizarTermo,
  filtrarPorTermo,
  resolveCentroServicoDisplay,
} from '../../src/utils/dashboardEstoqueUtils.js'
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
import { buildRelatorioEstoqueHtml } from '../../shared/documents/relatorioEstoqueTemplate.js'
import { PDF_REPORT_LIMIT_PER_MONTH } from '../../src/config/RelatorioEstoqueConfig.js'
import { resolveUsuarioNome } from './auth.js'
import { createHttpError } from './http.js'
import { resolveOwnerId } from './tenant.js'

const GENERIC_SUPABASE_ERROR = 'Falha ao comunicar com o Supabase.'

const DEFAULT_MATERIAIS_VIEW = 'materiais_view'
const MATERIAIS_VIEW = process.env.MATERIAIS_VIEW || DEFAULT_MATERIAIS_VIEW
const MATERIAL_COR_RELATION_TABLE = 'material_grupo_cor'
const MATERIAL_CARACTERISTICA_RELATION_TABLE = 'material_grupo_caracteristica_epi'
const CENTRO_ESTOQUE_TABLE = 'centros_estoque'
const REPORT_TYPE_MENSAL = 'mensal'

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

function formatAnoMesLabel(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${month}/${year}`
}

function buildMediaMovel(series, index) {
  const start = Math.max(0, index - 2)
  const slice = series.slice(start, index + 1)
  if (!slice.length) return 0
  const total = slice.reduce((acc, item) => acc + item, 0)
  return Number((total / slice.length).toFixed(2))
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

const pickParam = (payload, keys, fallback = null) => {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }
  for (const key of keys) {
    if (payload[key] !== undefined) {
      return payload[key]
    }
  }
  return fallback
}

const requireAuthToken = (token) => {
  const resolved = typeof token === 'string' ? token.trim() : ''
  if (!resolved) {
    throw createHttpError(401, 'Autorizacao requerida.', { code: 'AUTH_REQUIRED' })
  }
  return resolved
}

const buildUserClient = (token) => createUserClient(requireAuthToken(token))

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
  if (!payload.fabricante && !payload.fabricanteNome) {
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

async function preencherNomesPessoas(registros = [], ownerId) {
  const centroServicoIds = Array.from(
    new Set(
      registros
        .map((pessoa) => pessoa?.centro_servico_id || pessoa?.centroServicoId || pessoa?.centroServico_id)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )
  const centroCustoIds = Array.from(
    new Set(
      registros
        .map((pessoa) => pessoa?.centro_custo_id || pessoa?.centroCustoId || pessoa?.centroCusto_id)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )
  const setorIds = Array.from(
    new Set(
      registros
        .map((pessoa) => pessoa?.setor_id || pessoa?.setorId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor)))
    )
  )

  const [centrosServico, centrosCusto, setores] = await Promise.all([
    centroServicoIds.length
      ? execute(
          supabaseAdmin
            .from('centros_servico')
            .select('id, nome')
            .in('id', centroServicoIds)
            .eq('account_owner_id', ownerId),
          'Falha ao consultar centros de servico.'
        )
      : [],
    centroCustoIds.length
      ? execute(
          supabaseAdmin
            .from('centros_custo')
            .select('id, nome')
            .in('id', centroCustoIds)
            .eq('account_owner_id', ownerId),
          'Falha ao consultar centros de custo.'
        )
      : [],
    setorIds.length
      ? execute(
          supabaseAdmin
            .from('setores')
            .select('id, nome')
            .in('id', setorIds)
            .eq('account_owner_id', ownerId),
          'Falha ao consultar setores.'
        )
      : [],
  ])

  const centroServicoMap = new Map(
    (centrosServico ?? []).map((item) => [item.id, trim(item.nome ?? '')]).filter(([, nome]) => Boolean(nome))
  )
  const centroCustoMap = new Map(
    (centrosCusto ?? []).map((item) => [item.id, trim(item.nome ?? '')]).filter(([, nome]) => Boolean(nome))
  )
  const setorMap = new Map(
    (setores ?? []).map((item) => [item.id, trim(item.nome ?? '')]).filter(([, nome]) => Boolean(nome))
  )

  return (registros ?? []).map((pessoa) => {
    const centroServicoNome =
      centroServicoMap.get(pessoa?.centro_servico_id || pessoa?.centroServicoId || pessoa?.centroServico_id) ||
      trim(pessoa?.centroServico ?? pessoa?.centro_servico ?? '')
    const centroCustoNome =
      centroCustoMap.get(pessoa?.centro_custo_id || pessoa?.centroCustoId || pessoa?.centroCusto_id) ||
      trim(pessoa?.centroCusto ?? pessoa?.centro_custo ?? '')
    const setorNome = setorMap.get(pessoa?.setor_id || pessoa?.setorId) || trim(pessoa?.setor ?? '')
    const localNome = centroServicoNome || centroCustoNome || trim(pessoa?.local ?? '')

    return {
      ...pessoa,
      centroServico: centroServicoNome,
      centroCusto: centroCustoNome,
      setor: setorNome,
      local: localNome,
    }
  })
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

  const [materiais, entradas, saidas, pessoasBase] = await Promise.all([
    carregarMateriaisPorOwner(ownerId),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saidas.'),
    execute(supabaseAdmin.from('pessoas').select('*').eq('account_owner_id', ownerId), 'Falha ao listar pessoas.'),
  ])

  const entradasNormalizadas = await preencherCentrosEstoque((entradas ?? []).map(mapEntradaRecord))
  const saidasNormalizadas = await preencherNomesSaidas((saidas ?? []).map(mapSaidaRecord))
  const pessoas = await preencherNomesPessoas(pessoasBase ?? [], ownerId)

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
  async create(payload, user, authToken) {
    const params = {
      p_nome: pickParam(payload, ['p_nome', 'nome']),
      p_matricula: pickParam(payload, ['p_matricula', 'matricula']),
      p_observacao: pickParam(payload, ['p_observacao', 'observacao']),
      p_data_admissao: pickParam(payload, ['p_data_admissao', 'dataAdmissao', 'data_admissao']),
      p_data_demissao: pickParam(payload, ['p_data_demissao', 'dataDemissao', 'data_demissao']),
      p_centro_servico_id: pickParam(payload, ['p_centro_servico_id', 'centroServicoId', 'centro_servico_id']),
      p_setor_id: pickParam(payload, ['p_setor_id', 'setorId', 'setor_id']),
      p_cargo_id: pickParam(payload, ['p_cargo_id', 'cargoId', 'cargo_id']),
      p_centro_custo_id: pickParam(payload, ['p_centro_custo_id', 'centroCustoId', 'centro_custo_id']),
      p_tipo_execucao_id: pickParam(payload, ['p_tipo_execucao_id', 'tipoExecucaoId', 'tipo_execucao_id']),
      p_ativo: pickParam(payload, ['p_ativo', 'ativo']),
      p_usuario_id: pickParam(payload, ['p_usuario_id'], user?.id ?? null),
    }

    const client = buildUserClient(authToken)
    const pessoa = await executeSingle(
      client.rpc('rpc_pessoas_create_full', params),
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
          .select('id, nome, ativo')
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
  async create(payload, user, authToken) {
    const params = {
      p_material: pickParam(payload, ['p_material', 'material']),
      p_cores_ids: pickParam(payload, ['p_cores_ids', 'coresIds', 'cores_ids'], []),
      p_caracteristicas_ids: pickParam(
        payload,
        ['p_caracteristicas_ids', 'caracteristicasIds', 'caracteristicas_ids'],
        []
      ),
    }
    if (!params.p_material) {
      throw createHttpError(400, 'Payload de material invalido.', { code: 'VALIDATION_ERROR' })
    }

    const client = buildUserClient(authToken)
    const created = await executeSingle(
      client.rpc('material_create_full', params),
      'Falha ao criar material.'
    )
    const materialId = created?.id
    if (!materialId) {
      throw createHttpError(500, 'Falha ao criar material.')
    }
    const usuario = resolveUsuarioNome(user)
    const valorUnitario = params.p_material?.valorUnitario ?? params.p_material?.valor_unitario ?? 0
    await registrarHistoricoPreco(materialId, valorUnitario, usuario)

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
  async create(payload, user, authToken) {
    const params = {
      p_material_id: pickParam(payload, ['p_material_id', 'materialId', 'material_id']),
      p_quantidade: pickParam(payload, ['p_quantidade', 'quantidade']),
      p_centro_estoque: pickParam(payload, [
        'p_centro_estoque',
        'centroEstoqueId',
        'centro_estoque',
        'centroCusto',
        'centro_custo',
      ]),
      p_data_entrada: pickParam(payload, ['p_data_entrada', 'dataEntrada', 'data_entrada']),
      p_status: pickParam(payload, ['p_status', 'status', 'statusId', 'status_id']),
      p_usuario_id: pickParam(payload, ['p_usuario_id'], user?.id ?? null),
    }

    const client = buildUserClient(authToken)
    const entrada = await executeSingle(
      client.rpc('rpc_entradas_create_full', params),
      'Falha ao registrar entrada.'
    )

    const material = await obterMaterialPorId(params.p_material_id)
    if (!material) {
      throw createHttpError(404, 'Material não encontrado.')
    }
    const usuario = resolveUsuarioNome(user)
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
  async create(payload, user, authToken) {
    const params = {
      p_pessoa_id: pickParam(payload, ['p_pessoa_id', 'pessoaId', 'pessoa_id']),
      p_material_id: pickParam(payload, ['p_material_id', 'materialId', 'material_id']),
      p_quantidade: pickParam(payload, ['p_quantidade', 'quantidade']),
      p_centro_estoque: pickParam(payload, [
        'p_centro_estoque',
        'centroEstoqueId',
        'centro_estoque',
        'centroCusto',
        'centro_custo',
      ]),
      p_centro_custo: pickParam(payload, ['p_centro_custo', 'centroCustoId', 'centro_custo_id']),
      p_centro_servico: pickParam(payload, ['p_centro_servico', 'centroServicoId', 'centro_servico_id']),
      p_data_entrega: pickParam(payload, ['p_data_entrega', 'dataEntrega', 'data_entrega']),
      p_status: pickParam(payload, ['p_status', 'status', 'statusId', 'status_id']),
      p_usuario_id: pickParam(payload, ['p_usuario_id'], user?.id ?? null),
      p_is_troca: pickParam(payload, ['p_is_troca', 'isTroca']),
      p_troca_de_saida: pickParam(payload, ['p_troca_de_saida', 'trocaDeSaida', 'troca_de_saida']),
      p_troca_sequencia: pickParam(payload, ['p_troca_sequencia', 'trocaSequencia', 'troca_sequencia']),
    }

    const client = buildUserClient(authToken)
    const saida = await executeSingle(
      client.rpc('rpc_saidas_create_full', params),
      'Falha ao registrar saída.'
    )

    return mapSaidaRecord(saida)
  },
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderReportHtml(context = {}) {
  return buildRelatorioEstoqueHtml({
    contexto: context,
    empresa: resolveEmpresaInfo(),
  })
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

function safeNumber(value) {
  const num = Number(value ?? 0)
  return Number.isNaN(num) ? 0 : num
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((acc, item) => acc + item, 0) / values.length
}

function stddevPop(values) {
  if (!values.length) return 0
  const avg = mean(values)
  const variance = values.reduce((acc, item) => acc + (item - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
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

function buildRankingConsumoPorCentro(centros = [], totalQuantidade, totalValor, limit = 10) {
  if (!Array.isArray(centros) || !centros.length) {
    return 'Sem dados'
  }
  const linhas = centros
    .map((item) => {
      const quantidade = safeNumber(item.quantidade)
      const valorTotal = safeNumber(item.valorTotal)
      return {
        nome: item.nome || 'Nao informado',
        quantidade,
        valorTotal,
        pctQtd: totalQuantidade > 0 ? (quantidade / totalQuantidade) * 100 : 0,
        pctValor: totalValor > 0 ? (valorTotal / totalValor) * 100 : 0,
      }
    })
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, limit)
    .map(
      (item) =>
        `${item.nome} | ${formatNumber(item.quantidade)} | ${formatPercent(item.pctQtd)} | ${formatCurrency(item.valorTotal)} | ${formatPercent(item.pctValor)}`
    )

  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildCentrosDesvioRecomendacao(centros = [], totalQuantidade, totalValor) {
  if (!Array.isArray(centros) || !centros.length) {
    return 'Sem dados'
  }

  const qtdValores = centros.map((item) => safeNumber(item.quantidade))
  const valorValores = centros.map((item) => safeNumber(item.valorTotal))
  const mediaQtd = mean(qtdValores)
  const mediaValor = mean(valorValores)
  const desvioQtd = stddevPop(qtdValores)
  const desvioValor = stddevPop(valorValores)

  const linhas = centros
    .map((item) => {
      const quantidade = safeNumber(item.quantidade)
      const valorTotal = safeNumber(item.valorTotal)
      const pctQtd = totalQuantidade > 0 ? (quantidade / totalQuantidade) * 100 : 0
      const pctValor = totalValor > 0 ? (valorTotal / totalValor) * 100 : 0

      const motivos = []
      if (pctQtd >= 30) {
        motivos.push('concentracao_qtd')
      }
      if (pctValor >= 30) {
        motivos.push('concentracao_valor')
      }
      if (desvioQtd > 0 && quantidade > mediaQtd + 2 * desvioQtd) {
        motivos.push('outlier_qtd')
      }
      if (desvioValor > 0 && valorTotal > mediaValor + 2 * desvioValor) {
        motivos.push('outlier_valor')
      }

      if (!motivos.length) {
        return null
      }

      const diagnosticos = []
      const recomendacoes = []

      if (motivos.includes('concentracao_qtd')) {
        diagnosticos.push('Consumo concentrado (giro alto).')
        recomendacoes.push(
          'Validar se o centro esta com mais equipes/producao; ajustar estoque minimo e janela de reposicao; conferir registro de consumo (evitar baixa indevida).'
        )
      }
      if (motivos.includes('concentracao_valor')) {
        diagnosticos.push('Consumo concentrado em itens caros.')
        recomendacoes.push(
          'Revisar itens do Pareto financeiro, negociar preco/contrato, checar padronizacao e aprovacoes; auditar requisicoes.'
        )
      }
      if (motivos.includes('outlier_qtd') || motivos.includes('outlier_valor')) {
        diagnosticos.push('Pico fora do padrao historico do periodo.')
        recomendacoes.push(
          'Investigar motivo do pico (obra especifica, urgencia, retrabalho/perda); se recorrente, recalibrar planejamento e estoque minimo.'
        )
      }

      return `${item.nome || 'Nao informado'} | ${diagnosticos.join(' ')} | ${recomendacoes.join(' ')}`
    })
    .filter(Boolean)

  return linhas.length ? linhas.join('\\n') : 'Sem dados'
}

function buildCoberturaPorCentro(saidas = [], estoqueAtual = [], pessoas = [], diasPeriodo) {
  if (!Array.isArray(saidas) || !Array.isArray(estoqueAtual)) {
    return []
  }

  const dias = Math.max(1, Number(diasPeriodo ?? 0))
  const mesesNoPeriodo = Math.max(dias / 30, 1)

  const pessoasIdsComMov = new Set((saidas ?? []).map((saida) => saida?.pessoaId).filter(Boolean))
  const pessoasConsideradas = (Array.isArray(pessoas) ? pessoas : []).filter(
    (pessoa) => pessoa?.id && (pessoa?.ativo !== false || pessoasIdsComMov.has(pessoa.id))
  )

  const pessoasPorCentro = new Map()
  pessoasConsideradas.forEach((pessoa) => {
    const centro = resolveCentroServicoDisplay({ pessoa })
    if (!centro) {
      return
    }
    const set = pessoasPorCentro.get(centro) ?? new Set()
    set.add(pessoa.id)
    pessoasPorCentro.set(centro, set)
  })

  const pessoasMovimentadas = new Map()
  saidas.forEach((saida) => {
    const pessoaId = saida.pessoaId
    if (!pessoaId) return
    const centro = resolveCentroServicoDisplay(saida)
    if (!centro) return
    const set = pessoasMovimentadas.get(centro) ?? new Set()
    set.add(pessoaId)
    pessoasMovimentadas.set(centro, set)
  })

  const consumoPorCentro = new Map()
  saidas.forEach((saida) => {
    const centro = resolveCentroServicoDisplay(saida)
    const quantidade = safeNumber(saida.quantidade)
    consumoPorCentro.set(centro, (consumoPorCentro.get(centro) ?? 0) + quantidade)
  })

  const estoquePorCentro = new Map()
  estoqueAtual.forEach((item) => {
    const centros = Array.isArray(item?.centrosCusto) ? item.centrosCusto : []
    const estoque = safeNumber(item?.estoqueAtual ?? item?.quantidade)
    if (!centros.length) {
      return
    }
    const share = estoque / Math.max(centros.length, 1)
    centros
      .map((centro) => (typeof centro === 'string' ? centro.trim() : ''))
      .filter(Boolean)
      .forEach((centro) => {
        estoquePorCentro.set(centro, (estoquePorCentro.get(centro) ?? 0) + share)
      })
  })

  const centros = new Set()
  consumoPorCentro.forEach((_value, key) => centros.add(key))
  estoquePorCentro.forEach((_value, key) => centros.add(key))
  pessoasPorCentro.forEach((_value, key) => centros.add(key))
  pessoasMovimentadas.forEach((_value, key) => centros.add(key))

  return Array.from(centros).map((centro) => {
    const consumoTotal = safeNumber(consumoPorCentro.get(centro) ?? 0)
    const consumoMedioMensal = consumoTotal / mesesNoPeriodo
    const estoqueAtualCentro = safeNumber(estoquePorCentro.get(centro) ?? 0)
    const pessoasAtivasCentro = pessoasPorCentro.get(centro) ?? new Set()
    const pessoasMovCentro = pessoasMovimentadas.get(centro) ?? new Set()
    const trabalhadoresAtivos = new Set([...pessoasAtivasCentro, ...pessoasMovCentro]).size

    if (trabalhadoresAtivos === 0 || consumoMedioMensal === 0) {
      return {
        centro,
        trabalhadores: trabalhadoresAtivos,
        cobertura: null,
        status: 'SEM BASE',
        recomendacao: 'Sem base',
      }
    }

    const cobertura = (estoqueAtualCentro * trabalhadoresAtivos) / consumoMedioMensal
    let status = 'OK'
    let recomendacao = 'Manter rotina'
    if (cobertura < 0.5) {
      status = 'CRITICO'
      recomendacao = 'Repor imediato / risco de ruptura'
    } else if (cobertura < 1) {
      status = 'ATENCAO'
      recomendacao = 'Programar reposicao / monitorar semanal'
    }

    return {
      centro,
      trabalhadores: trabalhadoresAtivos,
      cobertura,
      status,
      recomendacao,
    }
  })
}

function buildRankingCoberturaPorCentro(cobertura = [], limit = 10) {
  if (!Array.isArray(cobertura) || !cobertura.length) {
    return 'Sem dados'
  }
  const linhas = cobertura
    .slice()
    .sort((a, b) => {
      if (a.cobertura === null && b.cobertura !== null) return 1
      if (a.cobertura !== null && b.cobertura === null) return -1
      if (a.cobertura === null && b.cobertura === null) return 0
      return (a.cobertura ?? 0) - (b.cobertura ?? 0)
    })
    .slice(0, limit)
    .map((item) => {
      const coberturaText = item.cobertura === null ? 'Sem base' : formatNumber(item.cobertura, 2)
      return `${item.centro || 'Nao informado'} | ${formatNumber(item.trabalhadores)} | ${coberturaText} | ${item.status} | ${item.recomendacao}`
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

  const pessoasIdsComMov = new Set(
    (saidasDetalhadas ?? []).map((saida) => saida?.pessoaId).filter(Boolean)
  )
  const pessoasConsideradas = (pessoas ?? []).filter(
    (pessoa) => pessoa?.id && (pessoa?.ativo !== false || pessoasIdsComMov.has(pessoa.id))
  )
  const consumoPorTrabalhador =
    pessoasConsideradas.length > 0 ? totalSaidasQuantidade / pessoasConsideradas.length : null
  const coberturaResumo = buildCoberturaResumo(consumoPorTrabalhador)
  const coberturaPorCentro = buildCoberturaPorCentro(
    saidasDetalhadas,
    estoqueBase?.itens ?? [],
    pessoasConsideradas,
    diasPeriodo
  )

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
    coberturaPorCentro,
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
  const rankingConsumoCentro = buildRankingConsumoPorCentro(
    resumo.centros,
    resumo.totalSaidasQuantidade,
    resumo.totalSaidasValor
  )
  const listaDesvioCentro = buildCentrosDesvioRecomendacao(
    resumo.centros,
    resumo.totalSaidasQuantidade,
    resumo.totalSaidasValor
  )
  const rankingCoberturaCentro = buildRankingCoberturaPorCentro(resumo.coberturaPorCentro)

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
    ranking_consumo_por_centro: rankingConsumoCentro,
    lista_centros_desvio_recomendacao: listaDesvioCentro,
    qtd_vencidos: formatNumber(resumo.qtdVencidos),
    qtd_vencendo: formatNumber(resumo.qtdVencendo),
    qtd_excesso: formatNumber(resumo.qtdExcesso),
    status_cobertura: resumo.coberturaResumo.status,
    interpretacao_cobertura: resumo.coberturaResumo.interpretacao,
    ranking_cobertura_por_centro: rankingCoberturaCentro,
    qtd_abaixo_minimo: formatNumber(resumo.qtdAbaixoMinimo),
    qtd_riscos_imediatos: formatNumber(resumo.qtdRiscosImediatos),
    status_final: nivelRisco,
  }
}

async function resolveReportTypeFromPeriodo(periodoInicio, periodoFim) {
  const diffMeses = diffMesesInclusivo(periodoInicio, periodoFim)
  if (diffMeses === 1) return REPORT_TYPE_MENSAL
  throw createHttpError(400, 'Periodo precisa ser mensal.')
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
  origem,
  periodoRange,
  dadosAtual,
}) {
  const resumoAtual = buildReportSummaryPayload({
    dashboard: dadosAtual.dashboard,
    pessoas: dadosAtual.pessoas,
    periodoRange,
    termo,
    estoqueBase: dadosAtual.estoqueBase,
  })

  const context = buildMonthlyContext({ resumo: resumoAtual, periodoRange })

  const metadados = {
    tipo: REPORT_TYPE_MENSAL,
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
        email_status: 'pendente',
        email_enviado_em: null,
        email_erro: null,
        email_tentativas: 0,
      })
      .select('id, created_at'),
    'Falha ao registrar relatorio de estoque.'
  )

  return {
    registro,
    tipo: REPORT_TYPE_MENSAL,
    metadados,
    resumoAtual,
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
      periodo,
      { includeInactivePessoas: true }
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

    const report = await buildInventoryReport({
      ownerId,
      createdById: user.id,
      periodoInicio: toDateOnly(periodoRange.start),
      periodoFim: toDateOnly(periodoRange.end),
      termo,
      origem: 'manual',
      periodoRange,
      dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
    })

    return {
      reportId: report.registro?.id ?? null,
      createdAt: report.registro?.created_at ?? null,
      tipo,
    }
  },
  async reportHistory(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para consultar relatorios.')
    }
    const ownerId = await resolveOwnerId(user.id)
    const tipoRaw = trim(params.tipo)
    const tipo = tipoRaw && tipoRaw !== 'todos' ? tipoRaw.toLowerCase() : REPORT_TYPE_MENSAL
    const mesRange = resolveMonthRangeFromString(params.mes)

    let query = supabaseAdmin
      .from('inventory_report')
      .select(
        'id, created_at, created_by, periodo_inicio, periodo_fim, termo, metadados, pdf_gerado_em, pdf_gerado_por, email_status'
      )
      .eq('account_owner_id', ownerId)

    if (tipo && tipo !== REPORT_TYPE_MENSAL) {
      throw createHttpError(400, 'Tipo invalido. Use mensal.')
    }
    query = query.eq('metadados->>tipo', REPORT_TYPE_MENSAL)
    if (mesRange) {
      query = query
        .eq('periodo_inicio', toDateOnly(mesRange.start))
        .eq('periodo_fim', toDateOnly(mesRange.end))
        .eq('metadados->>tipo', REPORT_TYPE_MENSAL)
    }

    const items = await execute(
      query.order('periodo_inicio', { ascending: false }).order('created_at', { ascending: false }),
      'Falha ao listar relatorios de estoque.'
    )

    const createdByIds = Array.from(
      new Set((items ?? []).map((item) => item?.created_by).filter(Boolean))
    )
    const createdByMap = new Map()
    if (createdByIds.length) {
      const users = await execute(
        supabaseAdmin
          .from('app_users')
          .select('id, display_name, username, email')
          .in('id', createdByIds),
        'Falha ao consultar usuarios do relatorio.'
      )
      ;(users ?? []).forEach((user) => {
        if (user?.id) {
          createdByMap.set(user.id, user)
        }
      })
    }

    const mapped = (items ?? []).map((item) => ({
      ...item,
      created_by: item?.created_by ? createdByMap.get(item.created_by) || item.created_by : null,
    }))

    return { items: mapped }
  },
  async reportHtml(params = {}, user) {
    if (!user?.id) {
      throw createHttpError(401, 'Usuario nao autenticado para visualizar relatorio.')
    }
    const ownerId = await resolveOwnerId(user.id)
    const mesRange = resolveMonthRangeFromString(params.mes)
    if (!mesRange) {
      throw createHttpError(400, 'Mes obrigatorio (formato YYYY-MM).')
    }

    const registro = await executeMaybeSingle(
      supabaseAdmin
        .from('inventory_report')
        .select('id, periodo_inicio, periodo_fim, metadados')
        .eq('account_owner_id', ownerId)
        .eq('metadados->>tipo', REPORT_TYPE_MENSAL)
        .eq('periodo_inicio', toDateOnly(mesRange.start))
        .eq('periodo_fim', toDateOnly(mesRange.end))
        .order('created_at', { ascending: false })
        .limit(1),
      'Falha ao consultar relatorio de estoque.'
    )

    if (!registro) {
      throw createHttpError(404, 'Relatorio nao encontrado para o mes informado.')
    }

    const contexto = registro?.metadados?.contexto
    if (!contexto) {
      throw createHttpError(400, 'Contexto do relatorio nao encontrado para gerar HTML.')
    }

    return {
      report: {
        id: registro.id,
        periodo_inicio: registro.periodo_inicio,
        periodo_fim: registro.periodo_fim,
        tipo: REPORT_TYPE_MENSAL,
      },
      contexto,
    }
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

    const html = renderReportHtml(contexto)
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
    const periodoInicioInput = params?.periodo_inicio ?? params?.periodoInicio
    const periodoFimInput = params?.periodo_fim ?? params?.periodoFim

    const loadPeriodos = () =>
      execute(
        supabaseAdmin
          .from('inventory_forecast')
          .select(
            'id, periodo_base_inicio, periodo_base_fim, previsao_anual, metodo_previsao, nivel_confianca, created_at'
          )
          .eq('account_owner_id', ownerId)
          .order('created_at', { ascending: false }),
        'Falha ao listar periodos de previsao.'
      )

    const loadPeriodosSafe = async () => {
      try {
        const periodos = await loadPeriodos()
        return Array.isArray(periodos) ? periodos : []
      } catch {
        return []
      }
    }

    const buildForecastFromTables = async (periodoInicio, periodoFim, forecastId) => {
      const resumo = await executeMaybeSingle(
        supabaseAdmin
          .from('inventory_forecast')
          .select(
            'id, periodo_base_inicio, periodo_base_fim, qtd_meses_base, gasto_total_periodo, media_mensal, fator_tendencia, tipo_tendencia, variacao_percentual, previsao_anual, gasto_ano_anterior, metodo_previsao, nivel_confianca, created_at'
          )
          .eq('account_owner_id', ownerId)
          .eq('periodo_base_inicio', periodoInicio)
          .eq('periodo_base_fim', periodoFim)
          .order('created_at', { ascending: false })
          .limit(1),
        'Falha ao carregar resumo de previsao.'
      )

      let historicoQuery = supabaseAdmin
        .from('agg_gasto_mensal')
        .select('ano_mes, valor_saida, valor_entrada')
        .eq('account_owner_id', ownerId)
        .order('ano_mes', { ascending: true })

      if (periodoInicio && periodoFim) {
        historicoQuery = historicoQuery.gte('ano_mes', periodoInicio).lte('ano_mes', periodoFim)
      }

      const historicoRows = await execute(historicoQuery, 'Falha ao carregar historico de previsao.')

      let previsaoQuery = supabaseAdmin
        .from('f_previsao_gasto_mensal')
        .select('ano_mes, valor_previsto, metodo, cenario')
        .eq('account_owner_id', ownerId)
        .eq('cenario', 'base')
        .order('ano_mes', { ascending: true })

      if (forecastId) {
        previsaoQuery = previsaoQuery.eq('inventory_forecast_id', forecastId)
      }

      if (periodoFim) {
        const inicioPrev = new Date(periodoFim)
        inicioPrev.setUTCMonth(inicioPrev.getUTCMonth() + 1, 1)
        const fimPrev = new Date(inicioPrev)
        fimPrev.setUTCMonth(fimPrev.getUTCMonth() + 11, 1)
        previsaoQuery = previsaoQuery
          .gte('ano_mes', inicioPrev.toISOString().split('T')[0])
          .lte('ano_mes', fimPrev.toISOString().split('T')[0])
      }

      const previsaoRows = await execute(previsaoQuery, 'Falha ao carregar serie de previsao.')

      const historicoValores = historicoRows.map((row) => Number(row.valor_saida || 0))
      const historico = historicoRows.map((row, index) => ({
        ano_mes: row.ano_mes,
        label: formatAnoMesLabel(row.ano_mes),
        valor_saida: Number(row.valor_saida || 0),
        valor_entrada: Number(row.valor_entrada || 0),
        media_movel: buildMediaMovel(historicoValores, index),
      }))

      const previsao = previsaoRows.map((row) => ({
        ano_mes: row.ano_mes,
        label: formatAnoMesLabel(row.ano_mes),
        valor_previsto: Number(row.valor_previsto || 0),
        metodo: row.metodo || 'media_simples',
        cenario: row.cenario || 'base',
      }))

      return {
        status: historico.length && previsao.length ? 'ok' : 'missing',
        resumo: resumo || null,
        historico,
        previsao,
      }
    }
    const periodos = await loadPeriodosSafe()

    try {
      if (periodoInicioInput && periodoFimInput) {
        const forecastIdInput = params?.forecast_id ?? params?.forecastId
        const forecast = await buildForecastFromTables(periodoInicioInput, periodoFimInput, forecastIdInput)
        return { ...forecast, periodos }
      }

      const latest = periodos?.[0]
      if (!latest) {
        return { status: 'missing', resumo: null, historico: [], previsao: [], periodos }
      }

      const forecast = await buildForecastFromTables(
        latest.periodo_base_inicio,
        latest.periodo_base_fim,
        latest.id
      )
      return { ...forecast, periodos }
    } catch {
      return { status: 'missing', resumo: null, historico: [], previsao: [], periodos }
    }
  },
  async reportAuto() {
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

    for (const owner of owners ?? []) {
      if (owner?.ativo === false) {
        continue
      }
      const ownerId = owner.id
      if (!ownerId) continue

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
          }),
          { includeInactivePessoas: true }
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
          origem: 'auto',
          periodoRange,
          dadosAtual: { dashboard: dashboardAtual, pessoas: dadosAtual.pessoas, estoqueBase: estoqueBaseAtual },
        })

        mensalRegistrados.add(chave)
        resultados.push({
          ownerId,
          tipo: REPORT_TYPE_MENSAL,
          periodo_inicio: toDateOnly(periodoRange.start),
          periodo_fim: toDateOnly(periodoRange.end),
          reportId: report.registro?.id ?? null,
          email_status: 'pendente',
        })
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
      const getLocalTermoContext = await loadLocalTermoContext()
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
  async create(payload, user, authToken) {
    const params = {
      p_pessoa_id: pickParam(payload, ['p_pessoa_id', 'pessoaId', 'pessoa_id']),
      p_data: pickParam(payload, ['p_data', 'data']),
      p_dias_perdidos: pickParam(payload, ['p_dias_perdidos', 'diasPerdidos', 'dias_perdidos']),
      p_dias_debitados: pickParam(payload, ['p_dias_debitados', 'diasDebitados', 'dias_debitados']),
      p_cid: pickParam(payload, ['p_cid', 'cid']),
      p_centro_servico_id: pickParam(payload, ['p_centro_servico_id', 'centroServicoId', 'centro_servico_id']),
      p_local_id: pickParam(payload, ['p_local_id', 'localId', 'local_id']),
      p_cat: pickParam(payload, ['p_cat', 'cat']),
      p_observacao: pickParam(payload, ['p_observacao', 'observacao']),
      p_data_esocial: pickParam(payload, ['p_data_esocial', 'dataEsocial', 'data_esocial']),
      p_esocial: pickParam(payload, ['p_esocial', 'esocial']),
      p_sesmt: pickParam(payload, ['p_sesmt', 'sesmt']),
      p_data_sesmt: pickParam(payload, ['p_data_sesmt', 'dataSesmt', 'data_sesmt']),
      p_agentes_ids: pickParam(payload, ['p_agentes_ids', 'agentesIds', 'agentes_ids']),
      p_tipos_ids: pickParam(payload, ['p_tipos_ids', 'tiposIds', 'tipos_ids']),
      p_lesoes_ids: pickParam(payload, ['p_lesoes_ids', 'lesoesIds', 'lesoes_ids']),
      p_partes_ids: pickParam(payload, ['p_partes_ids', 'partesIds', 'partes_ids']),
      p_registrado_por: pickParam(payload, ['p_registrado_por', 'registradoPor'], resolveUsuarioNome(user)),
    }

    if (!params.p_pessoa_id) {
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
      params.p_pessoa_id = pessoaId
      params.p_data = dados.data
      params.p_dias_perdidos = dados.diasPerdidos
      params.p_dias_debitados = dados.diasDebitados
      params.p_cid = dados.cid
      params.p_centro_servico_id = dados.centroServicoId
      params.p_local_id = dados.localId
      params.p_cat = dados.cat
      params.p_observacao = dados.observacao
      params.p_data_esocial = dados.dataEsocial
      params.p_esocial = dados.esocial
      params.p_sesmt = dados.sesmt
      params.p_data_sesmt = dados.dataSesmt
      if (!params.p_agentes_ids) {
        params.p_agentes_ids = dados.agenteId ? [dados.agenteId] : null
      }
      params.p_tipos_ids = dados.tiposIds
      params.p_lesoes_ids = dados.lesoesIds
      params.p_partes_ids = dados.partesIds
      if (!params.p_registrado_por) {
        params.p_registrado_por = resolveUsuarioNome(user)
      }
    }

    const client = buildUserClient(authToken)
    const acidente = await executeSingle(
      client.rpc('rpc_acidentes_create_full', params),
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









