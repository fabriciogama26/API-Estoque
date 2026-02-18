import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { logError } from './errorLogService.js'
import { getSessionId, notifySessionGuardFromResponse } from './sessionService.js'
import { request as httpRequest } from './httpClient.js'
import {
  montarEstoqueAtual,
  montarDashboard,
  parsePeriodo,
  resolvePeriodoSaldo,
  resolvePeriodoRange,
  calcularSaldoMaterial,
} from '../lib/estoque.js'
import { montarDashboardAcidentes } from '../lib/acidentesDashboard.js'
import { resolveEffectiveAppUser } from './effectiveUserService.js'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const IMPORTS_MAX_MB = Number(import.meta.env.VITE_IMPORTS_MAX_MB) || 50

const GENERIC_ERROR = 'Falha ao comunicar com o Supabase.'

const resolveRequestIdFromError = (error, context = {}) => {
  return (
    error?.requestId ||
    error?.request_id ||
    error?.details?.requestId ||
    error?.details?.request_id ||
    error?.context?.requestId ||
    error?.context?.request_id ||
    context?.requestId ||
    context?.request_id ||
    null
  )
}

const reportClientError = (message, error, context = {}, severity = 'warn') => {
  const requestId = resolveRequestIdFromError(error, context)
  console.warn(message, error)
  if (requestId) {
    return
  }
  logError({
    message,
    stack: error?.stack,
    page: 'api_service',
    severity,
    context: {
      ...context,
      errorMessage: error?.message,
    },
  }).catch(() => {})
}

const parseApiErrorResponse = async (response, fallbackMessage) => {
  let message = fallbackMessage
  let payload = null
  try {
    payload = await response.json()
    if (payload?.error) {
      if (typeof payload.error === 'object') {
        message = payload.error.message || message
      } else if (typeof payload.error === 'string') {
        message = payload.error
      }
    } else if (payload?.message) {
      message = payload.message
    }
  } catch {
    // ignore
  }
  notifySessionGuardFromResponse(response.status, payload)
  return message
}

const trim = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const toBooleanValue = (value, fallback = true) => {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const texto = value.trim().toLowerCase()
    if (!texto) {
      return fallback
    }
    if (['true', '1', 'sim', 'yes', 'on', 'ativo'].includes(texto)) {
      return true
    }
    if (['false', '0', 'nao', 'off', 'inativo'].includes(texto)) {
      return false
    }
  }
  return Boolean(value)
}

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => trim(item)).filter(Boolean)
}

const splitMultiValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => trim(item)).filter(Boolean)
  }
  const texto = trim(value)
  if (!texto) {
    return []
  }
  return texto
    .split(/[;,]/)
    .map((parte) => parte.trim())
    .filter(Boolean)
}

const normalizeDisplayText = (valor) => {
  if (valor === undefined || valor === null) {
    return ''
  }
  const textoBase = typeof valor === 'string' ? valor : String(valor)
  const texto = textoBase.trim()
  if (!texto) {
    return ''
  }
  return typeof texto.normalize === 'function' ? texto.normalize('NFC') : texto
}

const formatMbValue = (bytes) => {
  const mb = bytes / (1024 * 1024)
  return Number.isFinite(mb) ? mb.toFixed(2) : '0.00'
}

const assertFileSizeWithinLimit = (file, limitMb = IMPORTS_MAX_MB) => {
  if (!file || !Number.isFinite(limitMb) || limitMb <= 0) {
    return
  }
  const sizeBytes = Number(file.size || 0)
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return
  }
  const limitBytes = limitMb * 1024 * 1024
  if (sizeBytes > limitBytes) {
    const sizeLabel = formatMbValue(sizeBytes)
    throw new Error(`Arquivo excede o limite de ${limitMb} MB (tamanho: ${sizeLabel} MB).`)
  }
}

const resolveTextValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return normalizeDisplayText(value)
  }
  if (typeof value === 'object') {
    if (typeof value.nome === 'string') {
      return normalizeDisplayText(value.nome)
    }
    if (typeof value.label === 'string') {
      return normalizeDisplayText(value.label)
    }
    if (typeof value.descricao === 'string') {
      return normalizeDisplayText(value.descricao)
    }
  }
  return normalizeDisplayText(value)
}

const ACIDENTE_HISTORY_FIELDS = [
  'matricula',
  'nome',
  'cargo',
  'data',
  'dataEsocial',
  'sesmt',
  'dataSesmt',
  'tipo',
  'agente',
  'lesoes',
  'partesLesionadas',
  'centroServico',
  'local',
  'diasPerdidos',
  'diasDebitados',
  'hht',
  'cid',
  'cat',
  'observacao',
  'ativo',
  'cancelMotivo',
]

const MATERIAL_COR_RELATION_TABLE = 'material_grupo_cor'
const MATERIAL_CARACTERISTICA_RELATION_TABLE = 'material_grupo_caracteristica_epi'

const PESSOAS_VIEW_SELECT = `
  id,
  nome,
  matricula,
  "dataAdmissao",
  "dataDemissao",
  observacao,
  "usuarioCadastro",
  "usuarioCadastroNome",
  "usuarioEdicao",
  "usuarioEdicaoNome",
  "criadoEm",
  "atualizadoEm",
  centro_servico_id,
  setor_id,
  cargo_id,
  centro_custo_id,
  tipo_execucao_id,
  ativo,
  centro_servico,
  setor,
  cargo,
  centro_custo,
  tipo_execucao
`

const buildPessoasViewQuery = () => supabase.rpc('rpc_pessoas_completa')

const MATERIAL_COR_RELATION_ID_COLUMNS = ['grupo_material_cor']
const MATERIAL_COR_RELATION_TEXT_COLUMNS = []

const MATERIAL_CARACTERISTICA_RELATION_ID_COLUMNS = ['grupo_caracteristica_epi']
const MATERIAL_CARACTERISTICA_RELATION_TEXT_COLUMNS = []

const CENTRO_ESTOQUE_TABLE = 'centros_estoque'
const CENTROS_CUSTO_TABLE = 'centros_custo'
const ENTRADAS_MATERIAIS_VIEW = 'entradas_material_view'
const STATUS_ENTREGUE_ID = '0f7a592f-d57d-479e-b004-883cb6794ef6'
const STATUS_CANCELADO_NOME = 'CANCELADO'

const MATERIAL_HISTORY_FIELDS = [
  'materialItemNome',
  'fabricanteNome',
  'validadeDias',
  'ca',
  'valorUnitario',
  'estoqueMinimo',
  'ativo',
  'descricao',
  'grupoMaterial',
  'grupoMaterialNome',
  'numeroCalcado',
  'numeroVestimenta',
  'numeroEspecifico',
  'caracteristicaEpi',
  'caracteristicasTexto',
  'corMaterial',
  'coresTexto',
]

const MATERIAL_TABLE_SELECT_COLUMNS = `
  id,
  nome,
  "materialItemNome",
  fabricante,
  "fabricanteNome",
  "validadeDias",
  ca,
  "valorUnitario",
  "estoqueMinimo",
  ativo,
  descricao,
  "grupoMaterial",
  "grupoMaterialNome",
  "numeroCalcado",
  "numeroVestimenta",
  "numeroEspecifico",
  "usuarioCadastro",
  "usuarioAtualizacao",
  "dataCadastro",
  "atualizadoEm"
`

const MATERIAL_SELECT_COLUMNS = `
  ${MATERIAL_TABLE_SELECT_COLUMNS},
  "caracteristicaNome",
  "caracteristicasIds",
  "corNome",
  "coresIds",
  "numeroCalcadoNome",
  "numeroVestimentaNome",
  "usuarioCadastroNome",
  "usuarioCadastroUsername",
  "usuarioAtualizacaoNome",
  "usuarioAtualizacaoUsername",
  "fabricanteNome"
`

const normalizeHistoryValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map((item) => ((item ?? '').toString().trim())).filter(Boolean).join(', ')
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return ''
  }
  return value.toString().trim()
}

const normalizePessoaHistorico = (lista) => {
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

const normalizeMaterialCamposAlterados = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }
  return lista
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const campo = trim(item.campo ?? item.nome ?? '')
      if (!campo) {
        return null
      }

      return {
        campo,
        de: item.de ?? item.valorAnterior ?? item.de_valor ?? '',
        para: item.para ?? item.valorAtual ?? item.para_valor ?? '',
      }
    })
    .filter(Boolean)
}

const resolveCatalogoNome = (record) => {
  if (!record || typeof record !== 'object') {
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
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return ''
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const normalizeUuid = (value) => {
  const texto = trim(value)
  if (!texto) {
    return null
  }
  return UUID_REGEX.test(texto) ? texto : null
}

const toUuidOrNull = (value) => normalizeUuid(value) ?? null
const toUuidArrayOrEmpty = (arr) =>
  Array.isArray(arr) ? arr.map((item) => toUuidOrNull(item)).filter(Boolean) : []
const toUuidArrayOrNulls = (arr) =>
  Array.isArray(arr) ? arr.map((item) => normalizeUuid(item) ?? null) : []

const normalizeClassificacoesPayload = (payload = {}) => {
  const lista = Array.isArray(payload.classificacoesAgentes) ? payload.classificacoesAgentes : []
  if (!lista.length) {
    return null
  }
  const agentesIds = []
  const tiposIds = []
  const lesoesIds = []
  lista.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }
    agentesIds.push(normalizeUuid(item.agenteId ?? item.agente_id) ?? null)
    tiposIds.push(normalizeUuid(item.tipoId ?? item.tipo_id) ?? null)
    lesoesIds.push(normalizeUuid(item.lesaoId ?? item.lesao_id) ?? null)
  })
  return {
    agentesIds,
    tiposIds,
    lesoesIds,
  }
}

const padArrayToLength = (arr, length) => {
  const lista = Array.isArray(arr) ? arr.slice(0, length) : []
  while (lista.length < length) {
    lista.push(null)
  }
  return lista
}

const resolvePreflightOwnerId = (effective) => {
  if (!effective) {
    return null
  }
  const cred = (effective.credential || effective.credentialId || '').toString().toLowerCase()
  if (cred === 'admin' || cred === 'master') {
    return null
  }
  return toUuidOrNull(effective.appUserId) || null
}

const normalizeOptionId = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }

  if (typeof value === 'string') {
    const texto = trim(value)
    if (!texto) {
      return null
    }
    return normalizeUuid(texto) ?? texto
  }

  return null
}

const unwrapOptionRecord = (value) => {
  if (!value || typeof value !== 'object') {
    return value
  }

  const nestedKeys = [
    'caracteristica',
    'caracteristicaEpi',
    'caracteristica_epi',
    'grupoCaracteristica',
    'grupo_caracteristica',
    'grupo',
    'opcao',
    'cor',
    'cor_rel',
    'cores',
    'valor',
    'item',
  ]

  for (const key of nestedKeys) {
    if (value[key]) {
      return unwrapOptionRecord(value[key])
    }
  }

  return value
}

const normalizeOptionItem = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const id = normalizeOptionId(value)
    if (!id) {
      return null
    }
    const nome = resolveTextValue(value)
    return { id, nome }
  }

  const record = unwrapOptionRecord(value)
  if (!record || typeof record !== 'object') {
    return null
  }

  const idFields = [
    record.id,
    record.uuid,
    record.valor,
    record.value,
    record.codigo,
    record.code,
  ]

  let id = null
  for (const fieldValue of idFields) {
    id = normalizeOptionId(fieldValue)
    if (id) {
      break
    }
  }

  const nome = resolveCatalogoNome(record)
  if (!id) {
    if (!nome) {
      return null
    }
    return { id: null, nome }
  }

  return { id, nome: nome || id }
}

const normalizeRelationIds = (lista) => {
  const valores = []
  const vistos = new Set()

  const itens = Array.isArray(lista) ? lista : [lista]
  itens
    .map((item) => {
      if (item && typeof item === 'object') {
        const candidato =
          item.id ?? item.uuid ?? item.valor ?? item.value ?? item.codigo ?? item.code
        return normalizeOptionId(candidato)
      }
      return normalizeOptionId(item)
    })
    .filter((id) => Boolean(id) && isUuidValue(id))
    .forEach((id) => {
      if (!vistos.has(id)) {
        vistos.add(id)
        valores.push(id)
      }
    })

  return valores
}

const normalizeRelationId = (value) => {
  const id = normalizeOptionId(value)
  return id || null
}

const normalizeOptionList = (lista) => {
  const valores = []
  const vistos = new Set()
  ;(Array.isArray(lista) ? lista : [lista])
    .map(normalizeOptionItem)
    .filter(Boolean)
    .forEach((item) => {
      const key = item.id ?? item.nome.toLowerCase()
      if (!vistos.has(key)) {
        vistos.add(key)
        valores.push(item)
      }
    })
  return valores
}

const ensureArrayValue = (value) => {
  if (Array.isArray(value)) {
    return value
  }
  if (value === undefined || value === null) {
    return []
  }
  return [value]
}

const buildRelationSelectionList = (ids, nomes) => {
  const idList = ensureArrayValue(ids)
  const nameList = ensureArrayValue(nomes)
  const limite = Math.max(idList.length, nameList.length)
  const itens = []
  for (let index = 0; index < limite; index += 1) {
    const rawId = idList[index]
    const rawNome = nameList[index]
    const nome = trim(rawNome ?? rawId ?? '')
    const id = trim(rawId ?? nome)
    if (!nome && !id) {
      continue
    }
    itens.push({ id: id || nome, nome })
  }
  return normalizeOptionList(itens)
}

const normalizeCatalogoNameKey = (valor) => {
  const texto = trim(valor)
  if (!texto) {
    return ''
  }
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const normalizeNameList = (nomes) =>
  (Array.isArray(nomes) ? nomes : [])
    .map((nome) => trim(nome))
    .filter(Boolean)

const BASIC_REGISTRATION_TABLE_CONFIG = {
  fabricantes: {
    nameColumn: 'fabricante',
    select:
      'id,fabricante,ativo,created_at,updated_at,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['fabricante'],
  },
  cargos: {
    nameColumn: 'nome',
    select:
      'id,nome,ativo,criado_em,updated_at,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['nome'],
  },
  centros_custo: {
    nameColumn: 'nome',
    select:
      'id,nome,ativo,criado_em,updated_at,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['nome'],
  },
  centros_servico: {
    nameColumn: 'nome',
    select:
      'id,nome,ativo,criado_em,updated_at,centro_custo_id,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['nome'],
  },
  centros_estoque: {
    nameColumn: 'almox',
    select:
      'id,almox,centro_custo,ativo,created_at,updated_at,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['almox'],
  },
  setores: {
    nameColumn: 'nome',
    select:
      'id,nome,ativo,criado_em,updated_at,centro_servico_id,created_by_user_id,created_by_user_name,updated_by_user_id,updated_by_user_name,account_owner_id,created_by_user:created_by_user_id(id,display_name,username,email)',
    order: ['nome'],
  },
}

const resolveBasicRegistrationConfig = (table) => {
  const key = String(table || '').trim().toLowerCase()
  const config = BASIC_REGISTRATION_TABLE_CONFIG[key]
  if (!config) {
    throw new Error('Tabela de cadastro base invalida.')
  }
  return { key, config }
}

const resolveUserLabel = (user) => {
  if (!user || typeof user !== 'object') {
    return ''
  }
  const username = resolveTextValue(user.username ?? '')
  if (username) {
    return username
  }
  const display = resolveTextValue(user.display_name ?? '')
  if (display) {
    return display
  }
  const email = resolveTextValue(user.email ?? '')
  if (email) {
    return email
  }
  return ''
}

const mapBasicRegistrationRecord = (table, record) => {
  if (!record || typeof record !== 'object') {
    return record
  }
  const { config } = resolveBasicRegistrationConfig(table)
  const nome = resolveTextValue(record?.[config.nameColumn] ?? '')
  const createdByUser = record?.created_by_user || record?.created_by_user_id
  const createdByUserName =
    resolveUserLabel(createdByUser) || resolveTextValue(record?.created_by_user_name ?? '')
  const createdAt = record?.created_at ?? record?.criado_em ?? null
  const updatedAt = record?.updated_at ?? null
  return {
    id: record?.id ?? null,
    nome,
    ativo: record?.ativo !== false,
    createdAt,
    updatedAt,
    createdByUserId: record?.created_by_user_id ?? null,
    createdByUserName,
    updatedByUserId: record?.updated_by_user_id ?? null,
    centroCustoId: record?.centro_custo_id ?? record?.centro_custo ?? null,
    centroServicoId: record?.centro_servico_id ?? null,
  }
}

async function resolveCatalogScope() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user?.id) {
    return { ownerId: null, isMaster: false }
  }
  try {
    const effective = await resolveEffectiveAppUser(user.id)
    const cred = (effective?.credential || '').toString().toLowerCase()
    return {
      ownerId: effective?.appUserId || user.id,
      isMaster: cred === 'master',
    }
  } catch (error) {
    reportClientError('Falha ao resolver owner para catalogo.', error, { userId: user.id })
    return { ownerId: null, isMaster: false }
  }
}

const CATALOG_CACHE_TTL_MS = 30 * 1000
const catalogCache = new Map()

const buildCatalogCacheKey = ({ table, nameColumn, ownerScoped, ownerId, isMaster }) => {
  const scopeLabel = ownerScoped ? (isMaster ? 'master' : ownerId || 'unknown') : 'global'
  return `${table}|${nameColumn}|${ownerScoped ? 'scoped' : 'global'}|${scopeLabel}`
}

let pessoasOwnerScopeCache = null

const clearCatalogCache = (tables = null) => {
  if (!tables) {
    catalogCache.clear()
    pessoasOwnerScopeCache = null
    return
  }
  const lista = Array.isArray(tables) ? tables : [tables]
  const targets = new Set(lista.map((item) => String(item ?? '').trim()).filter(Boolean))
  if (!targets.size) {
    catalogCache.clear()
    pessoasOwnerScopeCache = null
    return
  }
  if (targets.has('centros_servico')) {
    pessoasOwnerScopeCache = null
  }
  Array.from(catalogCache.keys()).forEach((key) => {
    const table = key.split('|')[0]
    if (targets.has(table)) {
      catalogCache.delete(key)
    }
  })
}

const readCatalogCache = (key) => {
  const cached = catalogCache.get(key)
  if (!cached) {
    return null
  }
  if (Date.now() - cached.at > CATALOG_CACHE_TTL_MS) {
    catalogCache.delete(key)
    return null
  }
  return cached.data
}

const writeCatalogCache = (key, data) => {
  catalogCache.set(key, { at: Date.now(), data })
}

async function resolvePessoasOwnerScope() {
  const scope = await resolveCatalogScope()
  if (scope.isMaster) {
    pessoasOwnerScopeCache = {
      ownerId: scope.ownerId ?? null,
      isMaster: true,
      centroServicoIds: null,
      strict: true,
    }
    return pessoasOwnerScopeCache
  }
  if (!scope.ownerId) {
    pessoasOwnerScopeCache = null
    return { ownerId: null, isMaster: false, centroServicoIds: [], strict: false }
  }
  if (pessoasOwnerScopeCache?.ownerId === scope.ownerId && !pessoasOwnerScopeCache.isMaster) {
    return pessoasOwnerScopeCache
  }
  try {
    const centros = await loadCatalogList({
      table: 'centros_servico',
      nameColumn: 'nome',
      errorMessage: 'Falha ao aplicar escopo de centros de servico.',
    })
    const ids = (centros ?? []).map((item) => item?.id).filter(Boolean)
    const strict = ids.length > 0
    if (!strict) {
      reportClientError('Centros de servico vazios no escopo de pessoas; aplicando fallback por RLS.', new Error('centros_servico_empty'), {
        ownerId: scope.ownerId,
      })
    }
    pessoasOwnerScopeCache = {
      ownerId: scope.ownerId,
      isMaster: false,
      centroServicoIds: ids,
      strict,
    }
    return pessoasOwnerScopeCache
  } catch (error) {
    reportClientError('Falha ao resolver escopo de pessoas.', error, { ownerId: scope.ownerId })
    return { ownerId: scope.ownerId, isMaster: false, centroServicoIds: [], strict: false }
  }
}

async function loadCatalogList({ table, nameColumn = 'nome', ownerScoped = true, errorMessage }) {
  if (!ownerScoped) {
    const cacheKey = buildCatalogCacheKey({ table, nameColumn, ownerScoped, ownerId: null, isMaster: false })
    const cached = readCatalogCache(cacheKey)
    if (cached) {
      return cached
    }
    const data = await execute(
      supabase.rpc('rpc_catalog_list', { p_table: table }),
      errorMessage
    )
    const normalized = normalizeDomainOptions(data ?? [])
    writeCatalogCache(cacheKey, normalized)
    return normalized
  }

  const scope = await resolveCatalogScope()
  const cacheKey = buildCatalogCacheKey({
    table,
    nameColumn,
    ownerScoped,
    ownerId: scope.ownerId,
    isMaster: scope.isMaster,
  })
  const cached = readCatalogCache(cacheKey)
  if (cached) {
    return cached
  }
  const data = await execute(
    supabase.rpc('rpc_catalog_list', { p_table: table }),
    errorMessage
  )
  const normalized = normalizeDomainOptions(data ?? [])
  writeCatalogCache(cacheKey, normalized)
  return normalized
}

async function resolveCatalogoIdsByNames({ table, nameColumn, nomes, errorMessage }) {
  const lista = normalizeNameList(nomes)
  if (!lista.length) {
    return []
  }
  const registros = await execute(
    supabase.from(table).select(`id, ${nameColumn}`),
    errorMessage,
  )
  const mapa = new Map()
  ;(registros ?? []).forEach((registro) => {
    const nome = trim(registro?.[nameColumn])
    const id = normalizeOptionId(registro?.id)
    if (!nome || !id) {
      return
    }
    mapa.set(normalizeCatalogoNameKey(nome), id)
  })
  return lista
    .map((nome) => mapa.get(normalizeCatalogoNameKey(nome)) || null)
    .filter(Boolean)
}

async function resolveCorIdsFromNames(nomes) {
  return resolveCatalogoIdsByNames({
    table: 'cor',
    nameColumn: 'cor',
    nomes,
    errorMessage: 'Falha ao resolver cores por nome.',
  })
}

async function resolveCaracteristicaIdsFromNames(nomes) {
  return resolveCatalogoIdsByNames({
    table: 'caracteristica_epi',
    nameColumn: 'caracteristica_material',
    nomes,
    errorMessage: 'Falha ao resolver caracteristicas por nome.',
  })
}

const normalizeCatalogoOptions = (lista) =>
  normalizeOptionList(lista).map((item) => ({
    id: item.id ?? item.nome,
    nome: item.nome,
  }))

const normalizeCaracteristicaLista = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
      .filter(Boolean)
  }
  const texto = String(value ?? '')
  if (!texto.trim()) {
    return []
  }
  return texto
    .split(/[;|,]/)
    .map((parte) => String(parte).trim())
    .filter(Boolean)
}

const formatCaracteristicaTexto = (value) =>
  Array.from(new Set(normalizeCaracteristicaLista(value)))
    .sort((a, b) => a.localeCompare(b))
    .join('; ')

const normalizeDomainOptions = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map((item) => {
      const nome = resolveTextValue(item?.nome ?? '')
      if (!nome) {
        return null
      }
      return {
        id: item?.id ?? null,
        nome,
      }
    })
    .filter(Boolean)

const normalizeDedupeKey = (value) => {
  const texto = trim(value)
  if (!texto) {
    return ''
  }
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const dedupeDomainOptionsByName = (lista) => {
  const seen = new Set()
  return (Array.isArray(lista) ? lista : []).filter((item) => {
    const key = normalizeDedupeKey(item?.nome ?? '')
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const normalizeEntradaInput = (payload = {}) => {
  const materialId = trim(payload.materialId)
  if (!materialId) {
    throw new Error('Selecione um material.')
  }
  const quantidade = toNumber(payload.quantidade, null)
  if (!quantidade || quantidade <= 0) {
    throw new Error('Informe a quantidade (maior que zero).')
  }
  const centroCusto = trim(payload.centroCusto)
  if (!centroCusto) {
    throw new Error('Selecione o centro de estoque.')
  }
  if (!isUuidValue(centroCusto)) {
    throw new Error('Selecione um centro de estoque valido.')
  }
  const dataEntradaRaw = trim(payload.dataEntrada)
  if (!dataEntradaRaw) {
    throw new Error('Informe a data da entrada.')
  }
  const dataEntradaIso = toDateOnlyIso(dataEntradaRaw)
  if (!dataEntradaIso) {
    throw new Error('Data da entrada invalida.')
  }
  return {
    materialId,
    quantidade,
    centroCusto,
    dataEntrada: dataEntradaIso,
  }
}

const toDateOnlyIso = (valor) => {
  const raw = trim(valor)
  if (!raw) {
    return null
  }
  const dataPart = raw.split('T')[0]
  const [year, month, day] = dataPart.split('-').map(Number)
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

const toMonthRefIso = (valor) => {
  const raw = trim(valor)
  if (!raw) {
    return null
  }
  // Se for ISO ou YYYY-MM já retorna o prefixo para evitar problemas de fuso.
  const datePart = raw.split('T')[0]
  const monthPrefix = /^\d{4}-\d{2}$/.test(raw) ? raw : /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart.slice(0, 7) : null
  if (monthPrefix) {
    return `${monthPrefix}-01`
  }
  const data = new Date(raw)
  if (Number.isNaN(data.getTime())) {
    return null
  }
  const year = data.getFullYear()
  const month = data.getMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

const buildMonthRangeIso = (mesRef) => {
  const inicio = toDateOnlyIso(mesRef)
  if (!inicio) {
    return null
  }
  const startDate = new Date(inicio)
  if (Number.isNaN(startDate.getTime())) {
    return null
  }
  const endDate = new Date(startDate)
  endDate.setUTCMonth(endDate.getUTCMonth() + 1)
  return {
    inicio: startDate.toISOString(),
    fim: endDate.toISOString(),
  }
}

const sanitizeMonthRef = (valor) => {
  const raw = trim(valor)
  if (!raw) {
    return null
  }
  const datePart = raw.split('T')[0]
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart.slice(0, 7)
  }
  return null
}

const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const formatPeriodoLabel = (inicio, fim) => {
  const buildLabel = (periodo) => {
    const sanitized = sanitizeMonthRef(periodo)
    if (!sanitized) return ''
    const [anoStr, mesStr] = sanitized.split('-')
    const mesIdx = Number.parseInt(mesStr, 10) - 1
    const nomeMes = MONTH_NAMES_PT[mesIdx] ?? mesStr
    return `${nomeMes} de ${anoStr}`
  }

  const inicioLabel = buildLabel(inicio)
  const fimLabel = buildLabel(fim)

  if (inicioLabel && fimLabel) {
    if (sanitizeMonthRef(inicio) === sanitizeMonthRef(fim)) {
      return inicioLabel
    }
    return `${inicioLabel} a ${fimLabel}`
  }
  if (inicioLabel) {
    return `A partir de ${inicioLabel}`
  }
  if (fimLabel) {
    return `Ate ${fimLabel}`
  }
  return 'Todos os periodos'
}

const normalizePeriodoRange = (inicio, fim) => {
  const start = sanitizeMonthRef(inicio) || null
  const end = sanitizeMonthRef(fim) || null
  if (start && end && start > end) {
    return { inicio: end, fim: start }
  }
  return { inicio: start, fim: end }
}

const isPeriodoWithinRange = (periodo, inicio, fim) => {
  const current = sanitizeMonthRef(periodo)
  if (!current) return false
  if (inicio && current < inicio) return false
  if (fim && current > fim) return false
  return true
}

const parseJsonArray = (valor, fallback = []) => {
  if (Array.isArray(valor)) return valor
  if (valor === null || valor === undefined) return fallback
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor)
      return Array.isArray(parsed) ? parsed : fallback
    } catch (_err) {
      return fallback
    }
  }
  return fallback
}

const parseJsonObject = (valor, fallback = {}) => {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor
  }
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
    } catch (_err) {
      return fallback
    }
  }
  return fallback
}

const extractOptionValues = (lista = [], key) => {
  const mapa = new Map()
  lista.forEach((item) => {
    const valor = (item?.[key] ?? '').toString().trim()
    if (!valor) return
    const chave = valor.toLowerCase()
    if (!mapa.has(chave)) {
      mapa.set(chave, valor)
    }
  })
  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

let statusHhtDefaultIdCache = null
async function resolveStatusHhtDefaultId() {
  if (statusHhtDefaultIdCache) {
    return statusHhtDefaultIdCache
  }
  try {
    const registro = await executeMaybeSingle(
      supabase.from('status_hht').select('id, status').ilike('status', 'ativo').limit(1),
      'Falha ao consultar status_hht padrao.'
    )
    const id = normalizeOptionId(registro?.id)
    if (id) {
      statusHhtDefaultIdCache = id
      return id
    }
  } catch (error) {
    reportClientError('Nao foi possivel obter status_hht padrao.', error)
  }
  return null
}

const statusHhtNomeCache = new Map()
async function resolveStatusHhtNome(statusId) {
  const alvo = normalizeOptionId(statusId)
  if (!alvo) {
    return ''
  }
  if (statusHhtNomeCache.has(alvo)) {
    return statusHhtNomeCache.get(alvo) || ''
  }
  try {
    const registro = await executeMaybeSingle(
      supabase.from('status_hht').select('status').eq('id', alvo).limit(1),
      'Falha ao consultar status_hht.'
    )
    const nome = resolveTextValue(registro?.status ?? '')
    statusHhtNomeCache.set(alvo, nome)
    return nome
  } catch (error) {
    reportClientError('Nao foi possivel resolver status_hht.', error, { statusId: alvo })
    return ''
  }
}

const toStartOfDayUtcIso = (value) => toDateOnlyIso(value)

const toEndOfDayUtcIso = (value) => {
  const startIso = toDateOnlyIso(value)
  if (!startIso) {
    return null
  }
  const date = new Date(startIso)
  date.setUTCHours(23, 59, 59, 999)
  return date.toISOString()
}

const buildDateWithCurrentTime = (valor) => {
  const raw = trim(valor)
  if (!raw) {
    return null
  }
  const base = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    return null
  }
  const agora = new Date()
  base.setHours(agora.getHours(), agora.getMinutes(), agora.getSeconds(), agora.getMilliseconds())
  return base
}

const mergeDateWithExistingTime = (valorData, dataAnterior) => {
  const raw = trim(valorData)
  if (!raw) {
    return null
  }
  let base = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    const alternativa = new Date(raw)
    if (Number.isNaN(alternativa.getTime())) {
      return null
    }
    base = alternativa
  }
  if (dataAnterior instanceof Date && !Number.isNaN(dataAnterior.getTime())) {
    base.setHours(
      dataAnterior.getHours(),
      dataAnterior.getMinutes(),
      dataAnterior.getSeconds(),
      dataAnterior.getMilliseconds()
    )
  }
  return base
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
    material.coresTexto,
  ]
    .map((parte) => (parte || '').toString().trim())
    .filter(Boolean)
  const caracteristicas = (material.caracteristicasTexto || '').trim()
  const fabricante = material.fabricanteNome || material.fabricante || ''
  const partes = [nome, grupo, ...detalhes, caracteristicas, fabricante]
  const vistos = new Set()
  return partes
    .map((parte) => (parte || '').toString().trim())
    .filter((parte) => {
      if (!parte) {
        return false
      }
      if (isUuidValue(parte)) {
        return false
      }
      const key = parte.toLowerCase()
      if (vistos.has(key)) {
        return false
      }
      vistos.add(key)
      return true
    })
    .join(' | ')
}

async function resolveCentroCustoNome(valor, { tipo = 'estoque' } = {}) {
  const raw = trim(valor)
  if (!raw) {
    return ''
  }
  if (!UUID_REGEX.test(raw)) {
    return raw
  }
  try {
    if (tipo === 'custo') {
      const registro = await executeMaybeSingle(
        supabase.from(CENTROS_CUSTO_TABLE).select('nome').eq('id', raw),
        'Falha ao consultar centro de custo.'
      )
      return resolveTextValue(registro?.nome ?? '') || raw
    }
    const registro = await executeMaybeSingle(
      supabase.from(CENTRO_ESTOQUE_TABLE).select('almox').eq('id', raw),
      'Falha ao consultar centro de estoque.'
    )
    return resolveTextValue(registro?.almox ?? '') || raw
  } catch (error) {
    reportClientError('Nao foi possivel resolver centro de estoque.', error, { valor: raw, tipo })
    return raw
  }
}

async function resolveCentroServicoNome(valor) {
  const raw = trim(valor)
  if (!raw) {
    return ''
  }
  if (!UUID_REGEX.test(raw)) {
    return raw
  }
  try {
    const lista = await carregarCentrosServico()
    const encontrado = (lista ?? []).find((item) => item?.id === raw)
    return resolveTextValue(encontrado?.nome ?? '') || raw
  } catch (error) {
    reportClientError('Nao foi possivel resolver centro de servico.', error, { valor: raw })
    return raw
  }
}

async function fetchMaterialSnapshot(materialId) {
  if (!materialId) {
    return null
  }
  try {
    const registro = await executeMaybeSingle(
      supabase.from('materiais_view').select(MATERIAL_SELECT_COLUMNS).eq('id', materialId),
      'Falha ao obter material.'
    )
    return registro ? mapMaterialRecord(registro) : null
  } catch (error) {
    reportClientError('Nao foi possivel resolver material.', error, { materialId })
    return null
  }
}

async function carregarMateriaisPorIds(ids = []) {
  const selecionados = Array.from(new Set((ids || []).filter(Boolean)))
  if (!selecionados.length) {
    return new Map()
  }
  try {
    const registros = await execute(
      supabase.from('materiais_view').select(MATERIAL_SELECT_COLUMNS).in('id', selecionados),
      'Falha ao listar materiais.'
    )
    return new Map(
      (registros ?? []).map((material) => [material.id, mapMaterialRecord(material)]).filter(([id]) => Boolean(id))
    )
  } catch (error) {
    reportClientError('Nao foi possivel carregar materiais por ids.', error, { ids: selecionados })
    return new Map()
  }
}

async function fetchPessoaSnapshot(pessoaId) {
  if (!pessoaId) {
    return null
  }
  try {
    const registro = await executeMaybeSingle(
      supabase
        .from('pessoas_view')
        .select('id, nome, matricula, cargo, centro_servico, centro_custo')
        .eq('id', pessoaId),
      'Falha ao obter pessoa.'
    )
    if (!registro) {
      return null
    }
    return {
      id: registro.id,
      nome: resolveTextValue(registro.nome ?? ''),
      matricula: resolveTextValue(registro.matricula ?? ''),
      cargo: resolveTextValue(registro.cargo ?? ''),
      centroServico: resolveTextValue(registro.centro_servico ?? ''),
      centroCusto: resolveTextValue(registro.centro_custo ?? ''),
    }
  } catch (error) {
    reportClientError('Nao foi possivel resolver pessoa.', error, { pessoaId })
    return null
  }
}

async function buildEntradaSnapshot(entrada) {
  if (!entrada) {
    return null
  }
  const resolveStatusEntradaNome = async (alvo) => {
    if (!alvo || typeof alvo !== 'object') {
      return ''
    }
    const statusKey = (alvo.statusId || alvo.status || '').toString().trim()
    const raw = alvo.statusNome || alvo.status || ''
    if (!statusKey) {
      return raw
    }
    try {
      const cache = await carregarStatusEntradaMap()
      return cache?.byId?.get(statusKey) || raw
    } catch (error) {
      reportClientError('Falha ao resolver status da entrada (snapshot).', error, { entradaId: alvo.id, statusKey })
      return raw
    }
  }

  const [material, centroNome, statusNome] = await Promise.all([
    fetchMaterialSnapshot(entrada.materialId),
    resolveCentroCustoNome(entrada.centroCustoId || entrada.centroCusto),
    resolveStatusEntradaNome(entrada),
  ])
  return {
    entradaId: entrada.id,
    materialId: entrada.materialId,
    materialResumo: material ? buildMaterialResumo(material) : entrada.materialId,
    descricao: material?.descricao ?? '',
    quantidade: entrada.quantidade,
    centroCusto: centroNome || entrada.centroCusto || '',
    centroCustoId: entrada.centroCustoId || '',
    dataEntrada: entrada.dataEntrada,
    usuarioResponsavel: entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || '',
    usuarioResponsavelNome: entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || '',
    valorUnitario: material?.valorUnitario ?? null,
    status: entrada.status || '',
    statusNome: statusNome || entrada.statusNome || entrada.status || '',
    statusId: entrada.statusId || null,
    atualizadoEm: entrada.atualizadoEm || entrada.atualizado_em || null,
    usuarioEdicao: entrada.usuarioEdicaoNome || entrada.usuarioEdicao || '',
    usuarioEdicaoNome: entrada.usuarioEdicaoNome || entrada.usuarioEdicao || '',
    usuarioEdicaoId: entrada.usuarioEdicaoId || null,
  }
}

async function registrarEntradaHistoricoSupabase(entradaAtual, entradaAnterior = null, meta = null) {
  if (!entradaAtual || !entradaAtual.id) {
    return
  }
  try {
    const [snapshotAtual, snapshotAnterior] = await Promise.all([
      buildEntradaSnapshot(entradaAtual),
      entradaAnterior ? buildEntradaSnapshot(entradaAnterior) : Promise.resolve(null),
    ])
    const payload =
      snapshotAnterior && Object.keys(snapshotAnterior).length > 0
        ? { atual: snapshotAtual, anterior: snapshotAnterior }
        : { atual: snapshotAtual }
    if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
      payload.meta = meta
    }
    await execute(
      supabase.from('entrada_historico').insert({
        id: randomId(),
        entrada_id: entradaAtual.id,
        material_id: entradaAtual.materialId,
        material_ent: payload,
        usuarioResponsavel: entradaAtual.usuarioResponsavelId || null,
      }),
      'Falha ao registrar historico da entrada.'
    )
  } catch (error) {
    reportClientError('Nao foi possivel registrar historico da entrada.', error, {
      entradaId: entradaAtual?.id,
    })
  }
}

async function ensureAcidentePartes(nomes) {
  const lista = normalizeStringArray(nomes)
  if (!lista.length) {
    return []
  }
  try {
    await execute(
      supabase
        .from('acidente_partes')
        .upsert(
          lista.map((nome, index) => ({
            nome,
            grupo: '',
            subgrupo: '',
            ativo: true,
          })),
          { onConflict: 'grupo,subgrupo,nome' },
        ),
      'Falha ao salvar partes lesionadas.',
    )
  } catch (error) {
    reportClientError('Nao foi possivel upsert partes lesionadas.', error, { nomes: lista })
  }
  return lista
}

const normalizeAgenteInput = (agente) => {
  if (!agente) {
    return { id: null, nome: '' }
  }
  if (typeof agente === 'object') {
    const nome = trim(agente.nome ?? agente.label ?? agente.value)
    const id = agente.id ?? agente.agenteId ?? null
    if (id || nome) {
      return { id: id || null, nome }
    }
    return { id: null, nome }
  }
  return { id: null, nome: trim(agente) }
}

const normalizeAgenteLookupKey = (valor) => {
  const texto = trim(valor)
  if (!texto) {
    return ''
  }
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const normalizeSearchTerm = (valor) => {
  const texto = trim(valor)
  if (!texto) {
    return ''
  }
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const pessoaMatchesSearch = (pessoa, termo) => {
  const alvo = normalizeSearchTerm(termo)
  if (!alvo) {
    return true
  }
  if (!pessoa || typeof pessoa !== 'object') {
    return false
  }
  const campos = [
    pessoa.nome,
    pessoa.matricula,
    pessoa.centroServico,
    pessoa.setor,
    pessoa.cargo,
    pessoa.tipoExecucao,
    pessoa.centroCusto,
    pessoa.usuarioCadastro,
    pessoa.usuarioEdicao,
  ]
  return campos.some((campo) => normalizeSearchTerm(campo).includes(alvo))
}

const applyPessoaSearchFilters = (builder, like) => {
  const filtros = [
    `nome.ilike.${like}`,
    `matricula.ilike.${like}`,
    `centro_servico.ilike.${like}`,
    `setor.ilike.${like}`,
    `cargo.ilike.${like}`,
    `centro_custo.ilike.${like}`,
    `tipo_execucao.ilike.${like}`,
    // Nomes dos usu├írios (colunas text), evitando aplicar ilike em UUID.
    `usuario_cadastro_nome.ilike.${like}`,
    `usuario_edicao_nome.ilike.${like}`,
  ]
  return builder.or(filtros.join(','))
}

let agenteCatalogCache = null

async function loadAgenteCatalog(forceReload = false) {
  if (forceReload) {
    agenteCatalogCache = null
  }
  if (agenteCatalogCache) {
    return agenteCatalogCache
  }
  ensureSupabase()
  const { data, error } = await supabase
    .from('acidente_agentes')
    .select('id, nome, ativo')
    .order('nome', { ascending: true })
  if (error) {
    throw mapSupabaseError(error, 'Falha ao carregar agentes de acidente.')
  }
  const lista = (data ?? [])
    .filter((item) => item && item.nome && item.ativo !== false)
    .map((item) => ({
      id: item.id ?? null,
      nome: trim(item.nome),
    }))
    .filter((item) => Boolean(item.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const map = new Map()
  lista.forEach((item) => {
    const chave = normalizeAgenteLookupKey(item.nome)
    if (!chave || map.has(chave)) {
      return
    }
    map.set(chave, { id: item.id ?? null, nome: item.nome })
  })
  agenteCatalogCache = { lista, map }
  return agenteCatalogCache
}

async function resolveAgenteId(agenteNome) {
  const nome = trim(agenteNome)
  if (!nome) {
    return null
  }
  const alvoNormalizado = normalizeAgenteLookupKey(nome)
  if (!alvoNormalizado) {
    return null
  }
  const tentarCatalogo = async (forceReload = false) => {
    try {
      const catalogo = await loadAgenteCatalog(forceReload)
      const encontrado = catalogo?.map?.get(alvoNormalizado)
      if (encontrado?.id) {
        return encontrado.id
      }
    } catch (catalogError) {
      reportClientError('Falha ao carregar catalogo de agentes.', catalogError, {
        stage: 'load_agente_catalog',
      })
    }
    return null
  }

  let agenteId = await tentarCatalogo(false)
  if (agenteId) {
    return agenteId
  }

  agenteId = await tentarCatalogo(true)
  if (agenteId) {
    return agenteId
  }

  try {
    ensureSupabase()
    const like = `%${nome}%`
    const { data, error } = await supabase
      .from('acidente_agentes')
      .select('id, nome')
      .ilike('nome', like)
      .limit(1)
    if (error) {
      throw error
    }
    if (Array.isArray(data) && data.length === 1) {
      const registro = data[0] ?? null
      const id = registro?.id ?? null
      const nomeCatalogo = trim(registro?.nome ?? nome)
      if (id) {
        const chave = normalizeAgenteLookupKey(nomeCatalogo)
        if (chave) {
          try {
            const catalogo = await loadAgenteCatalog(true)
            catalogo.map.set(chave, { id, nome: nomeCatalogo })
            if (!catalogo.lista.some((item) => item.id === id)) {
              catalogo.lista.push({ id, nome: nomeCatalogo, ordem: null })
            }
          } catch (cacheError) {
            reportClientError('Falha ao atualizar cache de agentes.', cacheError, {
              stage: 'update_agente_cache',
            })
          }
        }
      }
      return id
    }
  } catch (lookupError) {
    reportClientError('Nao foi possivel localizar agente para lesoes.', lookupError, {
      stage: 'lookup_agente',
      agenteNome: nome,
    })
  }
  return null
}

async function ensureAcidenteLesoes(agenteNome, nomes) {
  const lista = normalizeStringArray(nomes)
  const agenteId = await resolveAgenteId(agenteNome)
  if (!lista.length || !agenteId) {
    return lista
  }
  try {
    await execute(
      supabase
        .from('acidente_lesoes')
        .upsert(
          lista.map((nome, index) => ({
            agente_id: agenteId,
            nome,
            ordem: 1000 + index,
            ativo: true,
          })),
          { onConflict: 'agente_id,nome' },
        ),
      'Falha ao salvar lesoes.',
    )
  } catch (error) {
    reportClientError('Nao foi possivel upsert lesoes.', error, {
      stage: 'upsert_lesoes',
      agenteId,
      nomes: lista,
    })
  }
  return lista
}

function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase n├úo configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

function mapSupabaseError(error, fallbackMessage = GENERIC_ERROR) {
  if (!error) {
    return new Error(fallbackMessage)
  }
  const rawMessage = error.message || fallbackMessage
  const rawDetails = error.details || ''
  const rawHint = error.hint || ''
  const combined = `${rawMessage} ${rawDetails} ${rawHint}`.toLowerCase()
  if (combined.includes('acidente_cat_duplicate') || combined.includes('accidents_unique_cat_per_owner')) {
    return new Error('CAT ja cadastrada em outro acidente.')
  }
  const err = new Error(rawMessage)
  err.code = error.code
  err.hint = error.hint
  err.details = error.details
  return err
}

async function execute(builder, fallbackMessage) {
  ensureSupabase()
  const { data, error } = await builder
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

async function executePaged(buildQuery, fallbackMessage, options = {}) {
  const pageSize = Number(options.pageSize ?? 1000) || 1000
  const maxPages = Number(options.maxPages ?? 50) || 50
  let from = 0
  let result = []

  for (let page = 0; page < maxPages; page += 1) {
    const query = buildQuery().range(from, from + pageSize - 1)
    const data = await execute(query, fallbackMessage)
    const chunk = Array.isArray(data) ? data : []
    result = result.concat(chunk)
    if (chunk.length < pageSize) {
      break
    }
    from += pageSize
  }

  return result
}

async function executeSingle(builder, fallbackMessage) {
  ensureSupabase()
  const { data, error } = await builder.single()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

async function executeMaybeSingle(builder, fallbackMessage) {
  ensureSupabase()
  const { data, error } = await builder.maybeSingle()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  }
  return data
}

const isUuidValue = (value) => typeof value === 'string' && UUID_REGEX.test(value)

const extractTextualNames = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }
  const seen = new Set()
  return lista
    .map((item) => (typeof item?.nome === 'string' ? item.nome.trim() : ''))
    .filter(Boolean)
    .filter((nome) => {
      if (seen.has(nome)) {
        return false
      }
      seen.add(nome)
      return true
    })
}

const isFallbackError = (error) => error && (error.code === '42703' || error.code === '22P02')

async function deleteMaterialRelations(table, materialId, deleteMessage) {
  await execute(supabase.from(table).delete().eq('material_id', materialId), deleteMessage)
}

async function insertMaterialRelations({
  table,
  materialId,
  columnName,
  values,
  insertMessage,
}) {
  if (!Array.isArray(values) || values.length === 0) {
    return
  }

  const rows = values.map((value) => ({
    material_id: materialId,
    [columnName]: value,
  }))

  await execute(supabase.from(table).insert(rows), insertMessage)
}

async function replaceMaterialRelationsWithFallback({
  table,
  materialId,
  columnCandidates,
  values,
  deleteMessage,
  insertMessage,
  deleteFirst = true,
}) {
  const normalizedValues = normalizeRelationIds(values ?? [])
  let lastColumnError = null

  if (deleteFirst) {
    await deleteMaterialRelations(table, materialId, deleteMessage)
  }

  if (!Array.isArray(values) || values.length === 0) {
    return
  }

  const valuesAreUuidOnly = values.every((value) => isUuidValue(value))
  const idColumns = columnCandidates.filter((columnName) => /_id$/i.test(columnName))
  const nonIdColumns = columnCandidates.filter((columnName) => !/_id$/i.test(columnName))
  const orderedColumns =
    valuesAreUuidOnly && idColumns.length ? [...idColumns, ...nonIdColumns] : [...nonIdColumns, ...idColumns]

  for (const columnName of orderedColumns) {
    try {
      await insertMaterialRelations({
        table,
        materialId,
        columnName,
        values: normalizedValues,
        deleteMessage,
        insertMessage,
      })
      return
    } catch (error) {
      if (!error || error.code !== '42703') {
        if (normalizedValues.length > 0) {
          reportClientError('Supabase rejeitou IDs de vínculo de material.', error, {
            table,
            columnName,
            values: normalizedValues,
          })
        }
        throw error
      }
      if (error.code === '42703' || error.code === '22P02') {
        lastColumnError = error
        continue
      }
      throw error
    }
  }

  if (lastColumnError) {
    throw lastColumnError
  }
}

async function replaceMaterialCorVinculos(materialId, corIds, corNames) {
  const idValues = Array.isArray(corIds) ? corIds : []
  const nameValues = Array.isArray(corNames) ? corNames : []

  // Se veio nome mas não conseguimos IDs válidos, não siga silenciosamente.
  if (!idValues.length && nameValues.length) {
    throw new Error('Cor informada não encontrada no catálogo. Cadastre a cor ou selecione uma existente.')
  }
  // Nenhum dado de cor: nada a fazer.
  if (!idValues.length && !nameValues.length) {
    return
  }

  let idInserted = false
  try {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_COR_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_COR_RELATION_ID_COLUMNS,
      values: idValues,
      deleteMessage: 'Falha ao limpar v├¡nculos de cores do material.',
      insertMessage: 'Falha ao vincular cores ao material.',
    })
    idInserted = idValues.length > 0
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error
    }
  }

  if (!idInserted && nameValues.length) {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_COR_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_COR_RELATION_TEXT_COLUMNS,
      values: nameValues,
      deleteMessage: 'Falha ao limpar v├¡nculos de cores do material.',
      insertMessage: 'Falha ao vincular cores ao material.',
      deleteFirst: false,
    })
  }
}

async function replaceMaterialCaracteristicaVinculos(
  materialId,
  caracteristicaIds,
  caracteristicaNames,
) {
  const idValues = Array.isArray(caracteristicaIds) ? caracteristicaIds : []
  const nameValues = Array.isArray(caracteristicaNames) ? caracteristicaNames : []

  if (!idValues.length && nameValues.length) {
    throw new Error('Característica informada não encontrada no catálogo. Cadastre a característica ou selecione uma existente.')
  }
  if (!idValues.length && !nameValues.length) {
    return
  }

  let idInserted = false
  try {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_CARACTERISTICA_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_CARACTERISTICA_RELATION_ID_COLUMNS,
      values: idValues,
      deleteMessage: 'Falha ao limpar v├¡nculos de caracter├¡sticas do material.',
      insertMessage: 'Falha ao vincular caracter├¡sticas ao material.',
    })
    idInserted = idValues.length > 0
  } catch (error) {
    if (!isFallbackError(error)) {
      throw error
    }
  }

  if (!idInserted && nameValues.length) {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_CARACTERISTICA_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_CARACTERISTICA_RELATION_TEXT_COLUMNS,
      values: nameValues,
      deleteMessage: 'Falha ao limpar v├¡nculos de caracter├¡sticas do material.',
      insertMessage: 'Falha ao vincular caracter├¡sticas ao material.',
      deleteFirst: false,
    })
  }
}

async function insereCores(materialId, corIds, corNames) {
  await replaceMaterialCorVinculos(materialId, corIds, corNames)
}

async function insereCaracteristicas(materialId, caracteristicaIds, caracteristicaNames) {
  await replaceMaterialCaracteristicaVinculos(
    materialId,
    caracteristicaIds,
    caracteristicaNames,
  )
}

function buildMaterialSupabasePayload(dados, { usuario, agora, includeCreateAudit, includeUpdateAudit } = {}) {
  const nomePersist = dados.nome || ''
  const fabricantePersist = dados.fabricante || ''
  const fabricanteValue = fabricantePersist ? fabricantePersist : null
  const grupoMaterialPersist = dados.grupoMaterialId || dados.grupoMaterial || ''
  const grupoMaterialValue = grupoMaterialPersist ? grupoMaterialPersist : null
  const payload = {
    nome: nomePersist,
    fabricante: fabricanteValue,
    validadeDias: dados.validadeDias ?? null,
    ca: dados.ca ?? '',
    valorUnitario: dados.valorUnitario ?? 0,
    estoqueMinimo: dados.estoqueMinimo ?? 0,
    ativo: dados.ativo ?? true,
    descricao: dados.descricao ?? '',
    grupoMaterial: grupoMaterialValue,
    numeroCalcado: dados.numeroCalcado || null,
    numeroVestimenta: dados.numeroVestimenta || null,
    numeroEspecifico: dados.numeroEspecifico ?? '',
  }

  if (includeCreateAudit && usuario) {
    payload.usuarioCadastro = usuario
    payload.dataCadastro = agora ?? new Date().toISOString()
  }

  if (includeUpdateAudit && usuario) {
    payload.usuarioAtualizacao = usuario
    payload.atualizadoEm = agora ?? new Date().toISOString()
  }

  return payload
}

async function resolveUsuarioResponsavel() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) {
    return 'anonimo'
  }
  const meta = user.user_metadata || {}
  const metaNome =
    meta.username || meta.display_name || meta.full_name || meta.name || ''

  if (user.id) {
    try {
      const effective = await resolveEffectiveAppUser(user.id)
      const profile = effective?.dependentProfile || effective?.profile
      const nomeDb =
        resolveTextValue(profile?.username) ||
        resolveTextValue(profile?.display_name) ||
        resolveTextValue(profile?.email) ||
        ''
      if (nomeDb) {
        return nomeDb
      }
    } catch (error) {
      reportClientError('Nao foi possivel resolver usuario por app_users.', error, {
        userId: user.id,
      })
    }
  }

  const nomePreferencial = metaNome || user.email || user.id
  return nomePreferencial ? String(nomePreferencial).trim() : 'anonimo'
}

async function resolveUsuarioId() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user?.id) {
    return null
  }
  try {
    const effective = await resolveEffectiveAppUser(user.id)
    if (effective?.active === false) {
      throw new Error('Usuario inativo. Procure um administrador.')
    }
    return effective?.appUserId || user.id
  } catch (error) {
    reportClientError('Falha ao resolver usuario efetivo.', error, { userId: user.id })
    throw error
  }
}

async function resolveUsuarioIdOrThrow() {
  const usuarioId = await resolveUsuarioId()
  if (!usuarioId) {
    throw new Error('Sessao invalida, usuario nao identificado.')
  }
  return usuarioId
}

async function buildAuthHeaders(extra = {}) {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const sessionId = getSessionId()
  const sessionHeader = sessionId ? { 'X-Session-Id': sessionId } : {}
  return token ? { ...extra, ...sessionHeader, Authorization: `Bearer ${token}` } : { ...extra, ...sessionHeader }
}

async function resolveGrupoMaterialId(valor) {
  const texto = trim(valor)
  if (!texto) {
    return null
  }
  const uuid = normalizeUuid(texto)
  if (uuid) {
    return uuid
  }
  const data = await execute(
    supabase
      .from('grupos_material')
      .select('id')
      .ilike('nome', texto)
      .limit(1),
    'Falha ao resolver grupo de material.',
  )
  return Array.isArray(data) && data.length ? data[0]?.id ?? null : data?.id ?? null
}

async function resolveFabricanteId(valor) {
  const texto = trim(valor)
  if (!texto) {
    return null
  }
  const uuid = normalizeUuid(texto)
  if (uuid) {
    return uuid
  }
  const data = await execute(
    supabase.from('fabricantes').select('id').ilike('fabricante', texto).limit(1),
    'Falha ao resolver fabricante.',
  )
  return Array.isArray(data) && data.length ? data[0]?.id ?? null : data?.id ?? null
}

async function resolveMaterialItemId(valor) {
  const texto = trim(valor)
  if (!texto) {
    return null
  }
  const uuid = normalizeUuid(texto)
  if (uuid) {
    return uuid
  }
  const data = await execute(
    supabase.from('grupos_material_itens').select('id').ilike('nome', texto).limit(1),
    'Falha ao resolver item de material.',
  )
  return Array.isArray(data) && data.length ? data[0]?.id ?? null : data?.id ?? null
}

function ensureUuidOrThrow(valor, campo) {
  if (!isUuidValue(valor)) {
    throw new Error(`${campo} invalido. Selecione um registro cadastrado.`)
  }
  return valor
}
function mapMaterialRecord(record) {
  if (!record) {
    return null
  }
  const rawGrupoMaterial = trim(record.grupoMaterial ?? record.grupo_material ?? '')
  const grupoMaterialId = normalizeUuid(rawGrupoMaterial)
  const grupoMaterialNomeBase = trim(record.grupoMaterialNome ?? record.grupo_material_nome ?? '')
  const grupoMaterialNome = grupoMaterialNomeBase || (grupoMaterialId ? '' : rawGrupoMaterial)
  const nomeItemRelacionado =
    trim(record.nomeItemRelacionado ?? record.nome_item_relacionado ?? record.materialItemNome ?? '') || ''
  const rawNome = trim(record.nome ?? '')
  const materialItemNome = trim(record.materialItemNome ?? nomeItemRelacionado) || rawNome
  const nome = materialItemNome || rawNome
  const nomeId = rawNome
  const rawFabricante = trim(record.fabricante ?? '')
  const fabricanteNomeBase = trim(record.fabricanteNome ?? record.fabricante_nome ?? '')
  const fabricanteNome = fabricanteNomeBase || rawFabricante
  const caracteristicasLista = buildRelationSelectionList(
    record.caracteristicasIds ?? record.caracteristicas_ids ?? [],
    record.caracteristicaNome ?? record.caracteristicas_nome ?? [],
  )
  const coresLista = buildRelationSelectionList(
    record.coresIds ?? record.cores_ids ?? [],
    record.corNome ?? record.cores_nome ?? [],
  )
  const caracteristicasNomes = caracteristicasLista.map((item) => item.nome).filter(Boolean)
  const caracteristicasIds = caracteristicasLista.map((item) => item.id).filter(Boolean)
  const coresNomes = coresLista.map((item) => item.nome).filter(Boolean)
  const coresIds = coresLista.map((item) => item.id).filter(Boolean)
  const caracteristicasTexto = caracteristicasNomes.join('; ')
  const coresTexto = coresNomes.join('; ')
  const corMaterialFallback = trim(record.corMaterial ?? record.cor_material ?? '')
  const usuarioCadastroId = trim(record.usuarioCadastro ?? record.usuario_cadastro ?? '')
  const usuarioCadastroNome =
    trim(record.usuarioCadastroNome ?? record.usuario_cadastro_nome ?? '') ||
    usuarioCadastroId
  const usuarioCadastroUsername = trim(
    record.usuarioCadastroUsername ??
      record.usuario_cadastro_username ??
      record.username ??
      record.usuario?.username ??
      ''
  )

  const usuarioAtualizacaoId = trim(
    record.usuarioAtualizacao ?? record.usuario_atualizacao ?? '',
  )
  const usuarioAtualizacaoNome =
    trim(record.usuarioAtualizacaoNome ?? record.usuario_atualizacao_nome ?? '') ||
    usuarioAtualizacaoId
  const usuarioAtualizacaoUsername = trim(
    record.usuarioAtualizacaoUsername ?? record.usuario_atualizacao_username ?? ''
  )

  return {
    id: record.id,
    nome,
    nomeId,
    nomeItemRelacionado,
    materialItemNome,
    fabricante: rawFabricante,
    fabricanteNome,
    fabricantesNome: fabricanteNome,
    validadeDias: record.validadeDias ?? record.validade_dias ?? null,
    ca: record.ca ?? record.ca_number ?? '',
    valorUnitario: toNumber(record.valorUnitario ?? record.valor_unitario),
    estoqueMinimo: toNumber(record.estoqueMinimo ?? record.estoque_minimo),
    ativo: record.ativo ?? true,
    grupoMaterial: grupoMaterialNome,
    grupoMaterialNome,
    grupoMaterialId: grupoMaterialId || null,
    numeroCalcado: record.numeroCalcado ?? record.numero_calcado ?? '',
    numeroCalcadoNome: record.numeroCalcadoNome ?? record.numero_calcado_nome ?? '',
    numeroVestimenta: record.numeroVestimenta ?? record.numero_vestimenta ?? '',
    numeroVestimentaNome: record.numeroVestimentaNome ?? record.numero_vestimenta_nome ?? '',
    numeroEspecifico: record.numeroEspecifico ?? record.numero_especifico ?? '',
    descricao: record.descricao ?? '',
    caracteristicaEpi: caracteristicasTexto,
    caracteristicas: caracteristicasLista,
    caracteristicasIds,
    caracteristicasNomes,
    caracteristicasTexto,
    corMaterial: coresLista[0]?.nome || coresTexto || corMaterialFallback,
    cores: coresLista,
    coresIds,
    coresNomes,
    coresTexto,
    usuarioCadastro: usuarioCadastroId,
    usuarioCadastroNome,
    usuarioCadastroUsername: usuarioCadastroUsername || null,
    usuarioAtualizacao: usuarioAtualizacaoId,
    usuarioAtualizacaoNome,
    usuarioAtualizacaoUsername: usuarioAtualizacaoUsername || null,
    registradoPor: usuarioCadastroUsername || usuarioCadastroNome || usuarioCadastroId || '',
    dataCadastro: record.dataCadastro ?? record.data_cadastro ?? record.created_at ?? record.createdAt ?? null,
    criadoEm: record.dataCadastro ?? record.data_cadastro ?? record.created_at ?? record.createdAt ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? record.updated_at ?? record.updatedAt ?? null,
  }
}

function mapPessoaRecord(record) {
  if (!record) {
    return null
  }
  const centroServicoRel = record.centros_servico ?? record.centro_servico_rel
  const setorRel = record.setores ?? record.setor_rel
  const cargoRel = record.cargos ?? record.cargo_rel
  const centroCustoRel = record.centros_custo ?? record.centro_custo_rel
  const tipoExecucaoRel = record.tipo_execucao ?? record.tipo_execucao_rel
  const ativo = toBooleanValue(record.ativo, true)

  const resolveCampo = (...valores) => {
    for (const valor of valores) {
      const texto = resolveTextValue(valor)
      if (texto) {
        return texto
      }
    }
    return ''
  }

  const centroServico = resolveCampo(
    record.centroServico,
    record.centro_servico,
    centroServicoRel,
    record.setor,
    record.local
  )
  const setor = resolveCampo(record.setor, setorRel, centroServico)
  const cargo = resolveCampo(record.cargo, cargoRel)
  const tipoExecucao = resolveCampo(record.tipoExecucao, record.tipo_execucao, tipoExecucaoRel)
  const centroCusto = resolveCampo(centroCustoRel, record.centro_custo, record.centroServico, centroServico)

  const historicoRaw =
    record.historicoEdicao ??
    record.historico_edicao ??
    record.pessoas_historico ??
    []

  return {
    id: record.id,
    nome: record.nome ?? '',
    matricula: record.matricula ?? '',
    centroServico,
    local: resolveTextValue(record.local ?? centroServico),
    centroServicoId: record.centro_servico_id ?? centroServicoRel?.id ?? null,
    setor,
    setorId: record.setor_id ?? setorRel?.id ?? null,
    cargo,
    cargoId: record.cargo_id ?? cargoRel?.id ?? null,
    centroCusto,
    centroCustoId: record.centro_custo_id ?? centroCustoRel?.id ?? null,
    tipoExecucao,
    tipoExecucaoId: record.tipo_execucao_id ?? tipoExecucaoRel?.id ?? null,
    dataAdmissao: record.dataAdmissao ?? record.data_admissao ?? null,
    dataDemissao: record.dataDemissao ?? record.data_demissao ?? null,
    observacao: record.observacao ?? record.observacao_cancelamento ?? '',
    usuarioCadastro: resolveTextValue(
      record.usuarioCadastroNome ??
        record.usuario_cadastro_nome ??
        record.usuarioCadastro ??
        record.usuario_cadastro ??
        ''
    ),
    usuarioEdicao: resolveTextValue(
      record.usuarioEdicaoNome ??
        record.usuario_edicao_nome ??
        record.usuarioEdicao ??
        record.usuario_edicao ??
        ''
    ),
    criadoEm: record.criadoEm ?? record.criado_em ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
    historicoEdicao: normalizePessoaHistorico(historicoRaw),
    ativo,
  }
}

function mapEntradaRecord(record) {
  if (!record) {
    return null
  }
  const statusRel = record.status_rel ?? record.status_rel_default ?? null
  const centroEstoqueValor = record.centroEstoque ?? record.centro_estoque ?? null
  const centroCustoRaw = record.centroCusto ?? record.centro_custo ?? record.centroEstoque ?? ''
  const centroCustoId = normalizeUuid(centroEstoqueValor)
  const centroCustoNome =
    resolveTextValue(
      record.centroEstoqueNome ??
        record.centro_estoque_nome ??
        record.centroCustoNome ??
        '',
    ) ||
    (centroCustoId ? '' : resolveTextValue(centroCustoRaw))
  const usuarioRaw = record.usuarioResponsavel ?? record.usuario_responsavel ?? ''
  const usuarioId = isUuidValue(usuarioRaw) ? usuarioRaw : null
  const usuarioTexto = resolveTextValue(usuarioRaw)
  const statusRaw = record.status ?? record.status_entrada ?? ''
  const statusRelNome = resolveTextValue(statusRel?.status ?? record.statusNome ?? record.status_nome ?? '')
  const statusId = record.statusId ?? statusRel?.id ?? (isUuidValue(statusRaw) ? statusRaw : null)
  const statusNome = statusRelNome || (statusId ? '' : resolveTextValue(statusRaw)) || statusRaw
  const usuarioEdicaoRaw = record.usuarioEdicao ?? record.usuario_edicao ?? ''
  const usuarioEdicaoId = isUuidValue(usuarioEdicaoRaw) ? usuarioEdicaoRaw : null
  const usuarioEdicaoNome = resolveTextValue(usuarioEdicaoRaw)
  const criadoEm =
    record.criadoEm ??
    record.criado_em ??
    record.created_at ??
    record.create_at ??
    record.createdAt ??
    record.dataEntrada ??
    record.data_entrada ??
    null
  return {
    id: record.id,
    materialId: record.materialId ?? record.material_id ?? null,
    quantidade: toNumber(record.quantidade),
    centroCustoId: centroCustoId ?? null,
    centroCusto: centroCustoNome || centroCustoRaw || '',
    dataEntrada: record.dataEntrada ?? record.data_entrada ?? null,
    criadoEm,
    createdAt: record.createdAt ?? record.created_at ?? record.create_at ?? null,
    created_at: record.created_at ?? record.create_at ?? null,
    create_at: record.create_at ?? null,
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? '' : usuarioTexto,
    statusId: statusId || null,
    status: statusNome || statusRaw,
    statusNome: statusNome || (statusId ? '' : statusRaw),
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
    usuarioEdicaoId: usuarioEdicaoId,
    usuarioEdicao: usuarioEdicaoId ? usuarioEdicaoId : usuarioEdicaoNome,
    usuarioEdicaoNome: usuarioEdicaoId ? '' : usuarioEdicaoNome,
  }
}

function mapEntradaHistoryRecord(record) {
  if (!record) {
    return null
  }
  const rawSnapshot = record.material_ent ?? record.materialEnt ?? {}
  const atual = rawSnapshot.atual ?? rawSnapshot
  const anterior = rawSnapshot.anterior ?? null
  const usuarioNome = resolveTextValue(
    record.usuario?.display_name ??
      record.usuario?.username ??
      record.usuario?.email ??
      atual.usuarioResponsavelNome ??
      atual.usuarioResponsavel ??
      ''
  )
  return {
    id: record.id,
    entradaId: record.entrada_id ?? atual.entradaId ?? null,
    materialId: record.material_id ?? atual.materialId ?? null,
    criadoEm: record.created_at ?? record.createdAt ?? null,
    usuario: usuarioNome,
    snapshot: {
      atual,
      anterior,
    },
  }
}

function mapSaidaRecord(record) {
  if (!record) {
    return null
  }
  const statusRel = record.status_rel ?? record.status_rel_default ?? record.status_saida ?? null
  const statusRaw = record.status ?? ''
  const statusRelNome = resolveTextValue(statusRel?.status ?? record.statusNome ?? '')
  const statusId =
    record.statusId ??
    statusRel?.id ??
    (isUuidValue(statusRaw) ? statusRaw : null)
  const statusTexto =
    statusRelNome ||
    (statusId ? '' : resolveTextValue(statusRaw)) ||
    statusRaw
  const usuarioRaw = record.usuarioResponsavel ?? record.usuario_responsavel ?? ''
  const usuarioId = isUuidValue(usuarioRaw) ? usuarioRaw : null
  const usuarioTexto = resolveTextValue(usuarioRaw)
  return {
    id: record.id,
    materialId: record.materialId ?? record.material_id ?? null,
    pessoaId: record.pessoaId ?? record.pessoa_id ?? null,
    quantidade: toNumber(record.quantidade),
    centroEstoqueId: record.centroEstoqueId ?? record.centro_estoque ?? null,
    centroEstoque: resolveTextValue(record.centroEstoqueNome ?? record.centroEstoque ?? record.centro_estoque ?? ''),
    centroCustoId: record.centroCustoId ?? record.centro_custo ?? null,
    centroCusto: resolveTextValue(record.centroCustoNome ?? record.centroCusto ?? record.centro_custo ?? ''),
    centroServicoId: record.centroServicoId ?? record.centro_servico ?? null,
    centroServico: resolveTextValue(
      record.centroServicoNome ?? record.centroServico ?? record.centro_servico ?? ''
    ),
    setorId: record.setorId ?? record.setor_id ?? null,
    setor: resolveTextValue(record.setorNome ?? record.setor ?? ''),
    local: resolveTextValue(record.local ?? ''),
    dataEntrega: record.dataEntrega ?? record.data_entrega ?? null,
    dataTroca: record.dataTroca ?? record.data_troca ?? null,
    isTroca: record.isTroca ?? record.is_troca ?? false,
    trocaDeSaida: record.trocaDeSaida ?? record.troca_de_saida ?? null,
    trocaSequencia: record.trocaSequencia ?? record.troca_sequencia ?? 0,
    statusId,
    status: statusTexto || statusRaw,
    statusNome: statusRelNome || statusTexto || statusRaw,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelId: usuarioId,
    usuarioResponsavelNome: usuarioId ? '' : usuarioTexto,
    criadoEm: record.criadoEm ?? record.created_at ?? record.createdAt ?? null,
    atualizadoEm: record.atualizadoEm ?? record.updated_at ?? record.atualizado_em ?? null,
    usuarioEdicao: record.usuarioEdicao ?? record.usuario_edicao ?? null,
  }
}

function mapSaidaHistoryRecord(record) {
  if (!record) {
    return null
  }
  const usuarioNome = resolveTextValue(
    record.usuario?.username ??
      record.usuario?.display_name ??
      record.usuario?.email ??
      record.usuario_responsavel_nome ??
      record.usuarioResponsavel ??
      ''
  )
  const snapshot =
    record.material_saida ??
    record.saida_snapshot ??
    record.snapshot ??
    record.saida_ent ??
    record.saida ??
    record.dados ??
    {}
  if (snapshot && snapshot.status && isUuidValue(snapshot.status)) {
    const cache = statusSaidaCache && statusSaidaCache.byId ? statusSaidaCache.byId : null
    if (cache && cache.has(snapshot.status)) {
      snapshot.statusNome = cache.get(snapshot.status)
      snapshot.status = cache.get(snapshot.status)
    }
  }
  return {
    id: record.id,
    saidaId: record.saida_id ?? record.saidaId ?? record.saida ?? null,
    materialId: record.material_id ?? null,
    criadoEm: record.created_at ?? record.criado_em ?? record.criadoEm ?? null,
    usuario: usuarioNome || 'Nao informado',
    snapshot,
  }
}

async function buildSaidaSnapshot(saida) {
  if (!saida) {
    return null
  }
  const [material, pessoa, centroCustoNome] = await Promise.all([
    fetchMaterialSnapshot(saida.materialId),
    fetchPessoaSnapshot(saida.pessoaId),
    resolveCentroCustoNome(saida.centroCustoId || saida.centroCusto, { tipo: 'custo' }),
  ])
  const statusId = saida.statusId || (isUuidValue(saida.status) ? saida.status : null)
  const statusNome = saida.statusNome || saida.status || ''
  return {
    saidaId: saida.id,
    pessoaId: saida.pessoaId,
    pessoaNome: pessoa?.nome ?? '',
    pessoaMatricula: pessoa?.matricula ?? '',
    pessoaCargo: pessoa?.cargo ?? '',
    materialResumo: material ? buildMaterialResumo(material) : saida.materialId,
    descricao: material?.descricao ?? '',
    quantidade: saida.quantidade,
    centroCusto: centroCustoNome || saida.centroCusto || '',
    centroCustoId: saida.centroCustoId || '',
    centroServico: saida.centroServico || pessoa?.centroServico || '',
    centroServicoId: saida.centroServicoId || '',
    status: statusNome || statusId || '',
    statusId: statusId || '',
    statusNome: statusNome || statusId || '',
    dataEntrega: saida.dataEntrega,
    dataTroca: saida.dataTroca,
    isTroca: Boolean(saida.isTroca),
    trocaDeSaida: saida.trocaDeSaida || null,
    trocaSequencia: Number.isFinite(Number(saida.trocaSequencia)) ? Number(saida.trocaSequencia) : 0,
    usuarioResponsavel: saida.usuarioResponsavelNome || saida.usuarioResponsavel || '',
  }
}

async function registrarSaidaHistoricoSupabase(saidaAtual, saidaAnterior = null, extras = {}) {
  if (!saidaAtual || !saidaAtual.id) {
    return
  }
  try {
    const [snapshotAtualBase, snapshotAnterior] = await Promise.all([
      buildSaidaSnapshot(saidaAtual),
      saidaAnterior ? buildSaidaSnapshot(saidaAnterior) : Promise.resolve(null),
    ])
    const snapshotAtual = { ...snapshotAtualBase, ...extras }

    const normalizarValor = (campo, valor) => {
      if (valor === undefined || valor === null) {
        return null
      }
      if (campo === 'dataEntrega' || campo === 'dataTroca') {
        const data = valor instanceof Date ? valor : new Date(valor)
        if (Number.isNaN(data.getTime())) {
          return valor
        }
        const iso = data.toISOString()
        return iso.replace(/\.\d{3}Z$/, 'Z')
      }
      return valor
    }

    const camposComparacao = [
      'materialResumo',
      'pessoaNome',
      'pessoaCargo',
      'quantidade',
      'status',
      'centroCusto',
      'centroServico',
      'dataEntrega',
      'dataTroca',
      'isTroca',
      'trocaDeSaida',
      'trocaSequencia',
    ]
    const mudou = (campo) => {
      if (!snapshotAnterior) {
        return true
      }
      const antes = normalizarValor(campo, snapshotAnterior[campo])
      const depois = normalizarValor(campo, snapshotAtual[campo])
      return JSON.stringify(antes) !== JSON.stringify(depois)
    }
    const houveAlteracao = camposComparacao.some(mudou) || !snapshotAnterior
    if (snapshotAnterior && !houveAlteracao) {
      return
    }
    const payload =
      snapshotAnterior && Object.keys(snapshotAnterior).length > 0
        ? { atual: snapshotAtual, anterior: snapshotAnterior }
        : { atual: snapshotAtual }
    await execute(
      supabase.from('saidas_historico').insert({
        id: randomId(),
        saida_id: saidaAtual.id,
        material_id: saidaAtual.materialId,
        material_saida: payload,
        usuarioResponsavel: saidaAtual.usuarioResponsavelId || null,
      }),
      'Falha ao registrar historico da saida.'
    )
  } catch (error) {
    reportClientError('Nao foi possivel registrar historico da saida.', error, {
      saidaId: saidaAtual?.id,
    })
  }
}

function mapAcidenteRecord(record) {
  if (!record) {
    return null
  }
  const agentesIds = toUuidArrayOrNulls(record.agentes_ids ?? record.agentesIds ?? [])
  const tiposIds = toUuidArrayOrNulls(record.tipos_ids ?? record.tiposIds ?? record.tipos_ids)
  const lesoesIds = toUuidArrayOrNulls(record.lesoes_ids ?? record.lesoesIds ?? record.lesoes_ids)
  const partesIds = toUuidArrayOrEmpty(record.partes_ids ?? record.partesIds ?? record.partes_ids)

  const tiposNomesBase = normalizeStringArray(
    record.tipos_nomes ?? record.tiposNomes ?? record.tipos ?? [],
  )
  const tiposNomes = tiposNomesBase.length
    ? tiposNomesBase
    : splitMultiValue(record.tipo ?? record.tipos ?? '')

  const lesoesNomesBase = normalizeStringArray(
    record.lesoes_nomes ?? record.lesoesNomes ?? record.lesoes ?? [],
  )
  let lesoesNomes = lesoesNomesBase.length ? lesoesNomesBase : []
  if (!lesoesNomes.length) {
    const unica = trim(record.lesao ?? record.lesao_nome ?? '')
    if (unica) {
      lesoesNomes = [unica]
    }
  }

  const agentesNomesBase = normalizeStringArray(
    record.agentes_nomes ?? record.agentesNomes ?? record.agentes ?? [],
  )

  const partesNomesBase = normalizeStringArray(
    record.partes_nomes ?? record.partesNomes ?? record.partesLesionadas ?? record.partes_lesionadas ?? [],
  )
  let partesNomes = partesNomesBase.length ? partesNomesBase : []
  if (!partesNomes.length) {
    const unica = trim(record.parteLesionada ?? record.parte_lesionada ?? '')
    if (unica) {
      partesNomes = [unica]
    }
  }

  const agenteNome = resolveTextValue(record.agente_nome ?? record.agenteNome ?? record.agente ?? '')
  let agentesLista = agentesNomesBase.length
    ? agentesNomesBase.slice()
    : normalizeStringArray(record.agentes ?? (agenteNome ? [agenteNome] : []))
  if (!agentesLista.length && agenteNome) {
    agentesLista = [agenteNome]
  }

  let agentesIdsResolvidos = agentesIds
  if (!agentesIdsResolvidos.length) {
    const agenteIdFallback = normalizeUuid(record.agente_id ?? record.agenteId)
    if (agenteIdFallback) {
      const total = Math.max(tiposIds.length, lesoesIds.length, tiposNomes.length, lesoesNomes.length, 1)
      agentesIdsResolvidos = Array.from({ length: total }, () => agenteIdFallback)
    }
  }
  let agentesNomesResolvidos = agentesNomesBase
  if (!agentesNomesResolvidos.length && agenteNome) {
    const total = Math.max(
      agentesIdsResolvidos.length,
      tiposIds.length,
      lesoesIds.length,
      tiposNomes.length,
      lesoesNomes.length,
      1,
    )
    agentesNomesResolvidos = Array.from({ length: total }, () => agenteNome)
  }

  const totalClassificacoes = Math.max(
    agentesIdsResolvidos.length,
    agentesNomesResolvidos.length,
    tiposIds.length,
    tiposNomes.length,
    lesoesIds.length,
    lesoesNomes.length,
  )
  const classificacoesAgentes = []
  for (let index = 0; index < totalClassificacoes; index += 1) {
    const agenteId = agentesIdsResolvidos[index] ?? null
    const agenteNomeRow = agentesNomesResolvidos[index] ?? ''
    const tipoId = tiposIds[index] ?? null
    const tipoNomeRow = tiposNomes[index] ?? ''
    const lesaoId = lesoesIds[index] ?? null
    const lesaoNomeRow = lesoesNomes[index] ?? ''
    if (agenteId || agenteNomeRow || tipoId || tipoNomeRow || lesaoId || lesaoNomeRow) {
      classificacoesAgentes.push({
        agenteId,
        agenteNome: agenteNomeRow,
        tipoId,
        tipoNome: tipoNomeRow,
        lesaoId,
        lesaoNome: lesaoNomeRow,
      })
    }
  }

  const uniqueByLower = (lista) => {
    const seen = new Set()
    return lista.filter((item) => {
      const texto = trim(item)
      if (!texto) {
        return false
      }
      const chave = texto.toLowerCase()
      if (seen.has(chave)) {
        return false
      }
      seen.add(chave)
      return true
    })
  }

  const agentesUnicos = uniqueByLower(
    classificacoesAgentes.map((item) => item.agenteNome).filter(Boolean).length
      ? classificacoesAgentes.map((item) => item.agenteNome)
      : agentesLista,
  )
  const tiposUnicos = uniqueByLower(tiposNomes)
  const lesoesUnicas = uniqueByLower(lesoesNomes)

  const tiposTexto = tiposUnicos.join('; ')
  const agentesTexto = agentesUnicos.length ? agentesUnicos.join('; ') : agenteNome
  const agentePrincipal = agenteNome || agentesUnicos[agentesUnicos.length - 1] || ''

  const centroServicoNome = resolveTextValue(
    record.centro_servico ?? record.centroServico ?? record.setor ?? '',
  )
  const localNome = resolveTextValue(record.local ?? record.local_nome ?? '')
  return {
    id: record.id,
    pessoaId: record.people_id ?? record.pessoa_id ?? null,
    matricula: record.matricula ?? '',
    nome: record.nome ?? '',
    cargo: record.cargo ?? '',
    data: record.data ?? record.accident_date ?? null,
    diasPerdidos: toNumber(record.dias_perdidos ?? record.diasPerdidos ?? record.lost_days),
    diasDebitados: toNumber(record.dias_debitados ?? record.diasDebitados ?? record.debited_days),
    tipo: tiposTexto,
    tipos: tiposUnicos,
    tiposIds,
    agente: agentesTexto,
    agentes: agentesUnicos,
    agenteId: classificacoesAgentes[0]?.agenteId ?? record.agente_id ?? record.agenteId ?? null,
    agentesIds: agentesIdsResolvidos,
    agenteNome,
    tipoPrincipal: tiposNomes[0] ?? '',
    agentePrincipal,
    cid: record.cid ?? record.cid_code ?? '',
    lesao: lesoesUnicas[0] ?? '',
    lesoes: lesoesUnicas,
    lesoesIds,
    parteLesionada: partesNomes[0] ?? '',
    partesLesionadas: partesNomes,
    partesIds,
    centroServico: centroServicoNome,
    centroServicoId: record.centro_servico_id ?? record.centroServicoId ?? record.service_center ?? null,
    setor: resolveTextValue(record.setor ?? centroServicoNome),
    local: localNome || centroServicoNome,
    localId: record.local_id ?? record.localId ?? record.location_name ?? null,
    cat: record.cat ?? record.cat_number ?? null,
    observacao: record.observacao ?? record.notes ?? '',
    dataEsocial: record.data_esocial ?? record.dataEsocial ?? record.esocial_date ?? null,
    esocial: Boolean(record.esocial ?? record.esocial_involved ?? false),
    sesmt: Boolean(record.sesmt ?? record.sesmt_involved ?? false),
    dataSesmt: record.data_sesmt ?? record.dataSesmt ?? record.sesmt_date ?? null,
    criadoEm: record.criado_em ?? record.criadoEm ?? record.created_at ?? null,
    atualizadoEm: record.atualizado_em ?? record.atualizadoEm ?? record.updated_at ?? null,
    registradoPor:
      record.registrado_por_nome ??
      record.registradoPorNome ??
      record.registrado_por ??
      record.registradoPor ??
      record.created_by_username ??
      '',
    atualizadoPor:
      record.atualizado_por_nome ??
      record.atualizadoPorNome ??
      record.atualizado_por ??
      record.atualizadoPor ??
      record.updated_by_username ??
      '',
    hht: toNullableNumber(record.hht_value ?? record.hht),
    ativo: record.ativo !== false && record.is_active !== false,
    cancelMotivo: record.cancel_motivo ?? record.cancel_reason ?? record.cancelMotivo ?? null,
    classificacoesAgentes,
  }
}

async function resolveHhtMensalValor(centroServicoId, mesRef) {
  if (!centroServicoId || !mesRef) {
    return { valor: null, status: '' }
  }
  const registro = await executeMaybeSingle(
    supabase
      .from('hht_mensal')
      .select('id, hht_final, status_hht (status)')
      .eq('centro_servico_id', centroServicoId)
      .eq('mes_ref', mesRef)
      .limit(1),
    'Falha ao consultar HHT mensal.'
  )
  if (!registro) {
    return { valor: null, status: '' }
  }
  const valor = Number(registro.hht_final ?? 0)
  const status = resolveTextValue(registro?.status_hht?.status ?? '')
  if (!Number.isFinite(valor) || valor < 0) {
    return { valor: null, status }
  }
  return { valor, status }
}

async function syncAcidentesHht(centroServicoId, mesRef, hhtValor) {
  const valor = Number(hhtValor)
  if (!centroServicoId || !mesRef || !Number.isFinite(valor) || valor < 0) {
    return
  }
  const intervalo = buildMonthRangeIso(mesRef)
  if (!intervalo) {
    return
  }
  try {
    await execute(
      supabase
        .from('accidents')
        .update({ hht_value: valor })
        .eq('service_center', centroServicoId)
        .gte('accident_date', intervalo.inicio)
        .lt('accident_date', intervalo.fim)
        .or('hht_value.is.null,hht_value.eq.0'),
      'Falha ao vincular HHT aos acidentes.'
    )
  } catch (error) {
    reportClientError(
      'Nao foi possivel sincronizar HHT dos acidentes.',
      error,
      { centroServicoId, mesRef, hht: valor },
      'warn'
    )
  }
}

function sanitizePessoaPayload(payload = {}) {
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    centroServico: trim(payload.centroServico ?? payload.centro_servico ?? payload.local),
    setor: trim(payload.setor ?? payload.setor_id ?? payload.centroServico ?? payload.centro_servico ?? payload.local),
    cargo: trim(payload.cargo),
    tipoExecucao: trim(payload.tipoExecucao ?? '').toUpperCase(),
    dataAdmissao: sanitizeDate(payload.dataAdmissao),
    dataDemissao: sanitizeDate(payload.dataDemissao),
    ativo: toBooleanValue(payload.ativo, true),
    observacao: trim(payload.observacao),
    forceNomeConflict: payload.forceNomeConflict === true,
  }
}

function sanitizeMaterialPayload(payload = {}) {
  const nomeRawId = trim(
    payload.nomeId ??
      payload.nome_id ??
      payload.nome ??
      payload.materialItemNome ??
      payload.nomeItemRelacionado ??
      '',
  )
  const nomeId = normalizeRelationId(nomeRawId)
  const nomeDisplay =
    trim(payload.materialItemNome ?? payload.nomeItemRelacionado ?? payload.nome ?? '') || ''

  const grupoMaterialId = trim(payload.grupoMaterialId ?? payload.grupo_material_id ?? '')
  const grupoMaterialNome =
    trim(
      payload.grupoMaterialNome ??
        payload.grupo_material_nome ??
        payload.grupoMaterial ??
        payload.grupo_material ??
        '',
    ) || ''
  const grupoMaterial = grupoMaterialNome
  const numeroCalcado = trim(payload.numeroCalcado ?? payload.numero_calcado ?? '')
  const numeroVestimenta = trim(payload.numeroVestimenta ?? payload.numero_vestimenta ?? '')
  const nomeDisplayId = nomeId || nomeDisplay
  const nomeEpi = nomeDisplay || ''
  const materialItemNome =
    nomeEpi || trim(payload.materialItemNome ?? payload.nomeItemRelacionado ?? '')
  const fabricanteId = normalizeRelationId(payload.fabricante ?? payload.fabricante_id ?? '')
  const fabricanteNome =
    trim(payload.fabricanteNome ?? payload.fabricante ?? payload.fabricante_nome ?? '') || ''
  const caracteristicasSelecionadas = normalizeOptionList(
    payload.caracteristicas ??
      payload.caracteristicasSelecionadas ??
      payload.caracteristicasEpi ??
      payload.caracteristicaEpi ??
      payload.caracteristica_epi ??
      payload.caracteristicas_epi ??
      []
  )
  const caracteristicaEpi = formatCaracteristicaTexto(
    caracteristicasSelecionadas.length
      ? caracteristicasSelecionadas.map((item) => item.nome)
      : payload.caracteristicaEpi ?? payload.caracteristica_epi ?? '',
  )
  const coresSelecionadas = normalizeOptionList(
    payload.cores ??
      payload.coresSelecionadas ??
      payload.coresIds ??
      payload.corMaterial ??
      payload.cor_material ??
      payload.cor ??
      []
  )
  const corMaterialTexto =
    coresSelecionadas.length
      ? coresSelecionadas.map((item) => item.nome).join('; ')
      : trim(payload.corMaterial ?? payload.cor_material ?? '')
  const numeroEspecifico = trim(payload.numeroEspecifico ?? payload.numero_especifico ?? '')
  return {
    nome: nomeId || '',
    nomeId: nomeId || '',
    nomeItemRelacionado: materialItemNome || nomeEpi,
    materialItemNome: materialItemNome || nomeEpi,
    fabricante: fabricanteId ?? '',
    fabricanteNome,
    validadeDias: toNullableNumber(payload.validadeDias ?? payload.validade_dias),
    ca: trim(payload.ca ?? ''),
    valorUnitario: toNumber(payload.valorUnitario ?? payload.valor_unitario ?? 0),
    estoqueMinimo: toNumber(payload.estoqueMinimo ?? payload.estoque_minimo ?? 0),
    ativo: payload.ativo ?? true,
    descricao: trim(payload.descricao ?? ''),
    grupoMaterial,
    grupoMaterialNome,
    grupoMaterialId: normalizeRelationId(grupoMaterialId),
    numeroCalcado,
    numeroVestimenta,
    numeroEspecifico,
    caracteristicaEpi,
    caracteristicas: caracteristicasSelecionadas,
    caracteristicasIds: normalizeRelationIds(
      caracteristicasSelecionadas.map((item) => item?.id)
    ),
    caracteristicasTexto: caracteristicaEpi,
    cores: coresSelecionadas,
    coresIds: normalizeRelationIds(coresSelecionadas.map((item) => item?.id)),
    corMaterial: corMaterialTexto,
    coresTexto: corMaterialTexto,
    forceBaseCaDiff: payload.forceBaseCaDiff === true,
  }
}

function sanitizeDate(value) {
  if (!value) {
    return null
  }
  const raw = String(value).trim()
  if (!raw) {
    return null
  }
  const ddMmYyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddMmYyyy) {
    const [, dd, mm, yyyy] = ddMmYyyy
    return `${yyyy}-${mm}-${dd}`
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  if (isDateOnly) {
    return raw
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toISOString().slice(0, 10)
}

function buildDateFilters(query, field, inicio, fim) {
  if (inicio) {
    query = query.gte(field, inicio)
  }
  if (fim) {
    query = query.lte(field, fim)
  }
  return query
}

async function carregarMateriais() {
  const data = await execute(
    supabase
      .from('materiais_view')
      .select(MATERIAL_SELECT_COLUMNS)
      .order('nome', { ascending: true }),
    'Falha ao listar materiais.'
  )
  return (data ?? []).map(mapMaterialRecord)
}

async function carregarMateriaisDetalhados() {
  const data = await execute(
    supabase
      .from('materiais_view')
      .select(MATERIAL_SELECT_COLUMNS)
      .order('nome', { ascending: true }),
    'Falha ao listar materiais.'
  )
  return (data ?? []).map(mapMaterialRecord)
}

async function carregarMateriaisDeEntradas() {
  const data = await execute(
    supabase
      .from(ENTRADAS_MATERIAIS_VIEW)
      .select(MATERIAL_SELECT_COLUMNS)
      .order('materialItemNome', { ascending: true })
      .order('nome', { ascending: true }),
    'Falha ao listar materiais provenientes de entradas.'
  )
  return (data ?? []).map(mapMaterialRecord)
}

async function buscarMateriaisPorTermo(termo, limit = 10, options = {}) {
  const termoLimpo = trim(termo).replace(/\|/g, ' ')
  const termoNormalizado = termoLimpo.trim()
  if (!termoNormalizado) {
    return []
  }
  const termoUuid = normalizeUuid(termoNormalizado)
  const limiteSeguro = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(Number(limit), 50))
    : 10
  const sourceTable = options.source || 'materiais_view'
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
  let query = supabase.from(sourceTable).select(MATERIAL_SELECT_COLUMNS)
  if (termoUuid) {
    query = query.eq('id', termoUuid)
  } else {
    query = query.or(filtros.join(','))
  }
  if (options.centroEstoqueId && sourceTable === ENTRADAS_MATERIAIS_VIEW) {
    query = query.eq('centro_estoque', options.centroEstoqueId)
  }
  query = query.order('nome', { ascending: true }).order('fabricante', { ascending: true, nullsFirst: false }).limit(limiteSeguro)
  const data = await execute(query, 'Falha ao buscar materiais.')
  return (data ?? []).map(mapMaterialRecord)
}

async function carregarCentrosCusto() {
  const data = await execute(
    supabase.rpc('rpc_catalog_list', { p_table: 'centros_custo' }),
    'Falha ao listar centros de custo.'
  )
  return normalizeDomainOptions(data ?? [])
}

async function buscarCentrosEstoqueIdsPorTermo(valor) {
  const termo = trim(valor)
  if (!termo) {
    return []
  }
  try {
    const registros = await execute(
      supabase.rpc('rpc_catalog_list', { p_table: 'centros_estoque' }),
      'Falha ao consultar centros de estoque.'
    )
    const like = normalizeSearchTerm(termo)
    return (registros ?? [])
      .filter((item) => normalizeSearchTerm(item?.nome).includes(like))
      .map((item) => item?.id)
      .filter(Boolean)
  } catch (error) {
    reportClientError('Falha ao filtrar centros de estoque por nome.', error, { termo })
    return []
  }
}

async function carregarCentrosEstoqueCatalogo() {
  const data = await execute(
    supabase.rpc('rpc_catalog_list', { p_table: 'centros_estoque' }),
    'Falha ao listar centros de estoque.'
  )
  return dedupeDomainOptionsByName(normalizeDomainOptions(data ?? []))
}

async function carregarCentrosServico() {
  const data = await execute(
    supabase.rpc('rpc_catalog_list', { p_table: 'centros_servico' }),
    'Falha ao listar centros de servico.'
  )
  return dedupeDomainOptionsByName(normalizeDomainOptions(data ?? []))
}

async function carregarPessoas() {
  const data = await execute(
    buildPessoasViewQuery().order('nome', { ascending: true }),
    'Falha ao listar pessoas.'
  )
  const pessoas = (data ?? []).map(mapPessoaRecord)
  return pessoas
}

function normalizeMatriculaKey(value) {
  const texto = trim(value)
  return texto ? texto.toUpperCase() : ''
}

async function carregarEntradas(params = {}) {
  let query = supabase.from('entradas').select('*').order('dataEntrada', { ascending: false })

  if (params.materialId) {
    query = query.eq('materialId', params.materialId)
  }
  const centroFiltro = trim(params.centroEstoque || params.centroCusto)
  let centroFiltroTerm = ''
  if (centroFiltro) {
    if (isUuidValue(centroFiltro)) {
      query = query.eq('centro_estoque', centroFiltro)
    } else {
      const centroIds = await buscarCentrosEstoqueIdsPorTermo(centroFiltro)
      if (centroIds.length) {
        query = query.in('centro_estoque', centroIds)
      } else {
        centroFiltroTerm = normalizeSearchTerm(centroFiltro)
      }
    }
  }
  const registradoPor = trim(params.registradoPor)
  if (registradoPor) {
    query = isUuidValue(registradoPor)
      ? query.eq('usuarioResponsavel', registradoPor)
      : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
  }
  const statusFiltro = trim(params.status)
  if (statusFiltro) {
    if (isUuidValue(statusFiltro)) {
      query = query.eq('status', statusFiltro)
    } else {
      const statusId = await resolveStatusEntradaIdByName(statusFiltro)
      if (statusId) {
        query = query.eq('status', statusId)
      } else {
        query = query.ilike('status', `%${statusFiltro}%`)
      }
    }
  }

  const dataInicioIso = toStartOfDayUtcIso(params.dataInicio)
  const dataFimIso = toEndOfDayUtcIso(params.dataFim)
  if (dataInicioIso || dataFimIso) {
    query = buildDateFilters(query, 'dataEntrada', dataInicioIso, dataFimIso)
  } else {
    const periodo = resolvePeriodoRange(parsePeriodo(params))
    if (periodo?.start || periodo?.end) {
      query = buildDateFilters(query, 'dataEntrada', periodo?.start?.toISOString(), periodo?.end?.toISOString())
    }
  }

  const data = await execute(query, 'Falha ao listar entradas.')
  let registros = (data ?? []).map(mapEntradaRecord)
  registros = await preencherUsuariosResponsaveis(registros)
  registros = await preencherCentrosEstoque(registros)
  registros = await preencherStatusEntrada(registros)
  if (centroFiltroTerm) {
    registros = registros.filter((entrada) =>
      normalizeSearchTerm(entrada?.centroCusto).includes(centroFiltroTerm)
    )
  }

  const termo = trim(params.termo).toLowerCase()
  if (termo) {
    const materiais = await execute(
      supabase.from('materiais_view').select('id, nome, materialItemNome, fabricante'),
      'Falha ao listar materiais.'
    )
    const materiaisMap = new Map((materiais ?? []).map((material) => [material.id, material]))
    registros = registros.filter((entrada) => {
      const material = materiaisMap.get(entrada.materialId)
      const alvo = [
        material?.nome,
        material?.materialItemNome,
        material?.fabricante,
        material?.id,
        entrada.materialId,
        entrada.centroCusto,
        entrada.centroCustoId,
        entrada.usuarioResponsavel,
      ]
        .join(' ')
        .toLowerCase()
      return alvo.includes(termo)
    })
  }

  return registros
}
async function carregarStatusSaidaMap() {
  const agora = Date.now()
  if (statusSaidaCache && agora - statusSaidaCacheTimestamp < STATUS_SAIDA_CACHE_TTL) {
    return statusSaidaCache
  }
  const registros = await execute(
    supabase.from('status_saida').select('id, status').eq('ativo', true),
    'Falha ao consultar status de saida.'
  )
  const mapaId = new Map()
  const mapaNome = new Map()
  ;(registros ?? []).forEach((registro) => {
    if (!registro?.id) {
      return
    }
    const nome = resolveTextValue(registro.status ?? '')
    mapaId.set(registro.id, nome)
    const chave = normalizeStatusKey(nome)
    if (chave) {
      mapaNome.set(chave, registro.id)
      if (chave === normalizeStatusKey(STATUS_CANCELADO_NOME)) {
        statusCanceladoIds.add(registro.id)
      }
    }
  })
  statusSaidaCache = { byId: mapaId, byName: mapaNome }
  statusSaidaCacheTimestamp = agora
  return statusSaidaCache
}

async function preencherUsuariosResponsaveis(registros) {
  const ids = Array.from(
    new Set(
      registros
        .map((entrada) => [entrada.usuarioResponsavelId, entrada.usuarioEdicaoId])
        .flat()
        .filter(Boolean)
    )
  )
  if (!ids.length) {
    return registros.map((entrada) => ({
      ...entrada,
      usuarioResponsavelNome: entrada.usuarioResponsavel,
      usuarioEdicaoNome: entrada.usuarioEdicao,
    }))
  }
  try {
    const usuarios = await execute(
      supabase
        .from('app_users')
        .select('id, display_name, username, email')
        .in('id', ids),
      'Falha ao consultar usuarios.'
    )
    const resolveUsuarioNome = (usuario) =>
      resolveTextValue(usuario?.username ?? usuario?.display_name ?? usuario?.email ?? '')
    const mapa = new Map(
      (usuarios ?? []).map((usuario) => [
        usuario.id,
        resolveUsuarioNome(usuario),
      ])
    )
    return registros.map((entrada) => {
      const nome =
        entrada.usuarioResponsavelId && mapa.has(entrada.usuarioResponsavelId)
          ? mapa.get(entrada.usuarioResponsavelId)
          : entrada.usuarioResponsavel
      const nomeEdicao =
        entrada.usuarioEdicaoId && mapa.has(entrada.usuarioEdicaoId)
          ? mapa.get(entrada.usuarioEdicaoId)
          : entrada.usuarioEdicao
      return {
        ...entrada,
        usuarioResponsavelNome: nome || '',
        usuarioResponsavel: nome || entrada.usuarioResponsavel,
        usuarioEdicaoNome: nomeEdicao || '',
        usuarioEdicao: nomeEdicao || entrada.usuarioEdicao,
      }
    })
  } catch (error) {
    reportClientError('Falha ao resolver usuarios responsaveis.', error, { ids })
    return registros.map((entrada) => ({
      ...entrada,
      usuarioResponsavelNome: entrada.usuarioResponsavel,
      usuarioEdicaoNome: entrada.usuarioEdicao,
    }))
  }
}

const STATUS_SAIDA_CACHE_TTL = 5 * 60 * 1000
let statusSaidaCache = null
let statusSaidaCacheTimestamp = 0
const statusCanceladoIds = new Set()
const STATUS_ENTRADA_CACHE_TTL = 5 * 60 * 1000
let statusEntradaCache = null
let statusEntradaCacheTimestamp = 0

const normalizeStatusKey = (nome) => (nome ? nome.toString().trim().toUpperCase() : '')

async function preencherStatusSaida(registros = []) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return registros ?? []
  }
  const precisaResolver = registros.some((saida) => {
    if (saida?.statusId && isUuidValue(saida.statusId)) {
      return true
    }
    return saida?.status && isUuidValue(saida.status)
  })
  if (!precisaResolver) {
    return registros
  }
  try {
    const cache = await carregarStatusSaidaMap()
    const mapa = cache?.byId
    if (!mapa || mapa.size === 0) {
      return registros
    }
    return registros.map((saida) => {
      if (!saida) {
        return saida
      }
      const lookupId =
        (saida.statusId && isUuidValue(saida.statusId) ? saida.statusId : null) ||
        (saida.status && isUuidValue(saida.status) ? saida.status : null)
      if (!lookupId) {
        return saida
      }
      const label = mapa.get(lookupId) || saida.status
      if (!label) {
        return saida
      }
      return {
        ...saida,
        statusId: lookupId,
        statusNome: label,
        status: label,
      }
    })
  } catch (error) {
    reportClientError('Falha ao resolver status das saidas.', error)
    return registros
  }
}

async function carregarStatusEntradaMap() {
  const agora = Date.now()
  if (statusEntradaCache && agora - statusEntradaCacheTimestamp < STATUS_ENTRADA_CACHE_TTL) {
    return statusEntradaCache
  }
  const registros = await execute(
    supabase.from('status_entrada').select('id, status').eq('ativo', true),
    'Falha ao consultar status de entrada.',
  )
  const mapaId = new Map()
  const mapaNome = new Map()
  ;(registros ?? []).forEach((registro) => {
    if (!registro?.id) {
      return
    }
    const nome = resolveTextValue(registro.status ?? '')
    mapaId.set(registro.id, nome)
    const chave = normalizeStatusKey(nome)
    if (chave) {
      mapaNome.set(chave, registro.id)
    }
  })
  statusEntradaCache = { byId: mapaId, byName: mapaNome }
  statusEntradaCacheTimestamp = agora
  return statusEntradaCache
}

async function resolveStatusEntradaIdByName(nome) {
  const chave = normalizeStatusKey(nome)
  if (!chave) {
    return null
  }
  const cache = await carregarStatusEntradaMap()
  const mapa = cache?.byName
  if (!mapa || mapa.size === 0) {
    return null
  }
  return mapa.get(chave) || null
}

async function preencherStatusEntrada(registros = []) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return registros ?? []
  }
  const precisaResolver = registros.some((entrada) => {
    if (entrada?.statusId && isUuidValue(entrada.statusId)) {
      return true
    }
    return entrada?.status && isUuidValue(entrada.status)
  })
  if (!precisaResolver) {
    return registros
  }
  try {
    const cache = await carregarStatusEntradaMap()
    const mapa = cache?.byId
    if (!mapa || mapa.size === 0) {
      return registros
    }
    return registros.map((entrada) => {
      if (!entrada) {
        return entrada
      }
      const lookupId =
        (entrada.statusId && isUuidValue(entrada.statusId) ? entrada.statusId : null) ||
        (entrada.status && isUuidValue(entrada.status) ? entrada.status : null)
      if (!lookupId) {
        return entrada
      }
      const label = mapa.get(lookupId) || entrada.status
      return {
        ...entrada,
        statusId: lookupId,
        status: label || lookupId,
        statusNome: label || lookupId,
      }
    })
  } catch (error) {
    reportClientError('Falha ao resolver status de entrada.', error)
    return registros
  }
}

async function resolveStatusSaidaIdByName(nome) {
  const chave = normalizeStatusKey(nome)
  if (!chave) {
    return null
  }
  const cache = await carregarStatusSaidaMap()
  return cache?.byName?.get(chave) ?? null
}

async function ensureStatusCanceladoIdLoaded() {
  if (statusCanceladoIds.size > 0) {
    return
  }
  const cancelId = await resolveStatusSaidaIdByName(STATUS_CANCELADO_NOME)
  if (cancelId) {
    statusCanceladoIds.add(cancelId)
  }
}

const normalizeStatusValue = (value) => (value ? value.toString().trim().toLowerCase() : '')

function isSaidaCanceladaSync(saida) {
  const texto = normalizeStatusValue(saida?.status)
  if (texto === 'cancelado') {
    return true
  }
  const statusId = (saida?.statusId ?? '').toString()
  if (statusId && statusCanceladoIds.has(statusId)) {
    return true
  }
  return false
}

async function preencherCentrosEstoque(registros = []) {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((entrada) => entrada.centroCustoId)
        .filter((valor) => Boolean(valor) && isUuidValue(valor))
    )
  )
  if (!ids.length) {
    return registros
  }
  try {
    const centros = await execute(
      supabase.from(CENTRO_ESTOQUE_TABLE).select('id, almox').in('id', ids),
      'Falha ao consultar centros de estoque.'
    )
    const mapa = new Map(
      (centros ?? [])
        .map((centro) => [centro.id, resolveTextValue(centro.almox ?? '')])
        .filter(([, nome]) => Boolean(nome))
    )
    if (!mapa.size) {
      return registros
    }
    return registros.map((entrada) => {
      if (!entrada.centroCustoId) {
        return entrada
      }
        const nome = mapa.get(entrada.centroCustoId)
        if (!nome) {
          return entrada
        }
        return {
          ...entrada,
          centroCustoNome: nome,
          centroCusto: nome,
        }
    })
  } catch (error) {
    reportClientError('Falha ao resolver centros de estoque.', error, { ids })
    return registros
  }
}

async function preencherCentrosCustoSaidas(registros = []) {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((saida) => saida.centroCustoId)
        .filter((valor) => Boolean(valor) && isUuidValue(valor))
    )
  )
  if (!ids.length) {
    return registros
  }
  try {
    const centros = await execute(
      supabase.from(CENTROS_CUSTO_TABLE).select('id, nome').in('id', ids),
      'Falha ao consultar centros de custo.'
    )
    const mapa = new Map(
      (centros ?? [])
        .map((centro) => [centro.id, resolveTextValue(centro.nome ?? '')])
        .filter(([, nome]) => Boolean(nome))
    )
    if (!mapa.size) {
      return registros
    }
    return registros.map((saida) => {
      if (!saida.centroCustoId) {
        return saida
      }
      const nome = mapa.get(saida.centroCustoId)
      if (!nome) {
        return saida
      }
      return {
        ...saida,
        centroCustoNome: nome,
        centroCusto: nome,
      }
    })
  } catch (error) {
    reportClientError('Falha ao resolver centros de custo.', error, { ids })
    return registros
  }
}

function toAsciiLower(value) {
  if (value === undefined || value === null) {
    return ''
  }
  let texto = String(value)
  if (typeof texto.normalize === 'function') {
    texto = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  return texto.toLowerCase()
}

function precisaResolverCentroServico(saida) {
  if (!saida) {
    return false
  }
  const texto = resolveTextValue(saida.centroServico ?? '')
  if (!texto) {
    return true
  }
  if (isUuidValue(texto)) {
    return true
  }
  return toAsciiLower(texto) === 'nao informado'
}

async function preencherCentrosServicoSaidas(registros = []) {
  const lista = Array.isArray(registros) ? registros : []
  const pessoaIds = Array.from(new Set(lista.map((saida) => saida.pessoaId).filter(Boolean)))
  if (!pessoaIds.length) {
    return lista
  }
  try {
    const detalhes = await carregarPessoasViewDetalhes(pessoaIds)
    if (!detalhes.size) {
      return lista
    }
    return lista.map((saida) => {
      const detalhe = detalhes.get(saida.pessoaId)
      if (!detalhe) {
        return saida
      }
      const precisaResolver = precisaResolverCentroServico(saida)
      const centroNome = resolveTextValue(detalhe.centroServico ?? detalhe.local ?? detalhe.setor ?? '')
      const setorNome = resolveTextValue(detalhe.setor ?? detalhe.centroServico ?? detalhe.local ?? '')
      const localNome = resolveTextValue(detalhe.local ?? detalhe.centroServico ?? setorNome ?? '')
      return {
        ...saida,
        centroServico: precisaResolver ? centroNome || saida.centroServico : saida.centroServico || centroNome,
        centroServicoId: saida.centroServicoId || detalhe.centroServicoId || null,
        setor: precisaResolver ? setorNome || saida.setor || centroNome : saida.setor || setorNome || centroNome,
        setorId: saida.setorId || detalhe.setorId || null,
        local: precisaResolver ? localNome || saida.local || centroNome || setorNome || '' : saida.local || localNome || centroNome || setorNome || '',
        pessoaNome: detalhe.nome || saida.pessoaNome || '',
        pessoaMatricula: detalhe.matricula || saida.pessoaMatricula || '',
        pessoa: saida.pessoa || detalhe,
      }
    })
  } catch (error) {
    reportClientError('Nao foi possivel resolver centros de servico das saidas.', error, {
      pessoaIds,
    })
    return lista
  }
}

async function carregarSaidas(params = {}) {
  let query = supabase
    .from('saidas')
    .select('*, status_rel:status_saida ( id, status )')
    .order('dataEntrega', { ascending: false })

  if (params.materialId) {
    query = query.eq('materialId', params.materialId)
  }
  if (params.pessoaId) {
    query = query.eq('pessoaId', params.pessoaId)
  }
  const statusFiltro = trim(params.status)
  if (statusFiltro) {
    let statusId = null
    if (isUuidValue(statusFiltro)) {
      statusId = statusFiltro
    } else {
      try {
        statusId = await resolveStatusSaidaIdByName(statusFiltro)
      } catch (error) {
        reportClientError('Falha ao resolver status de saida para filtro.', error, { statusFiltro })
      }
    }
    if (statusId) {
      query = query.eq('status', statusId)
    } else {
      query = query.ilike('status_rel.status', `%${statusFiltro}%`)
    }
  }

  const registradoPor = trim(params.registradoPor)
  if (registradoPor) {
    query = isUuidValue(registradoPor)
      ? query.eq('usuarioResponsavel', registradoPor)
      : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
  }

  const centroEstoqueFiltro = trim(params.centroEstoque || params.centro_estoque)
  if (centroEstoqueFiltro) {
    if (isUuidValue(centroEstoqueFiltro)) {
      query = query.eq('centro_estoque', centroEstoqueFiltro)
    } else {
      query = query.ilike('centro_estoque', `%${centroEstoqueFiltro}%`)
    }
  }

  const centroCustoFiltro = trim(params.centroCusto)
  if (centroCustoFiltro) {
    query = isUuidValue(centroCustoFiltro)
      ? query.eq('centro_custo', centroCustoFiltro)
      : query.ilike('centro_custo', `%${centroCustoFiltro}%`)
  }

  const centroServicoFiltro = trim(params.centroServico)
  if (centroServicoFiltro) {
    query = isUuidValue(centroServicoFiltro)
      ? query.eq('centro_servico', centroServicoFiltro)
      : query.ilike('centro_servico', `%${centroServicoFiltro}%`)
  }

  const dataInicioIso = toStartOfDayUtcIso(params.dataInicio)
  const dataFimIso = toEndOfDayUtcIso(params.dataFim)
  if (dataInicioIso || dataFimIso) {
    query = buildDateFilters(query, 'dataEntrega', dataInicioIso, dataFimIso)
  } else {
    const periodo = resolvePeriodoRange(parsePeriodo(params))
    if (periodo?.start || periodo?.end) {
      query = buildDateFilters(query, 'dataEntrega', periodo?.start?.toISOString(), periodo?.end?.toISOString())
    }
  }

  const data = await execute(query, 'Falha ao listar saidas.')
  let registros = (data ?? []).map(mapSaidaRecord)
  registros = await preencherUsuariosResponsaveis(registros)
  registros = await preencherStatusSaida(registros)
  registros = await preencherCentrosCustoSaidas(registros)
  registros = await preencherCentrosServicoSaidas(registros)

  const termo = trim(params.termo).toLowerCase()
  if (termo) {
    const [pessoasRaw, materiaisRaw] = await Promise.all([
      execute(
        supabase
          .from('pessoas')
          .select(
            `
              id,
              nome,
              matricula,
              centro_servico_id,
              setor_id,
              cargo_id,
              centro_custo_id,
              tipo_execucao_id
            `
          ),
        'Falha ao listar pessoas.'
      ),
      execute(
        supabase
          .from('materiais_view')
        .select('id, nome, fabricante'),
        'Falha ao listar materiais.'
      ),
    ])
    const pessoasMap = new Map((pessoasRaw ?? []).map((pessoa) => [pessoa.id, mapPessoaRecord(pessoa)]))
    const materiaisMap = new Map((materiaisRaw ?? []).map((material) => [material.id, mapMaterialRecord(material)]))
    registros = registros.filter((saida) => {
      const pessoa = pessoasMap.get(saida.pessoaId)
      const material = materiaisMap.get(saida.materialId)
      const materialResumo = material ? buildMaterialResumo(material) : ''
      const alvo = [
        materialResumo,
        material?.nome ?? '',
        material?.materialItemNome ?? '',
        material?.id ?? '',
        saida.materialId ?? '',
        pessoa?.nome ?? '',
        pessoa?.cargo ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return alvo.includes(termo)
    })
  }

  return registros
}

async function carregarAcidentes() {
  const data = await execute(
    supabase.from('vw_acidentes').select('*').order('data', { ascending: false }),
    'Falha ao listar acidentes.'
  )
  return (data ?? []).map(mapAcidenteRecord)
}

const mapDashboardFromView = (registro, periodoInicio, periodoFim) => {
  const { inicio, fim } = normalizePeriodoRange(periodoInicio, periodoFim)

  const tendenciaOrdenada = parseJsonArray(registro?.tendencia)
    .map((item) => ({
      ...item,
      periodo: sanitizeMonthRef(item?.periodo) || item?.periodo || null,
      total_acidentes: toNumber(item?.total_acidentes, 0),
      dias_perdidos: toNumber(item?.dias_perdidos, 0),
      dias_debitados: toNumber(item?.dias_debitados, 0),
      hht_total: toNumber(item?.hht_total, 0),
      taxa_frequencia: toNumber(item?.taxa_frequencia, 0),
      taxa_gravidade: toNumber(item?.taxa_gravidade, 0),
    }))
    .filter((item) => item?.periodo)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))

  const tendenciaFiltrada = tendenciaOrdenada.filter((item) => isPeriodoWithinRange(item.periodo, inicio, fim))
  const tendenciaAplicada = tendenciaFiltrada.length ? tendenciaFiltrada : tendenciaOrdenada

  const totais = tendenciaAplicada.reduce(
    (acc, item) => {
      acc.total_acidentes += toNumber(item.total_acidentes, 0)
      acc.dias_perdidos += toNumber(item.dias_perdidos, 0)
      acc.dias_debitados += toNumber(item.dias_debitados, 0)
      acc.hht_total += toNumber(item.hht_total, 0)
      return acc
    },
    { total_acidentes: 0, dias_perdidos: 0, dias_debitados: 0, hht_total: 0 }
  )

  const resumoBase = parseJsonObject(registro?.resumo)
  const hhtTotal = toNumber(totais.hht_total, 0)
  const tf = hhtTotal > 0 ? Number(((toNumber(totais.total_acidentes, 0) * 1000000) / hhtTotal).toFixed(2)) : 0
  const tgBase =
    hhtTotal > 0
      ? Number(
          (((toNumber(totais.dias_perdidos, 0) + toNumber(totais.dias_debitados, 0)) * 1000000) / hhtTotal).toFixed(2)
        )
      : 0

  const periodoInicioLabel = inicio || tendenciaAplicada[0]?.periodo || null
  const periodoFimLabel = fim || tendenciaAplicada[tendenciaAplicada.length - 1]?.periodo || periodoInicioLabel || null

  const resumo = {
    ...resumoBase,
    periodo: resumoBase?.periodo ?? periodoInicioLabel,
    periodo_label: formatPeriodoLabel(periodoInicioLabel, periodoFimLabel),
    periodo_referencia: formatPeriodoLabel(periodoInicioLabel, periodoFimLabel),
    referencia: formatPeriodoLabel(periodoInicioLabel, periodoFimLabel),
    total_acidentes: toNumber(totais.total_acidentes, 0),
    total_acidentes_afastamento: toNumber(resumoBase?.total_acidentes_afastamento, 0),
    total_acidentes_sem_afastamento: toNumber(resumoBase?.total_acidentes_sem_afastamento, 0),
    dias_perdidos: toNumber(totais.dias_perdidos, 0),
    dias_debitados: toNumber(totais.dias_debitados, 0),
    hht_total: hhtTotal,
    taxa_frequencia: tf,
    taxa_frequencia_afastamento: resumoBase?.taxa_frequencia_afastamento ?? tf,
    taxa_frequencia_sem_afastamento: resumoBase?.taxa_frequencia_sem_afastamento ?? tf,
    taxa_gravidade: resumoBase?.taxa_gravidade ?? tgBase,
    indice_acidentados: resumoBase?.indice_acidentados ?? Number(((tf + tgBase) / 100).toFixed(2)),
    indice_avaliacao_gravidade:
      resumoBase?.indice_avaliacao_gravidade ??
      (toNumber(resumoBase?.total_acidentes_afastamento, 0) > 0
        ? Number(
            (
              (toNumber(totais.dias_perdidos, 0) + toNumber(totais.dias_debitados, 0)) /
              toNumber(resumoBase?.total_acidentes_afastamento, 0)
            ).toFixed(2)
          )
        : 0),
    total_trabalhadores: toNumber(resumoBase?.total_trabalhadores, 0),
    indice_relativo_acidentes:
      resumoBase?.indice_relativo_acidentes ??
      (toNumber(resumoBase?.total_trabalhadores, 0) > 0
        ? Number(
            (
              toNumber(resumoBase?.total_acidentes_afastamento ?? totais.total_acidentes, 0) *
              1000 /
              toNumber(resumoBase?.total_trabalhadores, 0)
            ).toFixed(2)
          )
        : 0),
  }

  const tipos = parseJsonArray(registro?.tipos)
  const partesLesionadas = parseJsonArray(registro?.partes_lesionadas)
  const lesoes = parseJsonArray(registro?.lesoes)
  const cargos = parseJsonArray(registro?.cargos)
  const agentes = parseJsonArray(registro?.agentes)
  const pessoasPorCentro = parseJsonArray(registro?.pessoas_por_centro)

  const options = {
    centrosServico: extractOptionValues(pessoasPorCentro, 'centro_servico'),
    tipos: extractOptionValues(tipos, 'tipo'),
    lesoes: extractOptionValues(lesoes, 'lesao'),
    partesLesionadas: extractOptionValues(partesLesionadas, 'parte_lesionada'),
    agentes: extractOptionValues(agentes, 'agente'),
    cargos: extractOptionValues(cargos, 'cargo'),
  }

  return {
    resumo,
    tendencia: tendenciaAplicada,
    tipos,
    partesLesionadas,
    lesoes,
    cargos,
    agentes,
    options,
  }
}


async function calcularSaldoMaterialAtual(materialId, centroEstoqueId = null) {
  await ensureStatusCanceladoIdLoaded()
  const [entradas, saidas] = await Promise.all([
    (() => {
      let query = supabase
        .from('entradas')
        .select('materialId, quantidade, dataEntrada, centro_estoque, status, status_rel:status_entrada ( id, status )')
      query = query.eq('materialId', materialId)
      if (centroEstoqueId) {
        query = query.eq('centro_estoque', centroEstoqueId)
      }
      return execute(query, 'Falha ao consultar entradas.')
    })(),
    (() => {
      let query = supabase
        .from('saidas')
        .select(
          'materialId, quantidade, dataEntrega, status, centro_estoque, centro_custo, status_rel:status_saida ( id, status )'
        )
        .eq('materialId', materialId)
      if (centroEstoqueId) {
        query = query.or(`centro_estoque.eq.${centroEstoqueId},centro_custo.eq.${centroEstoqueId}`)
      }
      return execute(query, 'Falha ao consultar saidas.')
    })(),
  ])

  const entradasNormalizadas = (entradas ?? []).map(mapEntradaRecord)
  const saidasNormalizadas = (saidas ?? [])
    .map(mapSaidaRecord)
    .filter((saida) => !isSaidaCanceladaSync(saida))
  return calcularSaldoMaterial(materialId, entradasNormalizadas, saidasNormalizadas, null)
}

async function obterSaldoMaterial(materialId) {
  if (!materialId) {
    throw new Error('Material invalido.')
  }
  const saldo = await calcularSaldoMaterialAtual(materialId)
  return { materialId, saldo }
}

function montarContextoTermoEpi(pessoa, saidasDetalhadas) {
  const entregasOrdenadas = saidasDetalhadas
    .slice()
    .sort((a, b) => {
      const aTime = a.dataEntrega ? new Date(a.dataEntrega).getTime() : 0
      const bTime = b.dataEntrega ? new Date(b.dataEntrega).getTime() : 0
      return aTime - bTime
    })

  const entregas = entregasOrdenadas.map((saida, index) => ({
    ordem: index + 1,
    id: saida.id,
    dataEntrega: saida.dataEntrega ?? null,
    quantidade: Number(saida.quantidade ?? 0),
    descricao: saida.material ? buildMaterialResumo(saida.material) : '',
    numeroCa: saida.material?.ca ?? '',
    centroCusto: saida.centroCusto ?? '',
    centroServico: saida.centroServico ?? '',
    status: saida.status ?? '',
    usuarioResponsavel: saida.usuarioResponsavelNome || saida.usuarioResponsavel || '',
    dataTroca: saida.dataTroca ?? null,
  }))

  const totalItens = entregas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
  const ultimaEntrega = entregasOrdenadas.length
    ? entregasOrdenadas[entregasOrdenadas.length - 1].dataEntrega ?? null
    : null

  return {
    colaborador: {
      id: pessoa.id,
      nome: pessoa.nome ?? '',
      matricula: pessoa.matricula ?? '',
      cargo: pessoa.cargo ?? '',
      centroServico: pessoa.centroServico ?? '',
      unidade: pessoa.centroServico ?? '',
      dataAdmissao: pessoa.dataAdmissao ?? null,
      tipoExecucao: pessoa.tipoExecucao ?? '',
      usuarioCadastro: pessoa.usuarioCadastro ?? '',
      usuarioEdicao: pessoa.usuarioEdicao ?? '',
      criadoEm: pessoa.criadoEm ?? null,
      atualizadoEm: pessoa.atualizadoEm ?? null,
    },
    entregas,
    totais: {
      quantidadeEntregas: entregas.length,
      totalItensEntregues: totalItens,
      ultimaEntrega,
    },
  }
}

export const api = {
  async health() {
    await execute(
      supabase.from('materiais_view').select('id', { head: true, count: 'exact' }).limit(1),
      'Falha ao verificar status do Supabase.'
    )
    return { status: 'ok' }
  },
  pessoas: {
    async list(params = {}) {
      const ownerScope = await resolvePessoasOwnerScope()
      if (
        !ownerScope.isMaster &&
        ownerScope.strict &&
        (!ownerScope.centroServicoIds || ownerScope.centroServicoIds.length === 0)
      ) {
        return []
      }
      const filtros = {
        centroServicoId: null,
        setorId: null,
        cargoId: null,
        tipoExecucaoId: null,
        ativo: null,
        cadastradoInicio: null,
        cadastradoFim: null,
      }

      const centroServico = trim(params.centroServico ?? params.local ?? '')
      if (centroServico && centroServico.toLowerCase() !== 'todos') {
        filtros.centroServicoId = await resolveReferenceId('centros_servico', centroServico, 'Centro de servico invalido para filtro.')
      }

      const setor = trim(params.setor ?? '')
      if (setor && setor.toLowerCase() !== 'todos') {
        filtros.setorId = await resolveReferenceId('setores', setor, 'Setor invalido para filtro.')
      }

      const cargo = trim(params.cargo ?? '')
      if (cargo && cargo.toLowerCase() !== 'todos') {
        filtros.cargoId = await resolveReferenceId('cargos', cargo, 'Cargo invalido para filtro.')
      }

      const tipoExecucaoFiltro = trim(params.tipoExecucao ?? '')
      if (tipoExecucaoFiltro && tipoExecucaoFiltro.toLowerCase() !== 'todos') {
        filtros.tipoExecucaoId = await resolveReferenceId(
          'tipo_execucao',
          tipoExecucaoFiltro.toUpperCase(),
          'Tipo de execucao invalido para filtro.'
        )
      }

      const statusFiltro = trim(params.status ?? '')
      if (statusFiltro) {
        const statusLower = statusFiltro.toLowerCase()
        if (statusLower === 'ativo') filtros.ativo = true
        else if (statusLower === 'inativo') filtros.ativo = false
      }

      const cadastradoInicio = sanitizeDate(params.cadastradoInicio)
      const cadastradoFim = sanitizeDate(params.cadastradoFim)
      filtros.cadastradoInicio = cadastradoInicio ? `${cadastradoInicio}T00:00:00` : null
      filtros.cadastradoFim = cadastradoFim ? `${cadastradoFim}T23:59:59.999` : null

      const termo = trim(params.termo)

      const buildQuery = () => {
        let builder = buildPessoasViewQuery().order('nome', { ascending: true })

        if (!ownerScope.isMaster && ownerScope.centroServicoIds?.length) {
          builder = builder.in('centro_servico_id', ownerScope.centroServicoIds)
        }
        if (filtros.centroServicoId) {
          builder = builder.eq('centro_servico_id', filtros.centroServicoId)
        }
        if (filtros.setorId) {
          builder = builder.eq('setor_id', filtros.setorId)
        }
        if (filtros.cargoId) {
          builder = builder.eq('cargo_id', filtros.cargoId)
        }
        if (filtros.tipoExecucaoId) {
          builder = builder.eq('tipo_execucao_id', filtros.tipoExecucaoId)
        }
        if (filtros.ativo !== null) {
          builder = builder.eq('ativo', filtros.ativo)
        }
        if (filtros.cadastradoInicio) {
          builder = builder.gte('criadoEm', filtros.cadastradoInicio)
        }
        if (filtros.cadastradoFim) {
          builder = builder.lte('criadoEm', filtros.cadastradoFim)
        }
        return builder
      }

      try {
        const buildFilteredQuery = () => {
          let query = buildQuery()
          if (termo) {
            const like = `%${termo}%`
            query = applyPessoaSearchFilters(query, like)
          }
          return query
        }
        const data = await executePaged(buildFilteredQuery, 'Falha ao listar pessoas.')
        let registros = (data ?? []).map(mapPessoaRecord)
        if ((!registros || registros.length === 0) && !termo) {
          const fallbackDados = await executePaged(
            () =>
              supabase.from('pessoas_view').select(PESSOAS_VIEW_SELECT).order('nome', { ascending: true }),
            'Falha ao listar pessoas (fallback view).'
          )
          registros = (fallbackDados ?? []).map(mapPessoaRecord)
        }
        return registros
      } catch (error) {
        if (!termo) {
          throw error
        }
        reportClientError('Erro ao aplicar filtro remoto por termo em pessoas, usando filtro local.', error, {
          termo,
        })
        const fallbackData = await executePaged(buildQuery, 'Falha ao listar pessoas.')
        const registros = (fallbackData ?? []).map(mapPessoaRecord)
        return registros.filter((pessoa) => pessoaMatchesSearch(pessoa, termo))
      }
    },
    async listByIds(ids = [], options = {}) {
      const { includeInactive = false } = options
      const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)))
      if (!uniqueIds.length) {
        return []
      }
      const ownerScope = await resolvePessoasOwnerScope()
      if (
        !ownerScope.isMaster &&
        ownerScope.strict &&
        (!ownerScope.centroServicoIds || ownerScope.centroServicoIds.length === 0)
      ) {
        return []
      }
      let query = buildPessoasViewQuery().in('id', uniqueIds)
      if (!ownerScope.isMaster && ownerScope.centroServicoIds?.length) {
        query = query.in('centro_servico_id', ownerScope.centroServicoIds)
      }
      // Filtrar apenas pessoas ativas por padrão (regra centralizada)
      if (!includeInactive) {
        query = query.eq('ativo', true)
      }
      const data = await execute(
        buildPessoasViewQuery().in('id', uniqueIds),
        'Falha ao listar pessoas pelos ids informados.'
      )
      return (data ?? []).map(mapPessoaRecord)
    },
    async search(params = {}) {
      const termo = trim(params.termo ?? params.q ?? params.query ?? '')
      const limit = Number(params.limit ?? 10) || 10
      const includeInactive = Boolean(params.includeInactive)
      if (!termo) {
        return []
      }
      const ownerScope = await resolvePessoasOwnerScope()
      if (
        !ownerScope.isMaster &&
        ownerScope.strict &&
        (!ownerScope.centroServicoIds || ownerScope.centroServicoIds.length === 0)
      ) {
        return []
      }
      const like = `%${termo}%`
      try {
        let query = buildPessoasViewQuery().order('nome')
        if (!ownerScope.isMaster && ownerScope.centroServicoIds?.length) {
          query = query.in('centro_servico_id', ownerScope.centroServicoIds)
        }
        // Filtrar apenas pessoas ativas por padrão (regra centralizada)
        if (!includeInactive) {
          query = query.eq('ativo', true)
        }
        query = applyPessoaSearchFilters(query, like).limit(limit)
        const data = await execute(query, 'Falha ao buscar pessoas.')
        return (data ?? []).map(mapPessoaRecord)
      } catch (error) {
        reportClientError('Busca remota de pessoas falhou, tentando fallback local.', error, {
          termo,
          limit,
        })
        let fallbackQuery = buildPessoasViewQuery().order('nome')
        if (!ownerScope.isMaster && ownerScope.centroServicoIds?.length) {
          fallbackQuery = fallbackQuery.in('centro_servico_id', ownerScope.centroServicoIds)
        }
        // Aplicar filtro de ativo também no fallback
        if (!includeInactive) {
          fallbackQuery = fallbackQuery.eq('ativo', true)
        }
        const todos = await execute(fallbackQuery, 'Falha ao listar pessoas.')
        const lista = (todos ?? []).map(mapPessoaRecord)
        return lista.filter((pessoa) => pessoaMatchesSearch(pessoa, termo)).slice(0, limit)
      }
    },
    async resumo() {
      const data = await execute(
        supabase.rpc('rpc_pessoas_resumo'),
        'Falha ao obter resumo de pessoas.'
      )
      const registro = Array.isArray(data) ? data[0] : data ?? {}
      const totalGeralBruto = registro.total_geral ?? registro.totalGeral ?? 0
      const totalGeral = Number(totalGeralBruto) || 0
      const porCentro = Array.isArray(registro.por_centro ?? registro.porCentro)
        ? (registro.por_centro ?? registro.porCentro)
        : []
      const porSetor = Array.isArray(registro.por_setor ?? registro.porSetor)
        ? (registro.por_setor ?? registro.porSetor)
        : []
      return { totalGeral, porCentro, porSetor }
    },
    async create(payload) {
      const dados = sanitizePessoaPayload(payload)
      if (!dados.nome || !dados.matricula || !dados.centroServico || !dados.setor || !dados.cargo) {
        throw new Error('Preencha nome, matricula, centro de servico, setor e cargo.')
      }

      const usuarioId = await resolveUsuarioId()
      if (!usuarioId) {
        throw new Error('Sessao invalida, usuario nao identificado.')
      }
      const referencias = await resolvePessoaReferencias(dados)
      if (!dados.dataAdmissao) {
        throw new Error('Informe a data de admissao no formato dd/MM/yyyy.')
      }
      let effective = null
      try {
        effective = typeof resolveEffectiveAppUser === 'function' ? await resolveEffectiveAppUser(usuarioId) : null
      } catch (err) {
        reportClientError('Falha ao resolver account_owner_id; prosseguindo sem owner.', err, { usuarioId })
        effective = null
      }

      const preflight = await executeMaybeSingle(
        supabase.rpc('pessoas_preflight_check', {
          p_owner: resolvePreflightOwnerId(effective),
          p_nome: dados.nome,
          p_matricula: dados.matricula,
          p_pessoa_id: null,
        }),
        'Falha no preflight de pessoa.'
      )
      if (preflight?.matricula_conflict) {
        const err = new Error('Ja existe pessoa com esta matricula.')
        err.code = 'PESSOA_MATRICULA_DUP'
        throw err
      }
      if (preflight?.nome_conflict && !dados.forceNomeConflict) {
        const err = new Error('PESSOA_NOME_CONFLITO')
        err.code = 'PESSOA_NOME_CONFLITO'
        err.details = preflight?.conflict_ids || []
        throw err
      }

      const registro = await executeSingle(
        supabase.rpc('rpc_pessoas_create_full', {
          p_nome: dados.nome,
          p_matricula: dados.matricula,
          p_observacao: dados.observacao,
          p_data_admissao: dados.dataAdmissao,
          p_data_demissao: dados.dataDemissao,
          p_centro_servico_id: referencias.centroServicoId,
          p_setor_id: referencias.setorId,
          p_cargo_id: referencias.cargoId,
          p_centro_custo_id: referencias.centroCustoId,
          p_tipo_execucao_id: referencias.tipoExecucaoId,
          p_ativo: dados.ativo !== false,
          p_usuario_id: usuarioId,
        }),
        'Falha ao criar pessoa.'
      )

      return mapPessoaRecord(registro)
    },

    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }

      const atualRaw = await executeSingle(
        supabase
          .from('pessoas')
          .select(`
            id,
            nome,
            matricula,
            observacao,
            "dataAdmissao",
            "dataDemissao",
            "usuarioCadastro",
            "usuarioEdicao",
            "criadoEm",
            "atualizadoEm",
            ativo,
            centro_servico_id,
            setor_id,
            cargo_id,
            centro_custo_id,
            tipo_execucao_id
          `)
          .eq('id', id),
        'Falha ao obter pessoa.'
      )
      if (!atualRaw) {
        throw new Error('Pessoa nao encontrada.')
      }

      const atual = mapPessoaRecord(atualRaw)
      const dados = sanitizePessoaPayload(payload)
      const usuarioId = await resolveUsuarioIdOrThrow()
      let effective = null
      try {
        effective = typeof resolveEffectiveAppUser === 'function' ? await resolveEffectiveAppUser(usuarioId) : null
      } catch (err) {
        reportClientError('Falha ao resolver account_owner_id; prosseguindo sem owner.', err, { usuarioId })
        effective = null
      }
      if (!dados.dataAdmissao) {
        throw new Error('Informe a data de admissao no formato dd/MM/yyyy.')
      }

      const normalizeDateValue = (value) => {
        if (!value) {
          return null
        }
        const raw = String(value).trim()
        if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) {
          return raw
        }
        const date = new Date(raw)
        if (Number.isNaN(date.getTime())) {
          return null
        }
        return date.toISOString().slice(0, 10)
      }

      const camposAlterados = []
      ;['nome', 'matricula', 'centroServico', 'setor', 'cargo', 'tipoExecucao', 'dataAdmissao', 'dataDemissao', 'observacao', 'ativo'].forEach((campo) => {
        const valorAtual =
          campo === 'dataAdmissao' || campo === 'dataDemissao'
            ? normalizeDateValue(atual[campo])
            : campo === 'ativo'
            ? (atual.ativo !== false ? 'Ativo' : 'Inativo')
            : resolveTextValue(atual[campo] ?? '')
        const valorNovo =
          campo === 'dataAdmissao' || campo === 'dataDemissao'
            ? normalizeDateValue(dados[campo])
            : campo === 'ativo'
            ? (dados.ativo !== false ? 'Ativo' : 'Inativo')
            : resolveTextValue(dados[campo] ?? '')
        if (valorAtual !== valorNovo) {
          camposAlterados.push({
            campo,
            de: valorAtual ?? '',
            para: valorNovo ?? '',
          })
        }
      })

      const referencias = await resolvePessoaReferencias(dados)

      const preflight = await executeMaybeSingle(
        supabase.rpc('pessoas_preflight_check', {
          p_owner: resolvePreflightOwnerId(effective),
          p_nome: dados.nome,
          p_matricula: dados.matricula,
          p_pessoa_id: id,
        }),
        'Falha no preflight de pessoa.'
      )
      if (preflight?.matricula_conflict) {
        const err = new Error('Ja existe pessoa com esta matricula.')
        err.code = 'PESSOA_MATRICULA_DUP'
        throw err
      }
      if (preflight?.nome_conflict && !dados.forceNomeConflict) {
        const err = new Error('PESSOA_NOME_CONFLITO')
        err.code = 'PESSOA_NOME_CONFLITO'
        err.details = preflight?.conflict_ids || []
        throw err
      }

      const registro = await executeSingle(
        supabase.rpc('rpc_pessoas_update_full', {
          p_id: id,
          p_nome: dados.nome,
          p_matricula: dados.matricula,
          p_observacao: dados.observacao,
          p_data_admissao: dados.dataAdmissao,
          p_data_demissao: dados.dataDemissao,
          p_centro_servico_id: referencias.centroServicoId,
          p_setor_id: referencias.setorId,
          p_cargo_id: referencias.cargoId,
          p_centro_custo_id: referencias.centroCustoId,
          p_tipo_execucao_id: referencias.tipoExecucaoId,
          p_ativo: dados.ativo !== false,
          p_usuario_id: usuarioId,
          p_campos_alterados: camposAlterados,
        }),
        'Falha ao atualizar pessoa.'
      )

      return mapPessoaRecord(registro)
    },
    async get(id) {
      const pessoa = await executeSingle(
        supabase.from('pessoas').select('*').eq('id', id),
        'Falha ao obter pessoa.'
      )
      return mapPessoaRecord(pessoa)
    },
    async history(id) {
      const registros = await execute(
        supabase
          .from('pessoas_historico')
          .select('id, data_edicao, usuario_responsavel, campos_alterados')
          .eq('pessoa_id', id)
          .order('data_edicao', { ascending: true }),
        'Falha ao obter historico.'
      )
      const lista = registros ?? []
      const responsaveisBrutos = lista
        .map((item) => (item.usuario_responsavel ?? item.usuarioResponsavel ?? '').trim())
        .filter(Boolean)
      const responsaveisIds = Array.from(new Set(responsaveisBrutos.filter((valor) => isUuidValue(valor))))
      const responsaveisEmails = Array.from(new Set(responsaveisBrutos.filter((valor) => valor.includes('@'))))
      let usuarioNomeMap = new Map()
      if (responsaveisIds.length || responsaveisEmails.length) {
        const consultas = []
        if (responsaveisIds.length) {
          consultas.push(
            execute(
              supabase
                .from('app_users')
                .select('id, display_name, username, email')
                .in('id', responsaveisIds),
              'Falha ao resolver usuarios responsaveis.'
            )
          )
        }
        if (responsaveisEmails.length) {
          consultas.push(
            execute(
              supabase
                .from('app_users')
                .select('id, display_name, username, email')
                .in('email', responsaveisEmails),
              'Falha ao resolver usuarios responsaveis.'
            )
          )
        }
        const resultados = (await Promise.all(consultas)).flat().filter(Boolean)
        usuarioNomeMap = new Map()
        resultados.forEach((usuario) => {
          const nome =
            resolveTextValue(usuario.username) ||
            resolveTextValue(usuario.display_name) ||
            resolveTextValue(usuario.email) ||
            ''
          if (usuario.id) {
            usuarioNomeMap.set(usuario.id, nome || usuario.id)
          }
          if (usuario.email) {
            usuarioNomeMap.set(usuario.email, nome || usuario.email)
          }
        })
      }

      const enriquecido = lista.map((item) => {
        const raw = item.usuario_responsavel ?? item.usuarioResponsavel ?? ''
        const nome = usuarioNomeMap.get(raw) || raw || 'sistema'
        return {
          ...item,
          usuario_responsavel: nome,
          usuario_responsavel_id: isUuidValue(raw) ? raw : null,
        }
      })

      return normalizePessoaHistorico(enriquecido)
    },

    async downloadDesligamentoTemplate() {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
      }
      const headers = await buildAuthHeaders()
      const resp = await fetch(`${FUNCTIONS_URL}/desligamento-template`, { headers })
      if (!resp.ok) {
        throw new Error('Falha ao baixar modelo de desligamento.')
      }
      const blob = await resp.blob()
      return { blob, filename: 'desligamento_template.xlsx' }
    },

    async downloadCadastroTemplate() {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
      }
      const headers = await buildAuthHeaders()
      const resp = await fetch(`${FUNCTIONS_URL}/cadastro-template`, { headers })
      if (!resp.ok) {
        throw new Error('Falha ao baixar modelo de cadastro em massa.')
      }
      const blob = await resp.blob()
      return { blob, filename: 'cadastro_template.xlsx' }
    },

    async importDesligamentoPlanilha(file) {
      try {
        if (!file) {
          throw new Error('Selecione um arquivo XLSX.')
        }
        if (!isSupabaseConfigured) {
          throw new Error('Supabase nao configurado.')
        }
        assertFileSizeWithinLimit(file)

        const importsBucket = import.meta.env.VITE_IMPORTS_BUCKET || 'imports'
        const path = `desligamento/${(crypto?.randomUUID?.() ?? Date.now())}-${file.name}`

        // 1) Upload para o Storage
        const upload = await supabase.storage.from(importsBucket).upload(path, file, {
          contentType:
            file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (upload.error) {
          throw new Error(upload.error.message || 'Falha ao enviar arquivo para o Storage.')
        }

        if (!FUNCTIONS_URL) {
          throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
        }

        const headers = await buildAuthHeaders({
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        })
        const resp = await fetch(`${FUNCTIONS_URL}/desligamento-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        })
        const status = resp.status
        const requestId =
          resp.headers.get('x-deno-execution-id') ||
          resp.headers.get('x-sb-request-id') ||
          null
        let responseText = null
        try {
          responseText = await resp.text()
        } catch (_) {
          responseText = null
        }
        let responseJson = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch (_) {
          responseJson = null
        }
        if (!resp.ok) {
          const stage = responseJson?.stage || null
          const responseMessage = responseJson?.message || responseJson?.error || responseText
          const suffixParts = []
          if (stage) suffixParts.push(`stage=${stage}`)
          if (requestId) suffixParts.push(`req=${requestId}`)
          const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : ''
          const friendly =
            responseMessage && String(responseMessage).trim()
              ? `Falha ao importar planilha (${status || 'sem status'}): ${responseMessage}${suffix}`
              : `Falha ao importar planilha (${status || 'sem status'})${suffix}.`

          const enriched = new Error(friendly)
          enriched.details = {
            status,
            stage,
            requestId,
            response: responseMessage,
            function: 'desligamento-import',
            bucket: importsBucket,
            path,
          }
          throw enriched
        }
        return responseJson || {}
      } catch (err) {
        const details = err?.details || {}
        reportClientError(
          'Falha ao importar desligamento.',
          err,
          {
            feature: 'pessoas',
            action: 'desligamento-import',
            status: details.status,
            code: details.code,
            stage: details.stage,
            function: details.function,
            bucket: details.bucket,
            path: details.path,
            response: details.response,
            requestId: details.requestId,
          },
          'error'
        )
        throw err
      }
    },

    async importCadastroPlanilha(file, options = {}) {
      try {
        if (!file) {
          throw new Error('Selecione um arquivo XLSX.')
        }
        if (!isSupabaseConfigured) {
          throw new Error('Supabase nao configurado.')
        }
        assertFileSizeWithinLimit(file)

        const modeRaw = typeof options?.mode === 'string' ? options.mode.trim().toLowerCase() : 'insert'
        const mode = modeRaw === 'update' ? 'update' : 'insert'

        const importsBucket = import.meta.env.VITE_IMPORTS_BUCKET || 'imports'
        const path = `cadastro/${(crypto?.randomUUID?.() ?? Date.now())}-${file.name}`

        const upload = await supabase.storage.from(importsBucket).upload(path, file, {
          contentType:
            file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (upload.error) {
          throw new Error(upload.error.message || 'Falha ao enviar arquivo para o Storage.')
        }

        if (!FUNCTIONS_URL) {
          throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
        }

        const headers = await buildAuthHeaders({
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        })
        const resp = await fetch(`${FUNCTIONS_URL}/cadastro-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path, mode }),
        })
        const status = resp.status
        const requestId =
          resp.headers.get('x-deno-execution-id') ||
          resp.headers.get('x-sb-request-id') ||
          null
        let responseText = null
        try {
          responseText = await resp.text()
        } catch (_) {
          responseText = null
        }
        let responseJson = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch (_) {
          responseJson = null
        }
        if (!resp.ok) {
          const stage = responseJson?.stage || null
          const responseMessage = responseJson?.message || responseJson?.error || responseText
          const suffixParts = []
          if (stage) suffixParts.push(`stage=${stage}`)
          if (requestId) suffixParts.push(`req=${requestId}`)
          const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : ''
          const friendly =
            responseMessage && String(responseMessage).trim()
              ? `Falha ao importar planilha (${status || 'sem status'}): ${responseMessage}${suffix}`
              : `Falha ao importar planilha (${status || 'sem status'})${suffix}.`

          const enriched = new Error(friendly)
          enriched.details = {
            status,
            stage,
            requestId,
            response: responseMessage,
            function: 'cadastro-import',
            bucket: importsBucket,
            path,
            mode,
          }
          throw enriched
        }
        return responseJson || {}
      } catch (err) {
        const details = err?.details || {}
        const modeLabel = details.mode === 'update' ? 'atualizacao' : 'importacao'
        reportClientError(
          `Falha ao ${modeLabel} de cadastro em massa.`,
          err,
          {
            feature: 'pessoas',
            action: 'cadastro-import',
            status: details.status,
            code: details.code,
            stage: details.stage,
            function: details.function,
            bucket: details.bucket,
            path: details.path,
            response: details.response,
            requestId: details.requestId,
            mode: details.mode || mode,
          },
          'error'
        )
        throw err
      }
    },
  },
  materiais: {
    async list() {
      return carregarMateriais()
    },
    async listDetalhado() {
      return carregarMateriaisDetalhados()
    },
    async search(params = {}) {
      const termo = params?.termo ?? params?.q ?? params?.query ?? ''
      const limit = params?.limit ?? 10
      const source = params?.centroEstoqueId ? ENTRADAS_MATERIAIS_VIEW : undefined
      return buscarMateriaisPorTermo(termo, limit, { source, centroEstoqueId: params?.centroEstoqueId })
    },
    async estoqueAtual(materialId, centroEstoqueId = null) {
      if (!materialId) {
        throw new Error('Material invalido.')
      }
      return calcularSaldoMaterialAtual(materialId, centroEstoqueId)
    },
    async create(payload) {
      const dados = sanitizeMaterialPayload(payload)
      if (!dados.nome || !dados.fabricante || !dados.validadeDias || dados.validadeDias <= 0) {
        throw new Error('Preencha nome, fabricante e validade (em dias).')
      }
      const usuarioId = await resolveUsuarioIdOrThrow()
      let effective = null
      try {
        effective = typeof resolveEffectiveAppUser === 'function' ? await resolveEffectiveAppUser(usuarioId) : null
      } catch (err) {
        reportClientError('Falha ao resolver account_owner_id; prosseguindo sem owner.', err, { usuarioId })
        effective = null
      }
      const agora = new Date().toISOString()

      const nomeItemId = await resolveMaterialItemId(dados.nome || dados.nomeId || dados.materialItemNome)
      if (!nomeItemId) {
        throw new Error('Material/EPI invalido. Selecione um item cadastrado.')
      }
      ensureUuidOrThrow(nomeItemId, 'Material/EPI')
      const grupoMaterialId =
        (await resolveGrupoMaterialId(dados.grupoMaterialId || dados.grupoMaterial)) || null
      if ((dados.grupoMaterialId || dados.grupoMaterial) && !grupoMaterialId) {
        throw new Error('Grupo de material invalido. Selecione um grupo cadastrado.')
      }
      const fabricanteId = await resolveFabricanteId(dados.fabricante || dados.fabricanteNome)
      if (!fabricanteId) {
        throw new Error('Fabricante invalido. Selecione um fabricante cadastrado.')
      }
      ensureUuidOrThrow(fabricanteId, 'Fabricante')

      const coresIds = Array.isArray(dados.coresIds) ? dados.coresIds : []
      const caracteristicaIds = Array.isArray(dados.caracteristicasIds)
        ? dados.caracteristicasIds
        : []
      const corNames = extractTextualNames(dados.cores)
      const caracteristicaNames = extractTextualNames(dados.caracteristicas)
      const corRelationIds =
        (Array.isArray(coresIds) && coresIds.length
          ? coresIds
          : corNames.length > 0
            ? await resolveCorIdsFromNames(corNames)
            : []) || []
      const caracteristicaRelationIds =
        (Array.isArray(caracteristicaIds) && caracteristicaIds.length
          ? caracteristicaIds
          : caracteristicaNames.length > 0
            ? await resolveCaracteristicaIdsFromNames(caracteristicaNames)
            : []) || []

      // Preflight: CA conflito ou base igual com CA diferente (escopo do owner)
      const preflight = await executeMaybeSingle(
        supabase.rpc('material_preflight_check', {
          p_grupo: toUuidOrNull(grupoMaterialId),
          p_nome: toUuidOrNull(nomeItemId),
          p_fabricante: toUuidOrNull(fabricanteId),
          p_numero_especifico: dados.numeroEspecifico ?? null,
          p_numero_calcado: toUuidOrNull(dados.numeroCalcado),
          p_numero_vestimenta: toUuidOrNull(dados.numeroVestimenta),
          p_ca: dados.ca ?? null,
          p_account_owner_id: resolvePreflightOwnerId(effective),
          p_cores_ids: toUuidArrayOrEmpty(corRelationIds),
          p_caracteristicas_ids: toUuidArrayOrEmpty(caracteristicaRelationIds),
          p_material_id: null,
        }),
        'Falha no preflight de material.'
      )
      if (preflight?.ca_conflict) {
        const err = new Error('Ja existe material cadastrado com este C.A. na mesma base.')
        err.code = 'CA_CONFLICT'
        throw err
      }
      if (preflight?.base_conflict_empty) {
        const err = new Error('Material duplicado (base igual com CA vazio/ausente).')
        err.code = 'BASE_EMPTY_CONFLICT'
        throw err
      }
      if (preflight?.base_match_ca_diff && !dados.forceBaseCaDiff) {
        const err = new Error('BASE_CA_DIFF')
        err.code = 'BASE_CA_DIFF'
        err.details = preflight?.base_match_ids || []
        throw err
      }
      const supabasePayload = buildMaterialSupabasePayload(
        {
          ...dados,
          nome: nomeItemId,
          nomeId: nomeItemId,
          grupoMaterialId,
          grupoMaterial: grupoMaterialId,
          fabricante: fabricanteId,
        },
        {
        usuario: usuarioId,
        agora,
        includeCreateAudit: true,
        includeUpdateAudit: true,
        },
      )

      const criado = await executeMaybeSingle(
        supabase.rpc('material_create_full', {
          p_material: supabasePayload,
          p_cores_ids: toUuidArrayOrEmpty(corRelationIds),
          p_caracteristicas_ids: toUuidArrayOrEmpty(caracteristicaRelationIds),
        }),
        'Falha ao criar material.'
      )
      const materialCriadoId = criado?.id
      if (!materialCriadoId) {
        throw new Error('Falha ao criar material.')
      }
      const registro = await executeSingle(
        supabase
          .from('materiais_view')
          .select(MATERIAL_SELECT_COLUMNS)
          .eq('id', materialCriadoId),
        'Falha ao obter material criado.'
      )
      return mapMaterialRecord(registro)
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('Material inv├ílido.')
      }
      const atualLista = await execute(
        supabase
          .from('materiais_view')
          .select(MATERIAL_SELECT_COLUMNS)
          .eq('id', id)
          .limit(1),
        'Falha ao localizar material.'
      )
      const registroAtual = Array.isArray(atualLista) ? atualLista[0] : null
      if (!registroAtual) {
        throw new Error('Material no encontrado.')
      }

      const materialAtual = mapMaterialRecord(registroAtual)
      const caOriginal = trim(materialAtual?.ca ?? '')
      const dadosCombinados = sanitizeMaterialPayload({ ...materialAtual, ...payload })
      const caNovo = trim(dadosCombinados?.ca ?? '')
      const caAlterado = caNovo !== caOriginal
      const usuarioId = await resolveUsuarioIdOrThrow()
      let effective = null
      try {
        effective = typeof resolveEffectiveAppUser === 'function' ? await resolveEffectiveAppUser(usuarioId) : null
      } catch (err) {
        reportClientError('Falha ao resolver account_owner_id; prosseguindo sem owner.', err, { usuarioId })
        effective = null
      }
      const agora = new Date().toISOString()
      const camposAlterados = []
      MATERIAL_HISTORY_FIELDS.forEach((campo) => {
        const valorAtual = normalizeHistoryValue(materialAtual?.[campo])
        const valorNovo = normalizeHistoryValue(dadosCombinados?.[campo])
        if (valorAtual !== valorNovo) {
          camposAlterados.push({
            campo,
            de: materialAtual?.[campo] ?? '',
            para: dadosCombinados?.[campo] ?? '',
          })
        }
      })
      if (camposAlterados.length > 0) {
        ensureSupabase()
        const { error: historicoErro } = await supabase
          .from('material_price_history')
          .insert({
            materialId: id,
            valorUnitario: dadosCombinados.valorUnitario,
            usuarioResponsavel: usuarioId,
            criadoEm: agora,
            campos_alterados: camposAlterados,
          })
        if (historicoErro) {
          const mensagemErro = historicoErro.message?.toLowerCase?.() ?? ''
          const isRlsViolation =
            historicoErro.code === '42501' ||
            historicoErro.code === 'PGRST301' ||
            mensagemErro.includes('row-level security') ||
            mensagemErro.includes('row level security')
          if (isRlsViolation) {
            reportClientError(
              'Registro de historico do material ignorado devido a politica de RLS.',
              historicoErro,
              { materialId: id, camposAlterados: camposAlterados.length }
            )
          } else {
            throw mapSupabaseError(historicoErro, 'Falha ao registrar hist├│rico do material.')
          }
        }
      }
      const nomeItemId = await resolveMaterialItemId(
        dadosCombinados.nome || dadosCombinados.nomeId || dadosCombinados.materialItemNome,
      )
      if (!nomeItemId) {
        throw new Error('Material/EPI invalido. Selecione um item cadastrado.')
      }
      ensureUuidOrThrow(nomeItemId, 'Material/EPI')
      const grupoMaterialId =
        (await resolveGrupoMaterialId(
          dadosCombinados.grupoMaterialId || dadosCombinados.grupoMaterial,
        )) || null
      if ((dadosCombinados.grupoMaterialId || dadosCombinados.grupoMaterial) && !grupoMaterialId) {
        throw new Error('Grupo de material invalido. Selecione um grupo cadastrado.')
      }
      const fabricanteId = await resolveFabricanteId(
        dadosCombinados.fabricante || dadosCombinados.fabricanteNome,
      )
      if (!fabricanteId) {
        throw new Error('Fabricante invalido. Selecione um fabricante cadastrado.')
      }
      ensureUuidOrThrow(fabricanteId, 'Fabricante')

      const dados = {
        ...dadosCombinados,
        nome: nomeItemId,
        nomeId: nomeItemId,
        grupoMaterialId,
        grupoMaterial: grupoMaterialId,
        fabricante: fabricanteId,
      }
      const coresIds = Array.isArray(dados.coresIds) ? dados.coresIds : []
      const caracteristicaIds = Array.isArray(dados.caracteristicasIds)
        ? dados.caracteristicasIds
        : []
      const corNames = extractTextualNames(dados.cores)
      const caracteristicaNames = extractTextualNames(dados.caracteristicas)
      const corRelationIds =
        (Array.isArray(coresIds) && coresIds.length
          ? coresIds
          : corNames.length > 0
            ? await resolveCorIdsFromNames(corNames)
            : []) || []
      const caracteristicaRelationIds =
        (Array.isArray(caracteristicaIds) && caracteristicaIds.length
          ? caracteristicaIds
          : caracteristicaNames.length > 0
            ? await resolveCaracteristicaIdsFromNames(caracteristicaNames)
            : []) || []

      const preflight = await executeMaybeSingle(
        supabase.rpc('material_preflight_check', {
          p_grupo: toUuidOrNull(grupoMaterialId),
          p_nome: toUuidOrNull(nomeItemId),
          p_fabricante: toUuidOrNull(fabricanteId),
          p_numero_especifico: dadosCombinados.numeroEspecifico ?? null,
          p_numero_calcado: toUuidOrNull(dadosCombinados.numeroCalcado),
          p_numero_vestimenta: toUuidOrNull(dadosCombinados.numeroVestimenta),
          p_ca: dadosCombinados.ca ?? null,
          p_account_owner_id: resolvePreflightOwnerId(effective),
          p_cores_ids: toUuidArrayOrEmpty(corRelationIds),
          p_caracteristicas_ids: toUuidArrayOrEmpty(caracteristicaRelationIds),
          p_material_id: id,
        }),
        'Falha no preflight de material.'
      )
      // Em edição só alerta base igual + CA diferente (permite confirmar no modal)
      if (preflight?.base_match_ca_diff && !dadosCombinados.forceBaseCaDiff) {
        // Se o CA não mudou, não faz sentido alertar (já existe com CA diferente e estamos mantendo o mesmo CA)
        if (!caAlterado) {
          // prossegue sem modal
        } else {
          const err = new Error('BASE_CA_DIFF')
          err.code = 'BASE_CA_DIFF'
          err.details = preflight?.base_match_ids || []
          throw err
        }
      }
      const supabasePayload = buildMaterialSupabasePayload(
        dados,
        {
          usuario: usuarioId,
          agora,
          includeUpdateAudit: true,
        },
      )

      const atualizado = await executeMaybeSingle(
        supabase.rpc('material_update_full', {
          p_material_id: id,
          p_material: supabasePayload,
          p_cores_ids: toUuidArrayOrEmpty(corRelationIds),
          p_caracteristicas_ids: toUuidArrayOrEmpty(caracteristicaRelationIds),
        }),
        'Falha ao atualizar material.'
      )
      if (!atualizado?.id) {
        throw new Error('Falha ao atualizar material.')
      }
      const registro = await executeSingle(
        supabase
          .from('materiais_view')
          .select(MATERIAL_SELECT_COLUMNS)
          .eq('id', id),
        'Falha ao obter material atualizado.'
      )
      return mapMaterialRecord(registro)
    },
    async get(id) {
      const registro = await executeSingle(
        supabase
          .from('materiais_view')
          .select(MATERIAL_SELECT_COLUMNS)
          .eq('id', id),
        'Falha ao obter material.'
      )
      return mapMaterialRecord(registro)
    },
    async priceHistory(id) {
      const data = await execute(
        supabase
          .from('material_price_history')
          .select('*')
          .eq('materialId', id)
          .order('criadoEm', { ascending: false }),
        'Falha ao obter hist├│rico de pre├ºos.'
      )
      return (data ?? []).map((registro) => ({
        id: registro.id,
        materialId: registro.materialId ?? registro.material_id ?? null,
        valorUnitario: toNumber(registro.valorUnitario ?? registro.valor_unitario),
        criadoEm: registro.criadoEm ?? registro.criado_em ?? null,
        usuarioResponsavel: registro.usuarioResponsavel ?? registro.usuario_responsavel ?? '',
        camposAlterados: normalizeMaterialCamposAlterados(
          registro.campos_alterados ?? registro.camposAlterados ?? registro.campos ?? []
        ),
      }))
    },
    async groups() {
      const data = await execute(
        supabase
          .from('grupos_material')
          .select('id, nome, ativo')
          .order('nome', { ascending: true }),
        'Falha ao listar grupos de materiais.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => ({
          id: item.id ?? null,
          nome: String(item.nome).trim(),
        }))
        .filter((item) => Boolean(item.nome))
    },
    async caracteristicas() {
      const data = await execute(
        supabase
          .from('caracteristica_epi')
          .select('id, caracteristica_material')
          .order('caracteristica_material', { ascending: true }),
        'Falha ao listar caracteristicas de EPI.',
      )
      return normalizeCatalogoOptions(data)
    },
    async cores() {
      const data = await execute(
        supabase.from('cor').select('id, cor').order('cor', { ascending: true }),
        'Falha ao listar cores.',
      )
      const lista = (data ?? [])
        .map((item) => {
          const nome = trim(item?.cor ?? item?.nome ?? '')
          if (!nome) {
            return null
          }
          return {
            id: item?.id ?? nome,
            nome,
          }
        })
        .filter(Boolean)
      return normalizeCatalogoOptions(lista)
    },
    async medidasCalcado() {
      const data = await execute(
        supabase
          .from('medidas_calcado')
          .select('id, numero_calcado')
          .order('numero_calcado', { ascending: true }),
        'Falha ao listar medidas de cal├ºado.',
      )
      return (data ?? [])
        .map((item) => {
          const nome = resolveCatalogoNome(item)
          if (!nome) {
            return null
          }
          return { id: item.id ?? nome, nome }
        })
        .filter(Boolean)
    },
    async medidasVestimenta() {
      const data = await execute(
        supabase
          .from('medidas_vestimentas')
          .select('id, medidas')
          .order('medidas', { ascending: true }),
        'Falha ao listar tamanhos de vestimenta.',
      )
      return (data ?? [])
        .map((item) => {
          const nome = resolveCatalogoNome(item)
          if (!nome) {
            return null
          }
          return { id: item.id ?? nome, nome }
        })
        .filter(Boolean)
    },
    async items(grupoId) {
      const id = normalizeOptionId(grupoId)
      if (!id) {
        return []
      }
      const data = await execute(
        supabase
          .from('grupos_material_itens')
          .select('id, nome, ativo')
          .eq('grupo_id', id)
          .order('nome', { ascending: true }),
        'Falha ao listar EPIs do grupo.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => ({
          id: item.id ?? null,
          nome: String(item.nome).trim(),
        }))
        .filter((item) => Boolean(item.nome))
    },
    async fabricantes() {
      const data = await execute(
        supabase
          .from('fabricantes')
          .select('id, fabricante')
          .order('fabricante', { ascending: true }),
        'Falha ao listar fabricantes.',
      )
      return (data ?? [])
        .filter((item) => item && item.fabricante)
        .map((item) => ({
          id: item.id ?? null,
          nome: String(item.fabricante).trim(),
        }))
        .filter((item) => Boolean(item.nome))
    },
  },
  entradas: {
    list: carregarEntradas,
    materialOptions: carregarMateriaisDeEntradas,
    async downloadTemplate() {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
      }
      const headers = await buildAuthHeaders()
      const resp = await fetch(`${FUNCTIONS_URL}/entrada-template`, { headers })
      if (!resp.ok) {
        throw new Error('Falha ao baixar modelo de entradas.')
      }
      const blob = await resp.blob()
      return { blob, filename: 'entrada_template.xlsx' }
    },
    async importPlanilha(file) {
      try {
        if (!file) {
          throw new Error('Selecione um arquivo XLSX.')
        }
        if (!isSupabaseConfigured) {
          throw new Error('Supabase nao configurado.')
        }
        assertFileSizeWithinLimit(file)

        const importsBucket = import.meta.env.VITE_IMPORTS_BUCKET || 'imports'
        const path = `entradas/${(crypto?.randomUUID?.() ?? Date.now())}-${file.name}`

        const upload = await supabase.storage.from(importsBucket).upload(path, file, {
          contentType:
            file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (upload.error) {
          throw new Error(upload.error.message || 'Falha ao enviar arquivo para o Storage.')
        }

        if (!FUNCTIONS_URL) {
          throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
        }

        const headers = await buildAuthHeaders({
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        })
        const resp = await fetch(`${FUNCTIONS_URL}/entrada-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        })
        const status = resp.status
        const requestId =
          resp.headers.get('x-deno-execution-id') ||
          resp.headers.get('x-sb-request-id') ||
          null
        let responseText = null
        try {
          responseText = await resp.text()
        } catch (_) {
          responseText = null
        }
        let responseJson = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch (_) {
          responseJson = null
        }
        if (!resp.ok) {
          const stage = responseJson?.stage || null
          const responseMessage = responseJson?.message || responseJson?.error || responseText
          const suffixParts = []
          if (stage) suffixParts.push(`stage=${stage}`)
          if (requestId) suffixParts.push(`req=${requestId}`)
          const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : ''
          const friendly =
            responseMessage && String(responseMessage).trim()
              ? `Falha ao importar planilha (${status || 'sem status'}): ${responseMessage}${suffix}`
              : `Falha ao importar planilha (${status || 'sem status'})${suffix}.`

          const enriched = new Error(friendly)
          enriched.details = {
            status,
            stage,
            requestId,
            response: responseMessage,
            function: 'entrada-import',
            bucket: importsBucket,
            path,
          }
          throw enriched
        }
        return responseJson || {}
      } catch (err) {
        const details = err?.details || {}
        reportClientError(
          'Falha ao importar entradas em massa.',
          err,
          {
            feature: 'entradas',
            action: 'entrada-import',
            status: details.status,
            code: details.code,
            stage: details.stage,
            function: details.function,
            bucket: details.bucket,
            path: details.path,
            response: details.response,
            requestId: details.requestId,
          },
          'error'
        )
        throw err
      }
    },
    async searchMateriais(params = {}) {
      const termo = params?.termo ?? params?.q ?? params?.query ?? ''
      const limit = Number.isFinite(Number(params?.limit)) ? Number(params.limit) : 10
      return buscarMateriaisPorTermo(termo, limit, { source: ENTRADAS_MATERIAIS_VIEW })
    },
    async create(payload) {
      const usuarioId = await resolveUsuarioIdOrThrow()
      const dados = normalizeEntradaInput(payload)
      const registro = await executeSingle(
        supabase.rpc('rpc_entradas_create_full', {
          p_material_id: dados.materialId,
          p_quantidade: dados.quantidade,
          p_centro_estoque: dados.centroCusto,
          p_data_entrada: dados.dataEntrada,
          p_status: normalizeUuid(payload.statusId ?? payload.status ?? null),
          p_usuario_id: usuarioId,
        }),
        'Falha ao registrar entrada.'
      )
      const entradaNormalizada = mapEntradaRecord(registro)
      await registrarEntradaHistoricoSupabase(entradaNormalizada)
      return entradaNormalizada
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('Entrada invalida.')
      }
      const entradaAtual = await executeMaybeSingle(
        supabase.from('entradas').select('*').eq('id', id),
        'Falha ao obter entrada.'
      )
      const entradaAnterior = entradaAtual ? mapEntradaRecord(entradaAtual) : null
      const usuarioId = await resolveUsuarioIdOrThrow()
      const dados = normalizeEntradaInput(payload)
      const registro = await executeSingle(
        supabase.rpc('rpc_entradas_update_full', {
          p_id: id,
          p_material_id: dados.materialId,
          p_quantidade: dados.quantidade,
          p_centro_estoque: dados.centroCusto,
          p_data_entrada: dados.dataEntrada,
          p_status: normalizeUuid(payload.statusId ?? payload.status ?? null),
          p_usuario_id: usuarioId,
        }),
        'Falha ao atualizar entrada.'
      )
      const entradaNormalizada = mapEntradaRecord(registro)
      await registrarEntradaHistoricoSupabase(entradaNormalizada, entradaAnterior)
      return entradaNormalizada
    },
    async cancel(id, payload = {}) {
      if (!id) {
        throw new Error('Entrada invalida.')
      }
      const motivo = trim(payload.motivo ?? payload.motivoCancelamento ?? '')
      const entradaAtualRegistro = await executeMaybeSingle(
        supabase.from('entradas').select('*').eq('id', id),
        'Falha ao obter entrada.'
      )
      if (!entradaAtualRegistro) {
        throw new Error('Entrada nao encontrada.')
      }
      const entradaAtual = mapEntradaRecord(entradaAtualRegistro)
      const usuarioId = await resolveUsuarioIdOrThrow()
      const statusCanceladoId = (await resolveStatusEntradaIdByName(STATUS_CANCELADO_NOME)) || null
      const statusValor = statusCanceladoId || STATUS_CANCELADO_NOME
      const registro = await executeSingle(
        supabase
          .from('entradas')
          .update({
            status: statusValor,
            usuarioResponsavel: usuarioId,
            usuario_edicao: usuarioId,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', id)
          .select(),
        'Falha ao cancelar entrada.'
      )
      let entradaAtualizada = mapEntradaRecord(registro)
      entradaAtualizada.status = entradaAtualizada.status || STATUS_CANCELADO_NOME
      entradaAtualizada = (await preencherStatusEntrada([entradaAtualizada]))[0] ?? entradaAtualizada
      entradaAtualizada.statusMotivo = motivo
      await registrarEntradaHistoricoSupabase(entradaAtualizada, entradaAtual, {
        status: STATUS_CANCELADO_NOME,
        motivoCancelamento: motivo,
      })
      return entradaAtualizada
    },
    async history(id) {
      if (!id) {
        throw new Error('Entrada invalida.')
      }
      const registros = await execute(
        supabase
          .from('entrada_historico')
          .select(
            `
              id,
              entrada_id,
              material_id,
              material_ent,
              created_at,
              usuario:usuarioResponsavel ( id, display_name, username, email )
            `
          )
          .eq('entrada_id', id)
          .order('created_at', { ascending: false }),
        'Falha ao listar historico de entrada.'
      )
      return (registros ?? []).map(mapEntradaHistoryRecord)
    },
  },
  saidas: {
    list: carregarSaidas,
    async create(payload) {
      const usuarioId = await resolveUsuarioIdOrThrow()
      const pessoaId = trim(payload.pessoaId)
      const materialId = trim(payload.materialId)
      const quantidade = toNumber(payload.quantidade, null)
      const centroEstoqueIdInput = trim(payload.centroEstoqueId ?? payload.centroEstoque ?? '')
      const centroCustoIdInput = trim(payload.centroCustoId)
      const centroServicoIdInput = trim(payload.centroServicoId)
      const dataEntregaRaw = trim(payload.dataEntrega)
      const status = trim(payload.status) || STATUS_ENTREGUE_ID

      if (!pessoaId || !materialId || !quantidade || quantidade <= 0) {
        throw new Error('Preencha pessoa, material e quantidade (>0).')
      }
      if (!dataEntregaRaw) {
        throw new Error('Informe a data de entrega.')
      }
      const dataEntregaDate = buildDateWithCurrentTime(dataEntregaRaw)
      if (!dataEntregaDate) {
        throw new Error('Data de entrega invalida.')
      }

      const pessoa = await executeSingle(
        supabase.from('pessoas').select('centro_servico_id, centro_custo_id').eq('id', pessoaId),
        'Falha ao obter pessoa.'
      )

      const centroCustoIdFinal = centroCustoIdInput || pessoa?.centro_custo_id || null
      const centroServicoIdFinal = centroServicoIdInput || pessoa?.centro_servico_id || null
      const centroEstoqueIdFinal = centroEstoqueIdInput || centroCustoIdFinal || null
      if (!centroEstoqueIdFinal) {
        throw new Error('Centro de estoque invalido.')
      }
      if (!centroCustoIdFinal) {
        throw new Error('Centro de custo invalido.')
      }
      if (!centroServicoIdFinal) {
        throw new Error('Centro de servico invalido.')
      }

      const material = await executeSingle(
        supabase.from('materiais').select('id, validadeDias').eq('id', materialId),
        'Falha ao obter material.'
      )

      const estoqueDisponivel = await calcularSaldoMaterialAtual(materialId, centroEstoqueIdFinal)
      if (quantidade > estoqueDisponivel) {
        const error = new Error('Quantidade informada maior que o estoque dispon├¡vel.')
        error.status = 400
        throw error
      }

      const dataEntregaIso = dataEntregaDate.toISOString()

      const trocaPreflight = await executeMaybeSingle(
        supabase.rpc('rpc_saida_verificar_troca', {
          p_material_id: materialId,
          p_pessoa_id: pessoaId,
        }),
        'Falha ao verificar troca da saida.'
      )
      if (trocaPreflight?.tem_saida && !payload.forceTroca) {
        const err = new Error('TROCA_CONFIRM')
        err.code = 'TROCA_CONFIRM'
        err.details = {
          ultimaSaidaId: trocaPreflight?.ultima_saida_id ?? null,
          trocaSequencia: trocaPreflight?.troca_sequencia ?? 0,
        }
        throw err
      }

      const trocaSequencia = Number(trocaPreflight?.troca_sequencia ?? 0)
      const registro = await executeSingle(
        supabase.rpc('rpc_saidas_create_full', {
          p_pessoa_id: pessoaId,
          p_material_id: materialId,
          p_quantidade: quantidade,
          p_centro_estoque: centroEstoqueIdFinal,
          p_centro_custo: centroCustoIdFinal,
          p_centro_servico: centroServicoIdFinal,
          p_data_entrega: dataEntregaIso,
          p_status: status,
          p_usuario_id: usuarioId,
          p_is_troca: trocaPreflight?.tem_saida && payload.forceTroca ? true : false,
          p_troca_de_saida: trocaPreflight?.tem_saida && payload.forceTroca ? trocaPreflight?.ultima_saida_id ?? null : null,
          p_troca_sequencia: trocaPreflight?.tem_saida && payload.forceTroca ? (trocaSequencia > 0 ? trocaSequencia : 1) : null,
        }),
        'Falha ao registrar saida.'
      )

      const saidaNormalizada = mapSaidaRecord(registro)
      await registrarSaidaHistoricoSupabase(saidaNormalizada)
      return saidaNormalizada
    },
    async update(id, payload = {}) {
      if (!id) {
        throw new Error('Saida invalida.')
      }
      const atualRegistro = await executeSingle(
        supabase.from('saidas').select('*').eq('id', id),
        'Falha ao obter saida.'
      )
      if (!atualRegistro) {
        throw new Error('Saida nao encontrada.')
      }
      const saidaAtual = mapSaidaRecord(atualRegistro)
      const usuarioId = await resolveUsuarioIdOrThrow()
      const pessoaId = trim(payload.pessoaId ?? saidaAtual.pessoaId)
      const materialId = trim(payload.materialId ?? saidaAtual.materialId)
      const quantidade = toNumber(payload.quantidade, null)
      const centroEstoqueEntrada = trim(payload.centroEstoqueId ?? payload.centroEstoque ?? '')
      const dataEntregaEntrada = trim(payload.dataEntrega ?? '')
      if (!pessoaId || !materialId || !quantidade || quantidade <= 0) {
        throw new Error('Preencha pessoa, material e quantidade (>0).')
      }
      if (!dataEntregaEntrada && !saidaAtual.dataEntrega) {
        throw new Error('Informe a data de entrega.')
      }
      const dataEntregaDate = dataEntregaEntrada
        ? mergeDateWithExistingTime(
            dataEntregaEntrada,
            saidaAtual.dataEntrega ? new Date(saidaAtual.dataEntrega) : null
          )
        : saidaAtual.dataEntrega
        ? new Date(saidaAtual.dataEntrega)
        : null
      if (!dataEntregaDate || Number.isNaN(dataEntregaDate.getTime())) {
        throw new Error('Data de entrega invalida.')
      }

      let centroCustoIdFinal = trim(payload.centroCustoId ?? '') || saidaAtual.centroCustoId || null
      let centroServicoIdFinal = trim(payload.centroServicoId ?? '') || saidaAtual.centroServicoId || null
      let centroEstoqueIdFinal = centroEstoqueEntrada || saidaAtual.centroEstoqueId || null
      if (!centroCustoIdFinal || !centroServicoIdFinal || pessoaId !== saidaAtual.pessoaId) {
        const pessoa = await executeSingle(
          supabase.from('pessoas').select('centro_servico_id, centro_custo_id').eq('id', pessoaId),
          'Falha ao obter pessoa.'
        )
        centroCustoIdFinal = centroCustoIdFinal || pessoa?.centro_custo_id || null
        centroServicoIdFinal = centroServicoIdFinal || pessoa?.centro_servico_id || null
      }
      if (!centroEstoqueIdFinal) {
        centroEstoqueIdFinal = centroCustoIdFinal || null
      }
      if (!centroEstoqueIdFinal) {
        throw new Error('Centro de estoque invalido.')
      }
      if (!centroCustoIdFinal) {
        throw new Error('Centro de custo invalido.')
      }
      if (!centroServicoIdFinal) {
        throw new Error('Centro de servico invalido.')
      }

      const material = await executeSingle(
        supabase.from('materiais').select('id, validadeDias').eq('id', materialId),
        'Falha ao obter material.'
      )

      const estoqueDisponivel = await calcularSaldoMaterialAtual(materialId, centroEstoqueIdFinal)
      const quantidadeAnterior = toNumber(saidaAtual.quantidade, 0)
      const estoqueConsiderado =
        materialId === saidaAtual.materialId ? estoqueDisponivel + quantidadeAnterior : estoqueDisponivel
      if (quantidade > estoqueConsiderado) {
        const error = new Error('Quantidade informada maior que o estoque dispon├¡vel.')
        error.status = 400
        throw error
      }

      const dataEntregaIso = dataEntregaDate.toISOString()
      const statusValor =
        trim(payload.statusId ?? payload.status ?? '') ||
        saidaAtual.statusId ||
        saidaAtual.status ||
        STATUS_ENTREGUE_ID

      const registro = await executeSingle(
        supabase.rpc('rpc_saidas_update_full', {
          p_id: id,
          p_pessoa_id: pessoaId,
          p_material_id: materialId,
          p_quantidade: quantidade,
          p_centro_estoque: centroEstoqueIdFinal,
          p_centro_custo: centroCustoIdFinal,
          p_centro_servico: centroServicoIdFinal,
          p_data_entrega: dataEntregaIso,
          p_status: statusValor,
          p_usuario_id: usuarioId,
        }),
        'Falha ao atualizar saida.'
      )

      const saidaAtualizada = mapSaidaRecord(registro)
      await registrarSaidaHistoricoSupabase(saidaAtualizada, saidaAtual)
      return saidaAtualizada
    },
    async cancel(id, payload = {}) {
      if (!id) {
        throw new Error('Saida invalida.')
      }
      const motivo = trim(payload.motivo ?? payload.motivoCancelamento ?? '')
      const atualRegistro = await executeSingle(
        supabase.from('saidas').select('*').eq('id', id),
        'Falha ao obter saida.'
      )
      if (!atualRegistro) {
        throw new Error('Saida nao encontrada.')
      }
      await ensureStatusCanceladoIdLoaded()
      const saidaAtual = mapSaidaRecord(atualRegistro)
      if (isSaidaCanceladaSync(saidaAtual)) {
        throw new Error('Saida ja cancelada.')
      }
      const usuarioId = await resolveUsuarioIdOrThrow()
      let statusCanceladoId = await resolveStatusSaidaIdByName(STATUS_CANCELADO_NOME)
      if (!statusCanceladoId) {
        throw new Error('Status CANCELADO nao encontrado.')
      }
      const registro = await executeSingle(
        supabase
          .from('saidas')
          .update({
            status: statusCanceladoId,
            usuarioResponsavel: usuarioId,
          })
          .eq('id', id)
          .select(),
        'Falha ao cancelar saida.'
      )
      let saidaAtualizada = mapSaidaRecord(registro)
      saidaAtualizada.status = STATUS_CANCELADO_NOME
      saidaAtualizada = (await preencherStatusSaida([saidaAtualizada]))[0] ?? saidaAtualizada
      saidaAtualizada.statusMotivo = motivo
      await registrarSaidaHistoricoSupabase(saidaAtualizada, saidaAtual, {
        status: STATUS_CANCELADO_NOME,
        motivoCancelamento: motivo,
      })
      return saidaAtualizada
    },
    async history(id) {
      if (!id) {
        throw new Error('Saida invalida.')
      }
      const registros = await execute(
        supabase.rpc('rpc_saida_historico', { p_saida_id: id }),
        'Falha ao listar historico de saida.'
      )
      return (registros ?? []).map(mapSaidaHistoryRecord)
    },
  },
  estoque: {
    async current(params = {}) {
      const periodo = parsePeriodo(params)
      const usarMovimentacao =
        params?.movimentacaoPeriodo === true ||
        params?.movimentacaoPeriodo === 'true' ||
        params?.modo === 'periodo'
      const limparPeriodo = (rawParams) => {
        const { periodoInicio, periodoFim, ano, mes, dataInicio, dataFim, movimentacaoPeriodo, modo, ...rest } =
          rawParams || {}
        return rest
      }
      const periodoRange = usarMovimentacao ? resolvePeriodoRange(periodo) : null
      const hasExplicitDate = Boolean(params.dataInicio || params.dataFim)
      const queryParams = usarMovimentacao
        ? !hasExplicitDate && periodoRange?.start && periodoRange?.end
          ? {
              ...params,
              dataInicio: periodoRange.start.toISOString(),
              dataFim: periodoRange.end.toISOString(),
            }
          : params
        : limparPeriodo(params)
      const [materiais, entradas, saidas] = await Promise.all([
        carregarMateriais(),
        carregarEntradas(queryParams),
        carregarSaidas(queryParams),
      ])
      return montarEstoqueAtual(materiais, entradas, saidas, usarMovimentacao ? periodo : null, {
        includeAll: false,
      })
    },
    async saldo(materialId) {
      return obterSaldoMaterial(materialId)
    },
    async dashboard(params = {}) {
      const periodo = parsePeriodo(params)
      const [materiais, entradas, saidas] = await Promise.all([
        carregarMateriais(),
        carregarEntradas(params),
        carregarSaidas(params),
      ])
      const pessoaIds = Array.from(new Set(saidas.map((saida) => saida.pessoaId).filter(Boolean)))
      const pessoasDetalhes = pessoaIds.length ? await carregarPessoasViewDetalhes(pessoaIds) : new Map()
      const pessoas = Array.from(pessoasDetalhes.values())
      return montarDashboard({ materiais, entradas, saidas, pessoas }, periodo)
    },
    async report(params = {}) {
      ensureSupabase()
      const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' })
      if (!headers.Authorization) {
        throw new Error('Sessao expirada. Faça login novamente.')
      }

      const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
      const endpoint = `${base}/api/estoque/relatorio`
      return httpRequest('POST', endpoint, { body: params || {}, headers })
    },
    async reportHistory(params = {}) {
      ensureSupabase()
      const headers = await buildAuthHeaders()
      if (!headers.Authorization) {
        throw new Error('Sessao expirada. Faça login novamente.')
      }

      const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
      const query = new URLSearchParams()
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          query.append(key, String(value))
        }
      })
      const endpoint = `${base}/api/estoque/relatorios${query.toString() ? `?${query.toString()}` : ''}`
      return httpRequest('GET', endpoint, { headers })
    },
    async reportHtml(params = {}) {
      ensureSupabase()
      const headers = await buildAuthHeaders()
      if (!headers.Authorization) {
        throw new Error('Sessao expirada. Faça login novamente.')
      }

      const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
      const query = new URLSearchParams()
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          query.append(key, String(value))
        }
      })
      const endpoint = `${base}/api/estoque/relatorio/html${query.toString() ? `?${query.toString()}` : ''}`
      return httpRequest('GET', endpoint, { headers })
    },
    async reportPdf(params = {}) {
      ensureSupabase()
      const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' })
      if (!headers.Authorization) {
        throw new Error('Sessao expirada. Faça login novamente.')
      }

      const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
      const endpoint = `${base}/api/estoque/relatorio/pdf`
      return httpRequest('POST', endpoint, { body: params || {}, headers })
    },
    async forecast(params = {}) {
      ensureSupabase()
      const headers = await buildAuthHeaders()
      if (!headers.Authorization) {
        throw new Error('Sessao expirada. Faça login novamente.')
      }

      const base = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
      const query = new URLSearchParams()
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          query.append(key, String(value))
        }
      })
      const endpoint = `${base}/api/estoque/previsao${query.toString() ? `?${query.toString()}` : ''}`
      return httpRequest('GET', endpoint, { headers })
    },
    async forecastUpdate(params = {}) {
      ensureSupabase()
      const { data, error } = await supabase.functions.invoke('forecast-gasto-mensal', {
        body: params || {},
      })
      if (error) {
        throw mapSupabaseError(error, 'Falha ao atualizar previsao.')
      }
      if (!data) {
        throw new Error('Falha ao atualizar previsao.')
      }
      return data?.data ?? data
    },
  },
  statusSaida: {
    async list() {
      const data = await execute(
        supabase.from('status_saida').select('id, status').eq('ativo', true).order('status', { ascending: true }),
        'Falha ao listar status de saida.'
      )
      return (data ?? []).map((item) => ({
        id: item.id,
        status: item.status,
        nome: item.status,
      }))
    },
  },
  statusEntrada: {
    async list() {
      const data = await execute(
        supabase.from('status_entrada').select('id, status').eq('ativo', true).order('status', { ascending: true }),
        'Falha ao listar status de entrada.'
      )
      return (data ?? []).map((item) => ({
        id: item.id,
        status: item.status,
        nome: item.status,
      }))
    },
  },
  acidentes: {
    async list() {
      return carregarAcidentes()
    },
    async agents() {
      try {
        const catalogo = await loadAgenteCatalog(false)
        return (catalogo?.lista ?? [])
          .map((item) => ({ id: item.id ?? null, nome: item.nome }))
          .filter((item) => Boolean(item?.nome))
      } catch (catalogoError) {
        reportClientError('Falha ao carregar agentes do cache, tentando consulta direta.', catalogoError, {
          stage: 'agents_cache_fallback',
        })
      }
      const data = await execute(
        supabase
          .from('acidente_agentes')
          .select('id, nome, ativo')
          .order('nome', { ascending: true }),
        'Falha ao listar agentes de acidente.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => ({
          id: item.id ?? null,
          nome: trim(item.nome),
        }))
        .filter((item) => Boolean(item.nome))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    async parts() {
      const data = await execute(
        supabase
          .from('acidente_partes')
          .select(
            `
              id,
              nome,
              ativo,
              grupo:acidente_partes_grupo(id, nome),
              subgrupo:acidente_partes_sub_grupo(id, nome)
            `
          )
          .order('nome', { ascending: true }),
        'Falha ao listar partes lesionadas.',
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => {
          const grupoNome = trim(item?.grupo?.nome ?? '')
          const subgrupoNome = trim(item?.subgrupo?.nome ?? '')
          const nome = String(item.nome).trim()
          const label = [grupoNome, subgrupoNome, nome]
            .map((parte) => (parte ? String(parte).trim() : ''))
            .filter(Boolean)
            .join(' / ')
          return {
            id: item.id ?? null,
            nome,
            label: label || nome,
            grupoId: item?.grupo?.id ?? null,
            subgrupoId: item?.subgrupo?.id ?? null,
          }
        })
    },

    async lesions(agenteEntrada) {
      const { nome: nomeAgente, id: agenteEntradaId } = normalizeAgenteInput(agenteEntrada)
      let agenteId = agenteEntradaId ?? null
      if (!agenteId && nomeAgente) {
        agenteId = await resolveAgenteId(nomeAgente)
      }
      const filtrarPorNome = !agenteId && Boolean(nomeAgente)
      const alvoNormalizado = filtrarPorNome ? normalizeAgenteLookupKey(nomeAgente) : ''
      let query = supabase
        .from('acidente_lesoes')
        .select('id, agente_id, nome, ativo, agente:acidente_agentes(nome)')
        .order('nome', { ascending: true })
      if (agenteId) {
        query = query.eq('agente_id', agenteId)
      }
      const data = await execute(query, 'Falha ao listar lesoes de acidente.')
      const lista = (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => {
          const nome = String(item.nome).trim()
          const agente = String(item?.agente?.nome ?? '').trim()
          return {
            id: item.id ?? null,
            nome,
            agente,
            agenteId: item.agente_id ?? null,
            label: nome,
          }
        })
        .filter((item) => {
          if (!filtrarPorNome) {
            return true
          }
          return normalizeAgenteLookupKey(item.agente) === alvoNormalizado
        })
      return lista
    },

    async agentTypes(agenteEntrada) {
      const { nome: nomeAgente, id: agenteEntradaId } = normalizeAgenteInput(agenteEntrada)
      if (!nomeAgente && !agenteEntradaId) {
        return []
      }
      let agenteId = agenteEntradaId ?? null
      if (!agenteId && nomeAgente) {
        agenteId = await resolveAgenteId(nomeAgente)
      }
      const filtrarPorNome = !agenteId && Boolean(nomeAgente)
      const alvoNormalizado = filtrarPorNome ? normalizeAgenteLookupKey(nomeAgente) : ''
      let query = supabase
        .from('acidente_tipos')
        .select('id, nome, ativo, agente_id, agente:acidente_agentes(nome)')
        .order('nome', { ascending: true })
      if (agenteId) {
        query = query.eq('agente_id', agenteId)
      }
      const data = await execute(query, 'Falha ao listar tipos de acidente.')
      const tipos = new Map()
      ;(data ?? []).forEach((item) => {
        if (!item || item.ativo === false) {
          return
        }
        const agenteNome = String(item?.agente?.nome ?? '').trim()
        if (filtrarPorNome && normalizeAgenteLookupKey(agenteNome) !== alvoNormalizado) {
          return
        }
        const tipoNome = String(item.nome ?? '').trim()
        if (!tipoNome) {
          return
        }
        const tipoId = item.id ?? null
        const chave = tipoId || tipoNome.toLowerCase()
        if (tipos.has(chave)) {
          return
        }
        tipos.set(chave, {
          id: tipoId,
          nome: tipoNome,
          agente: agenteNome,
          agenteId: item.agente_id ?? null,
          label: tipoNome,
        })
      })
      return Array.from(tipos.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    async locals() {
      const data = await execute(
        supabase
          .from('acidente_locais')
          .select('id, nome, ativo')
          .order('nome', { ascending: true }),
        'Falha ao listar locais de acidente.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => ({
          id: item.id ?? null,
          nome: item.nome.trim(),
        }))
        .filter((item) => Boolean(item.nome))
    },
    async downloadTemplate() {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
      }
      const headers = await buildAuthHeaders()
      const resp = await fetch(`${FUNCTIONS_URL}/acidente-template`, { headers })
      if (!resp.ok) {
        throw new Error('Falha ao baixar modelo de acidentes.')
      }
      const blob = await resp.blob()
      return { blob, filename: 'acidente_template.xlsx' }
    },
    async importPlanilha(file) {
      try {
        if (!file) {
          throw new Error('Selecione um arquivo XLSX.')
        }
        if (!isSupabaseConfigured) {
          throw new Error('Supabase nao configurado.')
        }
        assertFileSizeWithinLimit(file)

        const importsBucket = import.meta.env.VITE_IMPORTS_BUCKET || 'imports'
        const path = `acidentes/${(crypto?.randomUUID?.() ?? Date.now())}-${file.name}`

        const upload = await supabase.storage.from(importsBucket).upload(path, file, {
          contentType:
            file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (upload.error) {
          throw new Error(upload.error.message || 'Falha ao enviar arquivo para o Storage.')
        }

        if (!FUNCTIONS_URL) {
          throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
        }

        const headers = await buildAuthHeaders({
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        })
        const resp = await fetch(`${FUNCTIONS_URL}/acidente-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        })
        const status = resp.status
        const requestId =
          resp.headers.get('x-deno-execution-id') ||
          resp.headers.get('x-sb-request-id') ||
          null
        let responseText = null
        try {
          responseText = await resp.text()
        } catch (_) {
          responseText = null
        }
        let responseJson = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch (_) {
          responseJson = null
        }
        if (!resp.ok) {
          const stage = responseJson?.stage || null
          const responseMessage = responseJson?.message || responseJson?.error || responseText
          const suffixParts = []
          if (stage) suffixParts.push(`stage=${stage}`)
          if (requestId) suffixParts.push(`req=${requestId}`)
          const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : ''
          const friendly =
            responseMessage && String(responseMessage).trim()
              ? `Falha ao importar planilha (${status || 'sem status'}): ${responseMessage}${suffix}`
              : `Falha ao importar planilha (${status || 'sem status'})${suffix}.`

          const enriched = new Error(friendly)
          enriched.details = {
            status,
            stage,
            requestId,
            response: responseMessage,
            function: 'acidente-import',
            bucket: importsBucket,
            path,
          }
          throw enriched
        }
        return responseJson || {}
      } catch (err) {
        const details = err?.details || {}
        reportClientError(
          'Falha ao importar acidentes em massa.',
          err,
          {
            feature: 'acidentes',
            action: 'acidente-import',
            status: details.status,
            code: details.code,
            stage: details.stage,
            function: details.function,
            bucket: details.bucket,
            path: details.path,
            response: details.response,
            requestId: details.requestId,
          },
          'error'
        )
        throw err
      }
    },
    async create(payload) {
      const pessoaId = normalizeUuid(payload.pessoaId ?? payload.peopleId ?? payload.pessoa_id ?? payload.people_id)
      let centroServicoId = normalizeUuid(
        payload.centroServicoId ?? payload.centro_servico_id ?? payload.centroServico_id
      )
      let localId = normalizeUuid(payload.localId ?? payload.local_id)
      const classificacoesPayload = normalizeClassificacoesPayload(payload)
      let agentesIds =
        classificacoesPayload?.agentesIds ?? toUuidArrayOrNulls(payload.agentesIds ?? payload.agentes_ids)
      let tiposIds =
        classificacoesPayload?.tiposIds ?? toUuidArrayOrNulls(payload.tiposIds ?? payload.tipos_ids ?? payload.tipos)
      let lesoesIds =
        classificacoesPayload?.lesoesIds ?? toUuidArrayOrNulls(payload.lesoesIds ?? payload.lesoes_ids ?? payload.lesoes)
      const partesIds = toUuidArrayOrEmpty(
        payload.partesIds ?? payload.partes_ids ?? payload.partesLesionadasIds ?? payload.partes_lesionadas_ids
      )
      if (!agentesIds.length) {
        const agenteFallback = normalizeUuid(payload.agenteId ?? payload.agente_id)
        if (agenteFallback) {
          agentesIds = [agenteFallback]
        }
      }
      const rows = agentesIds.length
      tiposIds = padArrayToLength(tiposIds, rows)
      lesoesIds = padArrayToLength(lesoesIds, rows)

      const data = payload.data ? new Date(payload.data).toISOString() : null
      const dataEsocial = payload.dataEsocial ? new Date(payload.dataEsocial).toISOString() : null
      const dataSesmt = payload.dataSesmt ? new Date(payload.dataSesmt).toISOString() : null
      const sesmt = Boolean(payload.sesmt)
      const esocial = payload.esocial !== undefined ? Boolean(payload.esocial) : Boolean(dataEsocial)

      if (!centroServicoId) {
        const centroNome = trim(payload.centroServico ?? payload.centro_servico ?? payload.setor ?? '')
        if (centroNome) {
          centroServicoId = await resolveReferenceId(
            'centros_servico',
            centroNome,
            'Selecione um centro de servico valido.'
          )
        }
      }

      if (!localId) {
        const localNome = trim(payload.local ?? '')
        if (localNome) {
          localId = await resolveReferenceId(
            'acidente_locais',
            localNome,
            'Selecione um local valido.'
          )
        }
      }

      if (!pessoaId) {
        throw new Error('Selecione um colaborador valido.')
      }
      if (!agentesIds.length || !agentesIds.some(Boolean)) {
        throw new Error('Selecione ao menos um agente valido.')
      }
      if (agentesIds.some((id) => !id)) {
        throw new Error('Agente invalido na classificacao.')
      }
      if (!tiposIds.some(Boolean) && !lesoesIds.some(Boolean)) {
        throw new Error('Informe ao menos um tipo ou lesao.')
      }
      if (!partesIds.length) {
        throw new Error('Informe ao menos uma parte lesionada.')
      }
      if (!centroServicoId) {
        throw new Error('Selecione um centro de servico valido.')
      }
      if (!localId) {
        throw new Error('Selecione um local valido.')
      }
      if (!data) {
        throw new Error('Data do acidente obrigatoria.')
      }

      const usuario = await resolveUsuarioResponsavel()
      const registro = await executeSingle(
        supabase.rpc('rpc_acidentes_create_full', {
          p_pessoa_id: pessoaId,
          p_data: data,
          p_dias_perdidos: toNumber(payload.diasPerdidos),
          p_dias_debitados: toNumber(payload.diasDebitados),
          p_cid: trim(payload.cid),
          p_centro_servico_id: centroServicoId,
          p_local_id: localId,
          p_cat: trim(payload.cat),
          p_observacao: trim(payload.observacao),
          p_data_esocial: dataEsocial,
          p_esocial: esocial,
          p_sesmt: sesmt,
          p_data_sesmt: dataSesmt,
          p_agentes_ids: agentesIds,
          p_tipos_ids: tiposIds,
          p_lesoes_ids: lesoesIds,
          p_partes_ids: partesIds,
          p_registrado_por: usuario,
        }),
        'Falha ao registrar acidente.'
      )

      const completo = await executeMaybeSingle(
        supabase.from('vw_acidentes').select('*').eq('id', registro.id).limit(1),
        'Falha ao obter acidente registrado.'
      )
      return mapAcidenteRecord(completo ?? registro)
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }
      const atual = await executeSingle(
        supabase.from('vw_acidentes').select('*').eq('id', id),
        'Falha ao obter acidente.'
      )
      if (!atual) {
        throw new Error('Acidente nao encontrado.')
      }

      const atualMap = mapAcidenteRecord(atual)
      const pessoaId = normalizeUuid(
        payload.pessoaId ?? payload.peopleId ?? payload.pessoa_id ?? payload.people_id ?? atualMap?.pessoaId
      )
      let centroServicoId = normalizeUuid(
        payload.centroServicoId ?? payload.centro_servico_id ?? payload.centroServico_id ?? atualMap?.centroServicoId
      )
      let localId = normalizeUuid(payload.localId ?? payload.local_id ?? atualMap?.localId)
      const classificacoesPayload = normalizeClassificacoesPayload(payload)
      let agentesIds =
        classificacoesPayload?.agentesIds ??
        toUuidArrayOrNulls(payload.agentesIds ?? payload.agentes_ids ?? atualMap?.agentesIds)
      let tiposIds =
        classificacoesPayload?.tiposIds ??
        toUuidArrayOrNulls(payload.tiposIds ?? payload.tipos_ids ?? payload.tipos ?? atualMap?.tiposIds)
      let lesoesIds =
        classificacoesPayload?.lesoesIds ??
        toUuidArrayOrNulls(payload.lesoesIds ?? payload.lesoes_ids ?? payload.lesoes ?? atualMap?.lesoesIds)
      const partesIds = toUuidArrayOrEmpty(
        payload.partesIds ??
          payload.partes_ids ??
          payload.partesLesionadasIds ??
          payload.partes_lesionadas_ids ??
          atualMap?.partesIds
      )
      if (!agentesIds.length) {
        const agenteFallback = normalizeUuid(payload.agenteId ?? payload.agente_id ?? atualMap?.agenteId)
        if (agenteFallback) {
          agentesIds = [agenteFallback]
        }
      }
      const rows = agentesIds.length
      tiposIds = padArrayToLength(tiposIds, rows)
      lesoesIds = padArrayToLength(lesoesIds, rows)

      const data = payload.data ? new Date(payload.data).toISOString() : atualMap?.data
      const dataEsocial =
        payload.dataEsocial !== undefined
          ? payload.dataEsocial
            ? new Date(payload.dataEsocial).toISOString()
            : null
          : atualMap?.dataEsocial
      const dataSesmt =
        payload.dataSesmt !== undefined
          ? payload.dataSesmt
            ? new Date(payload.dataSesmt).toISOString()
            : null
          : atualMap?.dataSesmt
      const sesmt = payload.sesmt !== undefined ? Boolean(payload.sesmt) : Boolean(atualMap?.sesmt)
      const esocial = payload.esocial !== undefined ? Boolean(payload.esocial) : Boolean(dataEsocial)

      if (!centroServicoId) {
        const centroNome = trim(
          payload.centroServico ?? payload.centro_servico ?? payload.setor ?? atualMap?.centroServico ?? ''
        )
        if (centroNome) {
          centroServicoId = await resolveReferenceId(
            'centros_servico',
            centroNome,
            'Selecione um centro de servico valido.'
          )
        }
      }

      if (!localId) {
        const localNomeFallback = trim(payload.local ?? atualMap?.local ?? '')
        if (localNomeFallback) {
          localId = await resolveReferenceId(
            'acidente_locais',
            localNomeFallback,
            'Selecione um local valido.'
          )
        }
      }

      if (!pessoaId) {
        throw new Error('Selecione um colaborador valido.')
      }
      if (!agentesIds.length || !agentesIds.some(Boolean)) {
        throw new Error('Selecione ao menos um agente valido.')
      }
      if (agentesIds.some((id) => !id)) {
        throw new Error('Agente invalido na classificacao.')
      }
      if (!tiposIds.some(Boolean) && !lesoesIds.some(Boolean)) {
        throw new Error('Informe ao menos um tipo ou lesao.')
      }
      if (!partesIds.length) {
        throw new Error('Informe ao menos uma parte lesionada.')
      }
      if (!centroServicoId) {
        throw new Error('Selecione um centro de servico valido.')
      }
      if (!localId) {
        throw new Error('Selecione um local valido.')
      }
      if (!data) {
        throw new Error('Data do acidente obrigatoria.')
      }

      let agenteNome = trim(payload.agenteNome ?? payload.agente ?? atualMap?.agenteNome ?? atualMap?.agente ?? '')
      let tiposNomes = normalizeStringArray(payload.tipos ?? payload.tiposNomes ?? atualMap?.tipos ?? [])
      if (!tiposNomes.length) {
        tiposNomes = splitMultiValue(payload.tipo ?? atualMap?.tipo ?? '')
      }
      let agentesNomes = normalizeStringArray(payload.agentes ?? payload.agentesNomes ?? atualMap?.agentes ?? [])
      let lesoesNomes = normalizeStringArray(payload.lesoes ?? payload.lesoesNomes ?? atualMap?.lesoes ?? [])
      if (!lesoesNomes.length) {
        const unicaLesao = trim(payload.lesao ?? atualMap?.lesao ?? '')
        if (unicaLesao) {
          lesoesNomes = [unicaLesao]
        }
      }
      if (Array.isArray(payload.classificacoesAgentes) && payload.classificacoesAgentes.length) {
        const nomesTipos = []
        const nomesLesoes = []
        const nomesAgentes = []
        payload.classificacoesAgentes.forEach((item) => {
          if (!item || typeof item !== 'object') {
            return
          }
          const nomeAgente = trim(item.agenteNome ?? item.agente ?? '')
          if (nomeAgente) {
            nomesAgentes.push(nomeAgente)
          }
          const nomeTipo = trim(item.tipoNome ?? item.tipo ?? '')
          if (nomeTipo) {
            nomesTipos.push(nomeTipo)
          }
          const nomeLesao = trim(item.lesaoNome ?? item.lesao ?? '')
          if (nomeLesao) {
            nomesLesoes.push(nomeLesao)
          }
        })
        if (nomesAgentes.length) {
          agenteNome = nomesAgentes[nomesAgentes.length - 1]
          agentesNomes = agentesNomes.length ? agentesNomes : nomesAgentes
          tiposNomes = tiposNomes.length ? tiposNomes : nomesTipos
          lesoesNomes = lesoesNomes.length ? lesoesNomes : nomesLesoes
        }
      }
      let partesNomes = normalizeStringArray(
        payload.partesLesionadas ?? payload.partesNomes ?? atualMap?.partesLesionadas ?? []
      )
      if (!partesNomes.length) {
        const unicaParte = trim(payload.parteLesionada ?? atualMap?.parteLesionada ?? '')
        if (unicaParte) {
          partesNomes = [unicaParte]
        }
      }

      const centroServicoNome = trim(payload.centroServico ?? atualMap?.centroServico ?? '')
      const localNome = trim(payload.local ?? atualMap?.local ?? centroServicoNome)
      const matricula = trim(payload.matricula ?? atualMap?.matricula ?? '')
      const nome = trim(payload.nome ?? atualMap?.nome ?? '')
      const cargo = trim(payload.cargo ?? atualMap?.cargo ?? '')
      const diasPerdidos = toNumber(payload.diasPerdidos ?? atualMap?.diasPerdidos ?? 0)
      const diasDebitados = toNumber(payload.diasDebitados ?? atualMap?.diasDebitados ?? 0)
      const cid = trim(payload.cid ?? atualMap?.cid ?? '')
      const cat = trim(payload.cat ?? atualMap?.cat ?? '')
      const observacao = trim(payload.observacao ?? atualMap?.observacao ?? '')
      const tiposTexto = tiposNomes.join('; ')
      const agentesTexto = agentesNomes.length ? agentesNomes.join('; ') : agenteNome

      const novoComparacao = {
        matricula,
        nome,
        cargo,
        data,
        tipo: tiposTexto,
        agente: agentesTexto,
        lesao: lesoesNomes[0] ?? '',
        lesoes: lesoesNomes,
        partesLesionadas: partesNomes,
        parteLesionada: partesNomes[0] ?? '',
        centroServico: centroServicoNome,
        local: localNome,
        diasPerdidos,
        diasDebitados,
        cid,
        cat,
        observacao,
        dataEsocial,
        sesmt,
        dataSesmt,
      }

      const camposAlterados = []
      ACIDENTE_HISTORY_FIELDS.forEach((campo) => {
        const valorAtual = normalizeHistoryValue(atualMap?.[campo])
        const valorNovo = normalizeHistoryValue(novoComparacao[campo])
        if (valorAtual != valorNovo) {
          camposAlterados.push({
            campo,
            de: valorAtual,
            para: valorNovo,
          })
        }
      })

      const usuario = await resolveUsuarioResponsavel()
      const registro = await executeSingle(
        supabase.rpc('rpc_acidentes_update_full_rehash', {
          p_id: id,
          p_pessoa_id: pessoaId,
          p_data: data,
          p_dias_perdidos: diasPerdidos,
          p_dias_debitados: diasDebitados,
          p_cid: cid,
          p_centro_servico_id: centroServicoId,
          p_local_id: localId,
          p_cat: cat,
          p_observacao: observacao,
          p_data_esocial: dataEsocial,
          p_esocial: esocial,
          p_sesmt: sesmt,
          p_data_sesmt: dataSesmt,
          p_agentes_ids: agentesIds,
          p_tipos_ids: tiposIds,
          p_lesoes_ids: lesoesIds,
          p_partes_ids: partesIds,
          p_atualizado_por: usuario,
          p_campos_alterados: camposAlterados,
        }),
        'Falha ao atualizar acidente.'
      )

      const completo = await executeMaybeSingle(
        supabase.from('vw_acidentes').select('*').eq('id', id).limit(1),
        'Falha ao obter acidente atualizado.'
      )
      return mapAcidenteRecord(completo ?? registro)
    },
    async cancel(id, payload = {}) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }
      const agora = new Date().toISOString()
      const usuario = await resolveUsuarioResponsavel()
      const usuarioId = await resolveUsuarioId()
      const motivo = trim(payload?.motivo ?? payload?.cancelMotivo ?? '')
      const updatePayload = {
        is_active: false,
        updated_at: agora,
        cancel_reason: motivo || null,
      }
      if (usuarioId) {
        updatePayload.updated_by_username = usuarioId
      }
      const registro = await executeSingle(
        supabase
          .from('accidents')
          .update(updatePayload)
          .eq('id', id)
          .select(),
        'Falha ao cancelar acidente.'
      )

      const historicoRegistro = {
        acidente_id: id,
        data_edicao: agora,
        usuario_responsavel: usuario,
        campos_alterados: [
          { campo: 'ativo', de: true, para: false },
          { campo: 'cancelMotivo', de: '', para: motivo || '' },
        ],
      }
      try {
        await execute(
          supabase.from('acidente_historico').insert(historicoRegistro),
          'Falha ao registrar historico do acidente.'
        )
      } catch (err) {
        reportClientError('Nao foi possivel registrar historico do acidente ao cancelar.', err, { id })
      }

      const completo = await executeMaybeSingle(
        supabase.from('vw_acidentes').select('*').eq('id', id).limit(1),
        'Falha ao obter acidente cancelado.'
      )
      return mapAcidenteRecord(completo ?? registro)
    },
    async history(id) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }
      const data = await execute(
        supabase
          .from('acidente_historico')
          .select('id, data_edicao, usuario_responsavel, campos_alterados')
          .eq('acidente_id', id)
          .order('data_edicao', { ascending: false }),
        'Falha ao obter historico do acidente.'
      )
      const registros = data ?? []
      const responsaveisIds = Array.from(
        new Set(
          registros
            .map((item) => (item.usuario_responsavel ?? item.usuarioResponsavel ?? '').trim())
            .filter(Boolean)
        )
      )
      const responsaveisUuid = responsaveisIds.filter((valor) => isUuidValue(valor))
      let usuarioNomeMap = new Map()
      if (responsaveisUuid.length > 0) {
        try {
          const usuarios = await execute(
            supabase.from('app_users').select('id, display_name, username, email').in('id', responsaveisUuid),
            'Falha ao consultar usuarios do historico de acidentes.'
          )
          usuarioNomeMap = new Map(
            (usuarios ?? [])
              .filter((usuario) => usuario?.id)
              .map((usuario) => [
                usuario.id,
                resolveTextValue(usuario.display_name ?? usuario.username ?? usuario.email ?? usuario.id),
              ])
          )
        } catch (usuarioError) {
          reportClientError(
            'Nao foi possivel resolver nomes dos usuarios do historico de acidentes.',
            usuarioError,
            { ids: responsaveisIds }
          )
        }
      }
      return registros.map((item) => {
        const usuarioId = (item.usuario_responsavel ?? item.usuarioResponsavel ?? '').trim()
        const usuarioNome = usuarioId
          ? isUuidValue(usuarioId)
            ? usuarioNomeMap.get(usuarioId) ?? usuarioId
            : usuarioId
          : 'Responsavel nao informado'
        return {
          id: item.id,
          dataEdicao: item.data_edicao ?? item.dataEdicao ?? null,
          usuarioResponsavel: usuarioNome,
          usuarioResponsavelId: usuarioId || null,
          camposAlterados: Array.isArray(item.campos_alterados ?? item.camposAlterados)
            ? item.campos_alterados ?? item.camposAlterados
            : [],
        }
      })
    },

    async dashboard(params = {}) {
      const inicio = sanitizeMonthRef(params?.periodoInicio) || null
      const fim = sanitizeMonthRef(params?.periodoFim) || null
      const anoFiltro = Number.isFinite(Number(params?.ano)) ? Number(params.ano) : null

      try {
        let query = supabase.from('vw_indicadores_acidentes').select('*')
        if (anoFiltro !== null) {
          query = query.eq('ano', anoFiltro)
        }
        const dadosView = await execute(query, 'Falha ao carregar indicadores de acidentes (SQL).')
        const lista = Array.isArray(dadosView) ? dadosView : []
        if (lista.length > 0) {
          return mapDashboardFromView(lista[0], inicio, fim)
        }
      } catch (error) {
        reportClientError('Falha ao carregar dashboard de acidentes via view SQL; usando calculo local.', error, {
          area: 'dashboard_acidentes_sql',
        })
      }

      const acidentes = await carregarAcidentes()
      let hhtMensal = []
      try {
        const dadosHht = await execute(
          supabase
            .from('hht_mensal_view')
            .select('mes_ref, centro_servico_nome, hht_final, status_nome'),
          'Falha ao listar HHT mensal para dashboard.'
        )
        const lista = Array.isArray(dadosHht) ? dadosHht : []
        hhtMensal = lista.filter((item) => {
          const mesRef = String(item?.mes_ref ?? '').slice(0, 7)
          if (inicio && mesRef && mesRef < inicio) return false
          if (fim && mesRef && mesRef > fim) return false
          return true
        })
      } catch (error) {
        reportClientError('Nao foi possivel carregar HHT mensal para dashboard.', error)
      }
      return montarDashboardAcidentes(acidentes, params, hhtMensal)
    },
  },
  hhtMensal: {
    async list(params = {}) {
      const centroServicoId = normalizeUuid(params.centroServicoId ?? params.centro_servico_id)
      const centroServicoNome = trim(params.centroServicoNome ?? params.centro_servico_nome ?? '')
      const mesInicio = trim(params.mesInicio ?? params.mes_inicio ?? '')
      const mesFim = trim(params.mesFim ?? params.mes_fim ?? '')
      const incluirInativos = params.incluirInativos === true || params.incluir_inativos === true

      const toMonthRef = (value) => {
        const raw = trim(value)
        if (!raw) {
          return null
        }
        if (/^\d{4}-\d{2}$/.test(raw)) {
          return `${raw}-01`
        }
        const datePart = raw.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return `${datePart.slice(0, 7)}-01`
        }
        const iso = toDateOnlyIso(raw)
        if (!iso) {
          return null
        }
        return `${iso.slice(0, 7)}-01`
      }

      const mapRecord = (registro) => {
        const createdBy = registro.created_by ?? null
        const updatedBy = registro.updated_by ?? null
        return {
          id: registro.id,
          mesRef: registro.mes_ref ?? null,
          centroServicoId: registro.centro_servico_id ?? null,
          centroServicoNome: resolveTextValue(registro?.centro_servico_nome ?? ''),
          statusId: registro.status_hht_id ?? null,
          statusNome: resolveTextValue(registro?.status_nome ?? ''),
          qtdPessoas: toNumber(registro.qtd_pessoas, 0),
          horasMesBase: toNumber(registro.horas_mes_base, 0),
          escalaFactor: toNumber(registro.escala_factor, 1),
          horasAfastamento: toNumber(registro.horas_afastamento, 0),
          horasFerias: toNumber(registro.horas_ferias, 0),
          horasTreinamento: toNumber(registro.horas_treinamento, 0),
          horasOutrosDescontos: toNumber(registro.horas_outros_descontos, 0),
          horasExtras: toNumber(registro.horas_extras, 0),
          modo: trim(registro.modo),
          hhtInformado: toNullableNumber(registro.hht_informado),
          hhtCalculado: toNumber(registro.hht_calculado, 0),
          hhtFinal: toNumber(registro.hht_final, 0),
          createdAt: registro.created_at ?? null,
          createdBy: createdBy,
          createdByName: resolveTextValue(registro.created_by_username ?? registro.created_by_name ?? ''),
          updatedAt: registro.updated_at ?? null,
          updatedBy: updatedBy,
          updatedByName: resolveTextValue(registro.updated_by_username ?? registro.updated_by_name ?? ''),
        }
      }

      let query = supabase
        .from('hht_mensal_view')
        .select(
          `
          id,
          mes_ref,
          centro_servico_id,
          centro_servico_nome,
          status_hht_id,
          status_nome,
          qtd_pessoas,
          horas_mes_base,
          escala_factor,
          horas_afastamento,
          horas_ferias,
          horas_treinamento,
          horas_outros_descontos,
          horas_extras,
          modo,
          hht_informado,
          hht_calculado,
          hht_final,
          created_at,
          created_by,
          created_by_name,
          created_by_username,
          updated_at,
          updated_by,
          updated_by_name,
          updated_by_username
        `
        )
        .order('mes_ref', { ascending: false })
        .order('centro_servico_id', { ascending: true })

      if (centroServicoId) {
        query = query.eq('centro_servico_id', centroServicoId)
      } else if (centroServicoNome) {
        query = query.ilike('centro_servico_nome', centroServicoNome)
      }

      const inicio = toMonthRef(mesInicio)
      if (inicio) {
        query = query.gte('mes_ref', inicio)
      }
      const fim = toMonthRef(mesFim)
      if (fim) {
        query = query.lte('mes_ref', fim)
      }

      if (!incluirInativos) {
        query = query.neq('status_hht.status', 'Cancelado')
      }

      const data = await execute(query, 'Falha ao listar HHT mensal.')
      return (data ?? []).map((registro) => mapRecord(registro, new Map()))
    },

    async create(payload) {
      const mesRef = trim(payload.mesRef ?? payload.mes_ref ?? '')
      const centroServicoId = normalizeUuid(payload.centroServicoId ?? payload.centro_servico_id)
      let statusHhtId = normalizeUuid(payload.statusHhtId ?? payload.status_hht_id)
      if (!mesRef) {
        throw new Error('Informe o mes de referencia.')
      }
      if (!centroServicoId) {
        throw new Error('Selecione um centro de servico valido.')
      }
      if (!statusHhtId) {
        statusHhtId = await resolveStatusHhtDefaultId()
      }
      if (!statusHhtId) {
        throw new Error('Status do HHT mensal nao encontrado.')
      }

      const registro = await executeSingle(
        supabase.rpc('rpc_hht_mensal_create_full', {
          p_mes_ref: mesRef,
          p_centro_servico_id: centroServicoId,
          p_status_hht_id: statusHhtId,
          p_qtd_pessoas: toNumber(payload.qtdPessoas ?? payload.qtd_pessoas, 0),
          p_horas_mes_base: toNumber(payload.horasMesBase ?? payload.horas_mes_base, 0),
          p_escala_factor: toNumber(payload.escalaFactor ?? payload.escala_factor, 1),
          p_horas_afastamento: toNumber(payload.horasAfastamento ?? payload.horas_afastamento, 0),
          p_horas_ferias: toNumber(payload.horasFerias ?? payload.horas_ferias, 0),
          p_horas_treinamento: toNumber(payload.horasTreinamento ?? payload.horas_treinamento, 0),
          p_horas_outros_descontos: toNumber(
            payload.horasOutrosDescontos ?? payload.horas_outros_descontos,
            0,
          ),
          p_horas_extras: toNumber(payload.horasExtras ?? payload.horas_extras, 0),
          p_modo: trim(payload.modo),
          p_hht_informado: toNullableNumber(payload.hhtInformado ?? payload.hht_informado),
        }),
        'Falha ao criar HHT mensal.'
      )

      const statusHhtNome = await resolveStatusHhtNome(registro?.status_hht_id ?? statusHhtId)
      if (Number.isFinite(registro?.hht_final) && statusHhtNome.toLowerCase() !== 'cancelado') {
        await syncAcidentesHht(registro.centro_servico_id, registro.mes_ref, registro.hht_final)
      }
      const centroServicoNome = await resolveCentroServicoNome(registro?.centro_servico_id ?? centroServicoId)

      return {
        id: registro.id,
        mesRef: registro.mes_ref ?? null,
        centroServicoId: registro.centro_servico_id ?? null,
        centroServicoNome,
        qtdPessoas: toNumber(registro.qtd_pessoas, 0),
        horasMesBase: toNumber(registro.horas_mes_base, 0),
        escalaFactor: toNumber(registro.escala_factor, 1),
        horasAfastamento: toNumber(registro.horas_afastamento, 0),
        horasFerias: toNumber(registro.horas_ferias, 0),
        horasTreinamento: toNumber(registro.horas_treinamento, 0),
        horasOutrosDescontos: toNumber(registro.horas_outros_descontos, 0),
        horasExtras: toNumber(registro.horas_extras, 0),
        modo: trim(registro.modo),
        hhtInformado: toNullableNumber(registro.hht_informado),
        hhtCalculado: toNumber(registro.hht_calculado, 0),
        hhtFinal: toNumber(registro.hht_final, 0),
        createdAt: registro.created_at ?? null,
        createdBy: registro.created_by ?? null,
        updatedAt: registro.updated_at ?? null,
        updatedBy: registro.updated_by ?? null,
      }
    },

    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }

      const mesRef = payload.mesRef ?? payload.mes_ref
      const centroServicoId = payload.centroServicoId ?? payload.centro_servico_id
      let statusHhtId = normalizeUuid(payload.statusHhtId ?? payload.status_hht_id)
      if (!statusHhtId) {
        statusHhtId = await resolveStatusHhtDefaultId()
      }
      if (!statusHhtId) {
        throw new Error('Status do HHT mensal nao encontrado.')
      }

      const registro = await executeSingle(
        supabase.rpc('rpc_hht_mensal_update_full', {
          p_id: id,
          p_mes_ref: mesRef ?? null,
          p_centro_servico_id: centroServicoId ?? null,
          p_status_hht_id: statusHhtId ?? null,
          p_qtd_pessoas: payload.qtdPessoas ?? payload.qtd_pessoas ?? null,
          p_horas_mes_base: payload.horasMesBase ?? payload.horas_mes_base ?? null,
          p_escala_factor: payload.escalaFactor ?? payload.escala_factor ?? null,
          p_horas_afastamento: payload.horasAfastamento ?? payload.horas_afastamento ?? null,
          p_horas_ferias: payload.horasFerias ?? payload.horas_ferias ?? null,
          p_horas_treinamento: payload.horasTreinamento ?? payload.horas_treinamento ?? null,
          p_horas_outros_descontos: payload.horasOutrosDescontos ?? payload.horas_outros_descontos ?? null,
          p_horas_extras: payload.horasExtras ?? payload.horas_extras ?? null,
          p_modo: payload.modo ?? null,
          p_hht_informado: payload.hhtInformado ?? payload.hht_informado ?? null,
        }),
        'Falha ao atualizar HHT mensal.'
      )

      const statusHhtNome = await resolveStatusHhtNome(registro?.status_hht_id ?? statusHhtId)
      if (Number.isFinite(registro?.hht_final) && statusHhtNome.toLowerCase() !== 'cancelado') {
        await syncAcidentesHht(registro.centro_servico_id, registro.mes_ref, registro.hht_final)
      }
      const centroServicoNome = await resolveCentroServicoNome(registro?.centro_servico_id ?? centroServicoId)

      return {
        id: registro.id,
        mesRef: registro.mes_ref ?? null,
        centroServicoId: registro.centro_servico_id ?? null,
        centroServicoNome,
        qtdPessoas: toNumber(registro.qtd_pessoas, 0),
        horasMesBase: toNumber(registro.horas_mes_base, 0),
        escalaFactor: toNumber(registro.escala_factor, 1),
        horasAfastamento: toNumber(registro.horas_afastamento, 0),
        horasFerias: toNumber(registro.horas_ferias, 0),
        horasTreinamento: toNumber(registro.horas_treinamento, 0),
        horasOutrosDescontos: toNumber(registro.horas_outros_descontos, 0),
        horasExtras: toNumber(registro.horas_extras, 0),
        modo: trim(registro.modo),
        hhtInformado: toNullableNumber(registro.hht_informado),
        hhtCalculado: toNumber(registro.hht_calculado, 0),
        hhtFinal: toNumber(registro.hht_final, 0),
        createdAt: registro.created_at ?? null,
        createdBy: registro.created_by ?? null,
        updatedAt: registro.updated_at ?? null,
        updatedBy: registro.updated_by ?? null,
      }
    },

    async delete(id, motivo = '') {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }
      const textoMotivo = trim(motivo)
      await execute(
        supabase.rpc('hht_mensal_delete', {
          p_id: id,
          p_motivo: textoMotivo,
        }),
        'Falha ao cancelar HHT mensal.'
      )
      return true
    },

    async history(id) {
      if (!id) {
        throw new Error('ID obrigatorio.')
      }
      const data = await execute(
        supabase
          .from('hht_mensal_hist')
          .select('id, acao, alterado_em, alterado_por, antes, depois, motivo')
          .eq('hht_mensal_id', id)
          .order('alterado_em', { ascending: false }),
        'Falha ao obter historico do HHT mensal.'
      )
      const registros = data ?? []
      // Coleta IDs de usuarios e de status para resolver nomes.
      const responsaveisIds = Array.from(
        new Set(registros.map((item) => item?.alterado_por).filter((value) => Boolean(value)))
      )
      const statusIds = Array.from(
        new Set(
          registros
            .map((item) => [item?.antes?.status_hht_id, item?.antes?.statusHhtId, item?.depois?.status_hht_id, item?.depois?.statusHhtId])
            .flat()
            .filter((value) => Boolean(value))
        )
      )
      let usuarioNomeMap = new Map()
      if (responsaveisIds.length > 0) {
        try {
          const usuarios = await execute(
            supabase.from('app_users').select('id, display_name, username, email').in('id', responsaveisIds),
            'Falha ao consultar usuarios do historico de HHT mensal.'
          )
          usuarioNomeMap = new Map(
            (usuarios ?? [])
              .filter((usuario) => usuario?.id)
              .map((usuario) => [
                usuario.id,
                resolveTextValue(usuario.display_name ?? usuario.username ?? usuario.email ?? usuario.id),
              ])
          )
        } catch (usuarioError) {
          reportClientError(
            'Nao foi possivel resolver nomes dos usuarios do historico de HHT mensal.',
            usuarioError,
            { ids: responsaveisIds }
          )
        }
      }
      let statusNomeMap = new Map()
      if (statusIds.length > 0) {
        try {
          const statusRegistros = await execute(
            supabase.from('status_hht').select('id, status').in('id', statusIds),
            'Falha ao consultar status_hht.'
          )
          statusNomeMap = new Map(
            (statusRegistros ?? []).filter((item) => item?.id).map((item) => [item.id, resolveTextValue(item.status ?? '')])
          )
        } catch (statusError) {
          reportClientError('Nao foi possivel resolver nomes de status_hht.', statusError, { statusIds })
        }
      }

      const mapStatus = (obj) => {
        if (!obj || typeof obj !== 'object') return obj
        const clone = { ...obj }
        const statusValor = clone.status_hht_id ?? clone.statusHhtId ?? null
        if (statusValor && statusNomeMap.has(statusValor)) {
          clone.status_hht_id = statusNomeMap.get(statusValor)
          clone.statusHhtId = statusNomeMap.get(statusValor)
        }
        return clone
      }

      return registros.map((item) => {
        const usuarioId = item?.alterado_por ?? null
        const usuarioNome = usuarioId ? usuarioNomeMap.get(usuarioId) ?? usuarioId : 'Responsavel nao informado'
        return {
          id: item.id,
          acao: trim(item.acao),
          alteradoEm: item.alterado_em ?? null,
          alteradoPorId: usuarioId,
          alteradoPor: usuarioNome,
          antes: mapStatus(item.antes ?? null),
          depois: mapStatus(item.depois ?? null),
          motivo: item.motivo ?? null,
        }
      })
    },

    async peopleCount(params = {}) {
      const centroServicoId = normalizeUuid(params.centroServicoId ?? params.centro_servico_id)
      if (!centroServicoId) {
        throw new Error('Selecione um centro de servico valido.')
      }
      const data = await execute(
        supabase.rpc('rpc_pessoas_count_centro', { p_centro_servico_id: centroServicoId }),
        'Falha ao obter quantidade de pessoas por centro.'
      )
      const registro = Array.isArray(data) ? data[0] : data ?? {}
      const totalBruto = registro?.total ?? registro?.count ?? registro?.qtd ?? 0
      return Number(totalBruto) || 0
    },
  },
  references: {
    async pessoas() {
      const [centros, setores, cargos, tipos] = await Promise.all([
        execute(
          supabase.rpc('rpc_catalog_list', { p_table: 'centros_servico' }),
          'Falha ao carregar centros de servico.'
        ),
        execute(
          supabase.rpc('rpc_catalog_list', { p_table: 'setores' }),
          'Falha ao carregar setores.'
        ),
        execute(
          supabase.rpc('rpc_catalog_list', { p_table: 'cargos' }),
          'Falha ao carregar cargos.'
        ),
        execute(
          supabase.rpc('rpc_catalog_list', { p_table: 'tipo_execucao' }),
          'Falha ao carregar tipos de execucao.'
        ),
      ])
      return {
        centrosServico: normalizeDomainOptions(centros),
        setores: normalizeDomainOptions(setores),
        cargos: normalizeDomainOptions(cargos),
        tiposExecucao: normalizeDomainOptions(tipos),
      }
    },
  },
  basicRegistration: {
    async list(params = {}) {
      const { table, termo, ativo } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      let query = supabase.from(key).select(config.select)
      const termoBase = trim(termo)
      if (termoBase) {
        const like = `%${termoBase.replace(/\s+/g, '%')}%`
        query = query.ilike(config.nameColumn, like)
      }
      if (ativo === true || ativo === false) {
        query = query.eq('ativo', ativo)
      }
      query = query.order('ativo', { ascending: false })
      config.order.forEach((column) => {
        query = query.order(column, { ascending: true })
      })
      const data = await execute(query, 'Falha ao listar cadastro base.')
      return (data ?? []).map((record) => mapBasicRegistrationRecord(key, record))
    },
    async create(params = {}) {
      const { table, data } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      const nome = trim(data?.nome)
      if (!nome) {
        throw new Error('Informe o nome para cadastro.')
      }
      const actorId = data?.usuarioId || (await resolveUsuarioId())
      const payload = {
        [config.nameColumn]: nome,
        ativo: data?.ativo !== false,
        created_by_user_id: actorId,
        updated_by_user_id: actorId,
      }
      if (data?.usuarioNome) {
        payload.created_by_user_name = data.usuarioNome
        payload.updated_by_user_name = data.usuarioNome
      }
      if (key === 'centros_servico' && data?.centroCustoId) {
        payload.centro_custo_id = data.centroCustoId
      }
      if (key === 'centros_estoque' && data?.centroCustoId) {
        payload.centro_custo = data.centroCustoId
      }
      if (key === 'setores' && data?.centroServicoId) {
        payload.centro_servico_id = data.centroServicoId
      }
      const record = await execute(
        supabase.from(key).insert(payload).select(config.select).single(),
        'Falha ao cadastrar item.'
      )
      clearCatalogCache(key)
      return mapBasicRegistrationRecord(key, record)
    },
    async update(params = {}) {
      const { table, id, data } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      if (!id) {
        throw new Error('ID obrigatorio para atualizar.')
      }
      const actorId = data?.usuarioId || (await resolveUsuarioId())
      const payload = {}
      if (data?.nome !== undefined) {
        const nome = trim(data.nome)
        if (!nome) {
          throw new Error('Informe o nome para cadastro.')
        }
        payload[config.nameColumn] = nome
      }
      if (data?.ativo !== undefined) {
        payload.ativo = data.ativo !== false
      }
      if (actorId) {
        payload.updated_by_user_id = actorId
      }
      if (data?.usuarioNome) {
        payload.updated_by_user_name = data.usuarioNome
      }
      if (key === 'centros_servico' && data?.centroCustoId !== undefined) {
        payload.centro_custo_id = data.centroCustoId || null
      }
      if (key === 'centros_estoque' && data?.centroCustoId !== undefined) {
        payload.centro_custo = data.centroCustoId || null
      }
      if (key === 'setores' && data?.centroServicoId !== undefined) {
        payload.centro_servico_id = data.centroServicoId || null
      }
      const record = await execute(
        supabase.from(key).update(payload).eq('id', id).select(config.select).single(),
        'Falha ao atualizar item.'
      )
      clearCatalogCache(key)
      return mapBasicRegistrationRecord(key, record)
    },
    async inactivate(params = {}) {
      const { table, id } = params
      return this.update({ table, id, data: { ativo: false } })
    },
    async history(params = {}) {
      const { table, recordId, limit = 50 } = params
      const { key } = resolveBasicRegistrationConfig(table)
      if (!recordId) {
        throw new Error('ID obrigatorio para historico.')
      }
      const data = await execute(
        supabase
          .from('basic_registration_history')
          .select(
            'id, table_name, record_id, record_name, action, changed_fields, before, after, record_created_at, record_updated_at, record_created_by_user_id, record_updated_by_user_id, changed_by_user_id, created_at, changed_by_user:changed_by_user_id(id,username,display_name,email)'
          )
          .eq('table_name', key)
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
          .limit(limit),
        'Falha ao consultar historico.'
      )
      return (data ?? []).map((registro) => ({
        ...registro,
        changedByUserName: resolveUserLabel(registro?.changed_by_user || registro?.changed_by_user_id),
      }))
    },
    async downloadTemplate(params = {}) {
      if (!FUNCTIONS_URL) {
        throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
      }
      const { table } = params
      const { key } = resolveBasicRegistrationConfig(table)
      const headers = await buildAuthHeaders()
      const resp = await fetch(`${FUNCTIONS_URL}/cadastro-base-template?table=${encodeURIComponent(key)}`, { headers })
      if (!resp.ok) {
        throw new Error('Falha ao baixar modelo de cadastro base.')
      }
      const blob = await resp.blob()
      return { blob, filename: `${key}_template.xlsx` }
    },
    async importPlanilha(params = {}) {
      try {
        const { table, file } = params
        if (!file) {
          throw new Error('Selecione um arquivo XLSX.')
        }
        if (!isSupabaseConfigured) {
          throw new Error('Supabase nao configurado.')
        }
        assertFileSizeWithinLimit(file)
        const { key } = resolveBasicRegistrationConfig(table)

        const importsBucket = import.meta.env.VITE_IMPORTS_BUCKET || 'imports'
        const path = `cadastro-base/${key}/${(crypto?.randomUUID?.() ?? Date.now())}-${file.name}`

        const upload = await supabase.storage.from(importsBucket).upload(path, file, {
          contentType:
            file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (upload.error) {
          throw new Error(upload.error.message || 'Falha ao enviar arquivo para o Storage.')
        }

        if (!FUNCTIONS_URL) {
          throw new Error('VITE_SUPABASE_FUNCTIONS_URL nao configurada.')
        }

        const headers = await buildAuthHeaders({
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        })
        const resp = await fetch(`${FUNCTIONS_URL}/cadastro-base-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path, table: key }),
        })
        const status = resp.status
        const requestId =
          resp.headers.get('x-deno-execution-id') ||
          resp.headers.get('x-sb-request-id') ||
          null
        let responseText = null
        try {
          responseText = await resp.text()
        } catch (_) {
          responseText = null
        }
        let responseJson = null
        try {
          responseJson = responseText ? JSON.parse(responseText) : null
        } catch (_) {
          responseJson = null
        }
        if (!resp.ok) {
          const stage = responseJson?.stage || null
          const responseMessage = responseJson?.message || responseJson?.error || responseText
          const suffixParts = []
          if (stage) suffixParts.push(`stage=${stage}`)
          if (requestId) suffixParts.push(`req=${requestId}`)
          const suffix = suffixParts.length ? ` (${suffixParts.join(', ')})` : ''
          const friendly =
            responseMessage && String(responseMessage).trim()
              ? `Falha ao importar planilha (${status || 'sem status'}): ${responseMessage}${suffix}`
              : `Falha ao importar planilha (${status || 'sem status'})${suffix}.`

          const enriched = new Error(friendly)
          enriched.details = {
            status,
            stage,
            requestId,
            response: responseMessage,
            function: 'cadastro-base-import',
            bucket: importsBucket,
            path,
            table: key,
          }
          throw enriched
        }
        return responseJson || {}
      } catch (err) {
        const details = err?.details || {}
        reportClientError(
          'Falha ao importar cadastro base em massa.',
          err,
          {
            feature: 'cadastro-base',
            action: 'cadastro-base-import',
            status: details.status,
            code: details.code,
            stage: details.stage,
            function: details.function,
            bucket: details.bucket,
            path: details.path,
            table: details.table,
            response: details.response,
            requestId: details.requestId,
          },
          'error'
        )
        throw err
      }
    },
  },
  centrosEstoque: {
    async list() {
      return carregarCentrosEstoqueCatalogo()
    },
  },
  centrosCusto: {
    async list() {
      return carregarCentrosCusto()
    },
  },
  centrosServico: {
    async list() {
      return carregarCentrosServico()
    },
  },
  documentos: {
    async termoEpiContext(params = {}) {
      const matricula = trim(params.matricula)
      const nome = trim(params.nome)
      const dataInicioIso = toStartOfDayUtcIso(params.dataInicio)
      const dataFimIso = toEndOfDayUtcIso(params.dataFim)
      if (params.dataInicio && !dataInicioIso) {
        throw new Error('Data inicial invalida.')
      }
      if (params.dataFim && !dataFimIso) {
        throw new Error('Data final invalida.')
      }
      if (dataInicioIso && dataFimIso && new Date(dataInicioIso).getTime() > new Date(dataFimIso).getTime()) {
        throw new Error('Data inicial nao pode ser maior que a data final.')
      }
      if (!matricula && !nome) {
        throw new Error('Informe a matricula ou o nome do colaborador.')
      }

      let pessoa = null
      if (matricula) {
        pessoa = await executeSingle(
          buildPessoasViewQuery().eq('matricula', matricula),
          'Falha ao consultar colaborador.'
        )
      }
      if (!pessoa && nome) {
        const like = `%${nome.replace(/\s+/g, '%')}%`
        const resultados = await execute(
          buildPessoasViewQuery().ilike('nome', like).order('nome').limit(1),
          'Falha ao consultar colaborador.'
        )
        pessoa = resultados?.[0] ?? null
      }

      if (!pessoa) {
        throw new Error('Colaborador nao encontrado.')
      }

      let saidasQuery = supabase
        .from('saidas')
        .select(
          `*, material:materialId (*), pessoa:pessoaId (*)`
        )
        .eq('pessoaId', pessoa.id)

      if (dataInicioIso || dataFimIso) {
        saidasQuery = buildDateFilters(saidasQuery, 'dataEntrega', dataInicioIso, dataFimIso)
      }

      const saidas = await execute(
        saidasQuery.order('dataEntrega', { ascending: true }),
        'Falha ao listar saidas do colaborador.'
      )

      if (!saidas || saidas.length === 0) {
        const hasPeriodo = Boolean(dataInicioIso || dataFimIso)
        const mensagem = hasPeriodo
          ? 'Nenhuma saida registrada para o colaborador informado no periodo selecionado.'
          : 'Nenhuma saida registrada para o colaborador informado.'
        throw new Error(mensagem)
      }

      const saidasOriginais = saidas ?? []
      const saidasBasicas = saidasOriginais.map((registro) => mapSaidaRecord(registro))
      const saidasComUsuarios = await preencherUsuariosResponsaveis(saidasBasicas)
      const saidasComCentros = await preencherCentrosCustoSaidas(saidasComUsuarios)
      const materiaisMap = await carregarMateriaisPorIds(
        saidasComCentros.map((saida) => saida.materialId).filter(Boolean)
      )

      const saidasDetalhadas = saidasComCentros.map((saida, index) => {
        const detalhado = materiaisMap.get(saida.materialId)
        const fallbackMaterial = mapMaterialRecord(saidasOriginais[index]?.material)
        return {
          ...saida,
          material: detalhado ?? fallbackMaterial ?? null,
        }
      })

      const contexto = montarContextoTermoEpi(mapPessoaRecord(pessoa), saidasDetalhadas)
      const logoPrincipal = trim(import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_URL) || '/logo_FAA.png'
      const logoSecundario = trim(import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL)
      return {
        ...contexto,
        empresa: {
          nome: import.meta.env.VITE_TERMO_EPI_EMPRESA_NOME ?? '',
          documento: import.meta.env.VITE_TERMO_EPI_EMPRESA_DOCUMENTO ?? '',
          endereco: import.meta.env.VITE_TERMO_EPI_EMPRESA_ENDERECO ?? '',
          contato: import.meta.env.VITE_TERMO_EPI_EMPRESA_CONTATO ?? '',
          logoUrl: logoPrincipal,
          logoSecundarioUrl: logoSecundario ?? '',
        },
      }
    },
  },
}

async function resolveReferenceId(table, value, errorMessage) {
  const nome = trim(value)
  if (!nome) {
    throw new Error(errorMessage ?? ('Informe um valor para ' + table + '.'))
  }

  const encontrado = await execute(
    supabase.rpc('rpc_catalog_resolve', { p_table: table, p_nome: nome }),
    'Falha ao consultar ' + table + '.'
  )
  if (!encontrado || !isUuidValue(encontrado)) {
    throw new Error(errorMessage ?? ('Valor "' + nome + '" nao encontrado.'))
  }
  return encontrado
}

async function resolveCentroCustoId(dados, centroServicoId) {
  const nome = trim(dados.centroCusto ?? dados.centro_custo ?? '')

  if (centroServicoId) {
    const centroCustoDireto = await execute(
      supabase.rpc('rpc_centro_servico_centro_custo', { p_centro_servico_id: centroServicoId }),
      'Falha ao consultar centros de custo.'
    )
    if (centroCustoDireto && isUuidValue(centroCustoDireto)) {
      return centroCustoDireto
    }
  }

  if (nome) {
    const centroCustoId = await execute(
      supabase.rpc('rpc_catalog_resolve', { p_table: 'centros_custo', p_nome: nome }),
      'Falha ao consultar centros de custo.'
    )
    if (centroCustoId && isUuidValue(centroCustoId)) {
      return centroCustoId
    }
  }

  throw new Error('Selecione um centro de custo valido.')
}

async function resolvePessoaReferencias(dados) {
  const centroServicoId = await resolveReferenceId(
    'centros_servico',
    dados.centroServico,
    'Selecione um centro de servico valido.'
  )
  const setorNome = dados.setor || dados.centroServico
  const setorId = await resolveReferenceId(
    'setores',
    setorNome,
    'Selecione um setor valido.'
  )
  const cargoId = await resolveReferenceId(
    'cargos',
    dados.cargo,
    'Selecione um cargo valido.'
  )
  const centroCustoId = await resolveCentroCustoId(dados, centroServicoId)
  const tipoExecucaoId = await resolveReferenceId(
    'tipo_execucao',
    dados.tipoExecucao || 'PROPRIO',
    'Selecione o tipo de execucao.'
  )
  return {
    centroServicoId,
    setorId,
    cargoId,
    centroCustoId,
    tipoExecucaoId,
  }
}
async function carregarPessoasViewDetalhes(ids) {
  const selecionados = Array.from(new Set((ids || []).filter(Boolean)))
  if (selecionados.length === 0) {
    return new Map()
  }
  try {
    const registros = await execute(
      buildPessoasViewQuery().in('id', selecionados),
      'Falha ao consultar pessoas_view.'
    )
    const mapa = new Map()
    ;(registros ?? []).forEach((registro) => {
      const pessoa = mapPessoaRecord(registro)
      if (!pessoa?.id) {
        return
      }
      mapa.set(pessoa.id, pessoa)
    })
    return mapa
  } catch (error) {
    reportClientError('Nao foi possivel usar pessoas_view como fallback.', error, { ids: selecionados })
    return new Map()
  }
}


