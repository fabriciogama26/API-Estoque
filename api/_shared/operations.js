import { randomUUID } from 'node:crypto'
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
import { resolveUsuarioNome } from './auth.js'
import { createHttpError } from './http.js'

const GENERIC_SUPABASE_ERROR = 'Falha ao comunicar com o Supabase.'

const DEFAULT_MATERIAIS_VIEW = 'vw_materiais_vinculos'
const MATERIAIS_VIEW = process.env.MATERIAIS_VIEW || DEFAULT_MATERIAIS_VIEW
const MATERIAL_COR_RELATION_TABLE = 'material_grupo_cor'
const MATERIAL_CARACTERISTICA_RELATION_TABLE = 'material_grupo_caracteristica_epi'

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
  return data
}

async function executeSingle(builder, fallbackMessage) {
  const { data, error } = await builder.single()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  return data
}

async function executeMaybeSingle(builder, fallbackMessage) {
  const { data, error } = await builder.maybeSingle()
  if (error) {
    throw mapSupabaseError(error, fallbackMessage)
  return data
}

function mapSupabaseError(error, fallbackMessage = GENERIC_SUPABASE_ERROR) {
  if (!error) {
    return createHttpError(500, fallbackMessage)
  const message = error.message || fallbackMessage
  const httpError = createHttpError(error.status || 500, message)
  httpError.code = error.code
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
  return String(value).trim()
}

const normalizeSearchTerm = (value) => (value ? String(value).trim().toLowerCase() : '')

const isAllFilter = (value) => {
  if (value === undefined || value === null) {
    return true
  return String(value).trim().toLowerCase() === 'todos'
}

const toStartOfDayIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return null
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

const toEndOfDayIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return null
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

function matchesEntradaSearch(entrada, termo, materiaisMap) {
  const material = materiaisMap.get(entrada.materialId)
  const alvo = [
    material?.nome || '',
    material?.fabricante || '',
    entrada.centroCusto || '',
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

function validatePessoaPayload(payload) {
  if (!payload.nome) throw createHttpError(400, 'Nome obrigat?rio.')
  if (!payload.matricula) throw createHttpError(400, 'Matr?cula obrigat?ria.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servi?o obrigat?rio.')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigat?rio.')
}

function mapPessoaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  const centroServico = record.centroServico ?? record.local ?? ''
  return {
    ...record,
    centroServico,
    local: record.local ?? centroServico,
}

function mapEntradaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  return {
    ...record,
    centroCusto: record.centroCusto ?? '',
}

function mapSaidaRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  return {
    ...record,
    centroCusto: record.centroCusto ?? '',
    centroServico: record.centroServico ?? '',
}

function mapAcidenteRecord(record) {
  if (!record || typeof record !== 'object') {
    return record
  const centroServico = record.centroServico ?? record.setor ?? ''
  return {
    ...record,
    centroServico,
    setor: record.setor ?? centroServico,
    local: record.local ?? centroServico,
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
  let query = supabaseAdmin.from('pessoas').select('id').eq('matricula', matricula).limit(1)
  if (ignoreId) {
    query = query.neq('id', ignoreId)
  const existente = await executeMaybeSingle(query, 'Falha ao validar matrÃ­cula.')
  if (existente) {
    throw createHttpError(409, 'JÃ¡ existe uma pessoa com essa matrÃ­cula.')
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
  isGrupo(grupoMaterial, 'Vestimenta') || isGrupo(grupoMaterial, 'Proteção das Mãos')

const buildNumeroReferenciaMaterial = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, 'Calçado')) {
    return sanitizeDigits(numeroCalcado)
  }
  if (requiresTamanho(grupoMaterial)) {
    return String(numeroVestimenta || '').trim()
  }
  return ''
}

const buildChaveUnicaMaterial = ({
  grupoMaterial,
  nome,
  fabricante,
  numeroCalcado,
  numeroVestimenta,
  caracteristicas,
  cores,
  ca,
}) => {
  const partes = [
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(grupoMaterial),
  ]

  const numeroReferencia = normalizeKeyPart(numeroCalcado || numeroVestimenta)
  if (numeroReferencia) {
    partes.push(numeroReferencia)
  }

  const caracteristicasNomes = normalizeCatalogoLista(caracteristicas)
  if (caracteristicasNomes.length) {
    partes.push(
      caracteristicasNomes
        .map((item) => normalizeKeyPart(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('||'),
    )
  }

  const coresNomes = normalizeCatalogoLista(cores)
  if (coresNomes.length) {
    partes.push(
      coresNomes
        .map((item) => normalizeKeyPart(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('||'),
    )
  }

  const caNormalizado = normalizeKeyPart(sanitizeDigits(ca))
  if (caNormalizado) {
    partes.push(caNormalizado)
  }

  return partes.join('||')
}

async function sanitizeMaterialPayload(payload = {}) {
  const nome = trim(payload.nome)
  const fabricante = trim(payload.fabricante)
  const grupoMaterial = trim(payload.grupoMaterial)
  const numeroCalcadoRaw = sanitizeDigits(payload.numeroCalcado)
  const numeroVestimentaRaw = trim(payload.numeroVestimenta)
  const numeroCalcado = isGrupo(grupoMaterial, 'Calçado') ? numeroCalcadoRaw : ''
  const numeroVestimenta = requiresTamanho(grupoMaterial) ? numeroVestimentaRaw : ''
  const descricao = trim(payload.descricao)
  const ca = sanitizeDigits(payload.ca)
  const numeroEspecifico = buildNumeroReferenciaMaterial({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  })

  const caracteristicaIds = collectUuidListFromPayload(
    payload,
    CARACTERISTICA_ID_KEYS,
    'características de EPI',
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
    fabricante,
    validadeDias: payload.validadeDias !== undefined ? Number(payload.validadeDias) : null,
    ca,
    valorUnitario: Number(payload.valorUnitario ?? 0),
    estoqueMinimo:
      payload.estoqueMinimo !== undefined && payload.estoqueMinimo !== null
        ? Number(payload.estoqueMinimo)
        : null,
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
    numeroEspecifico,
    descricao,
    chaveUnica: buildChaveUnicaMaterial({
      grupoMaterial,
      nome,
      fabricante,
      numeroCalcado,
      numeroVestimenta,
      caracteristicas,
      cores,
      ca,
    }),
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
  if (!payload.grupoMaterial) throw createHttpError(400, 'Grupo de material obrigatorio.')
  if (!payload.fabricante) throw createHttpError(400, 'Fabricante obrigatorio.')
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw createHttpError(400, 'Validade deve ser maior que zero.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw createHttpError(400, 'Valor unitario deve ser maior que zero.')
  }
  if (isGrupo(payload.grupoMaterial, 'Calçado') && !payload.numeroCalcado) {
    throw createHttpError(400, 'Informe o numero do calcado.')
  }
  if (requiresTamanho(payload.grupoMaterial) && !payload.numeroVestimenta) {
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
    throw createHttpError(400, `Alguns identificadores de ${label} são inválidos.`)
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
    throw createHttpError(400, `${errorLabel} informadas não foram encontradas.`)
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
    errorLabel: 'Características de EPI',
    errorMessage: 'Falha ao consultar características de EPI.',
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

async function replaceMaterialCorVinculos(materialId, corIds) {
  await replaceMaterialRelations({
    table: MATERIAL_COR_RELATION_TABLE,
    materialId,
    columnName: 'grupo_cor_id',
    values: corIds,
    deleteMessage: 'Falha ao limpar vínculos de cores do material.',
    insertMessage: 'Falha ao vincular cores ao material.',
  })
}

async function replaceMaterialCaracteristicaVinculos(materialId, caracteristicaIds) {
  const columnCandidates = ['grupo_caracteristica_epi_id', 'caracteristica_epi_id']
  let lastColumnError = null

  for (const columnName of columnCandidates) {
    try {
      await replaceMaterialRelations({
        table: MATERIAL_CARACTERISTICA_RELATION_TABLE,
        materialId,
        columnName,
        values: caracteristicaIds,
        deleteMessage: 'Falha ao limpar vínculos de características do material.',
        insertMessage: 'Falha ao vincular características ao material.',
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


async function ensureMaterialChaveUnica(chaveUnica, ignoreId) {
  if (!chaveUnica) {
    return

  let query = supabaseAdmin
    .from('materiais')
    .select('id')
    .eq('chaveUnica', chaveUnica)
    .limit(1)

  if (ignoreId) {
    query = query.neq('id', ignoreId)

  const existente = await executeMaybeSingle(query, 'Falha ao validar material.')
  if (existente) {
    throw createHttpError(409, 'Já existe um EPI com essas mesmas informações cadastrado.')
}

function sanitizeEntradaPayload(payload = {}) {
  const dataEntradaRaw = trim(payload.dataEntrada);
  let dataEntradaIso = null;
  if (dataEntradaRaw) {
    const data = new Date(dataEntradaRaw);
    if (Number.isNaN(data.getTime())) {
      throw createHttpError(400, 'Data de entrada invalida.');
    }
    dataEntradaIso = data.toISOString();
  return {
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrada: dataEntradaIso,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
  };
}
function validateEntradaPayload(payload) {
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatorio para entrada.')
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatorio.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servico obrigatorio.')
  if (!payload.dataEntrada) throw createHttpError(400, 'Data de entrada obrigatoria.')
}
function sanitizeSaidaPayload(payload = {}) {
  const dataEntregaRaw = trim(payload.dataEntrega);
  let dataEntregaIso = null;
  if (dataEntregaRaw) {
    const data = new Date(dataEntregaRaw);
    if (Number.isNaN(data.getTime())) {
      throw createHttpError(400, 'Data de entrega invalida.');
    }
    dataEntregaIso = data.toISOString();
  return {
    pessoaId: trim(payload.pessoaId),
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrega: dataEntregaIso,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
    status: trim(payload.status) || 'entregue',
  };
}
function validateSaidaPayload(payload) {
  if (!payload.pessoaId) throw createHttpError(400, 'Pessoa obrigatoria para saida.')
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatorio para saida.')
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatorio.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servico obrigatorio.')
  if (!payload.dataEntrega) throw createHttpError(400, 'Data de entrega obrigatoria.')
}
  if (!payload.pessoaId) throw createHttpError(400, 'Pessoa obrigatÃ³ria para saÃ­da.')
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatÃ³rio para saÃ­da.')
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatÃ³rio.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de serviÃ§o obrigatÃ³rio.')
    throw createHttpError(400, 'Data de entrega invÃ¡lida.')
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
  if (sanitized === null) {
    return null
  if (!/^[0-9]+$/.test(sanitized)) {
    throw createHttpError(400, `${fieldName} deve conter apenas numeros inteiros.`)
  return sanitized
}

function sanitizeNonNegativeInteger(value, { defaultValue = 0, allowNull = false, fieldName = 'Valor' } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (allowNull) {
      return null
    }
    return defaultValue
  if (!/^-?[0-9]+$/.test(String(value).trim())) {
    throw createHttpError(400, `${fieldName} deve ser um numero inteiro.`)
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || Number.isNaN(numeric)) {
    throw createHttpError(400, `${fieldName} deve ser um numero inteiro.`)
  if (numeric < 0) {
    throw createHttpError(400, `${fieldName} nao pode ser negativo.`)
  return numeric
}

function sanitizeAcidentePayload(payload = {}) {
  const centroServico = trim(payload.centroServico ?? payload.setor)
  const local = trim(payload.local)
  const cat = sanitizeOptionalIntegerString(payload.cat, 'CAT')
  return {
    matricula: trim(payload.matricula),
    nome: trim(payload.nome),
    cargo: trim(payload.cargo),
    data: payload.data ? new Date(payload.data).toISOString() : '',
    tipo: trim(payload.tipo),
    agente: trim(payload.agente),
    lesao: trim(payload.lesao),
    parteLesionada: trim(payload.parteLesionada),
    centroServico,
    local: local || centroServico,
    diasPerdidos: sanitizeNonNegativeInteger(payload.diasPerdidos, {
      defaultValue: 0,
      fieldName: 'Dias perdidos',
    }),
    diasDebitados: sanitizeNonNegativeInteger(payload.diasDebitados, {
      defaultValue: 0,
      fieldName: 'Dias debitados',
    }),
    hht: sanitizeNonNegativeInteger(payload.hht, {
      allowNull: true,
      fieldName: 'HHT',
    }),
    cid: sanitizeOptional(payload.cid),
    cat: cat ?? null,
    observacao: sanitizeOptional(payload.observacao),
}

function validateAcidentePayload(payload) {
  if (!payload.matricula) throw createHttpError(400, 'Matricula obrigatoria')
  if (!payload.nome) throw createHttpError(400, 'Nome obrigatorio')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigatorio')
  if (!payload.tipo) throw createHttpError(400, 'Tipo de acidente obrigatorio')
  if (!payload.agente) throw createHttpError(400, 'Agente causador obrigatorio')
  if (!payload.lesao) throw createHttpError(400, 'Lesao obrigatoria')
  if (!payload.parteLesionada) throw createHttpError(400, 'Parte lesionada obrigatoria')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servico obrigatorio')
  if (!payload.data || Number.isNaN(Date.parse(payload.data))) {
    throw createHttpError(400, 'Data do acidente obrigatoria')
  if (!Number.isInteger(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createHttpError(400, 'Dias perdidos deve ser zero ou positivo')
  if (!Number.isInteger(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createHttpError(400, 'Dias debitados deve ser zero ou positivo')
  if (payload.hht !== undefined && payload.hht !== null) {
    if (!Number.isInteger(Number(payload.hht)) || Number(payload.hht) < 0) {
      throw createHttpError(400, 'HHT deve ser zero ou positivo')
    }
  if (payload.cat && !/^[0-9]+$/.test(String(payload.cat))) {
    throw createHttpError(400, 'CAT deve conter apenas numeros inteiros')
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
  const pessoa = await executeMaybeSingle(
    supabaseAdmin.from('pessoas').select('*').eq('matricula', matricula).limit(1),
    'Falha ao consultar pessoa por matrï¿½cula.'
  )
  return mapPessoaRecord(pessoa)
}

async function obterPessoaPorNome(nome) {
  if (!nome) {
    return null
  const pattern = `%${nome.trim().replace(/\s+/g, '%')}%`
  const registros =
    (await execute(
      supabaseAdmin.from('pessoas').select('*').ilike('nome', pattern).order('nome').limit(5),
      'Falha ao consultar pessoa por nome.'
    )) ?? []
  if (registros.length === 0) {
    return null
  if (registros.length > 1) {
    throw createHttpError(
      409,
      'Mais de um colaborador encontrado para o nome informado. Refine a busca ou informe a matr???cula.'
    )
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

function calcularDataTroca(dataEntregaIso, validadeDias) {
  if (!validadeDias) {
    return null
  const data = new Date(dataEntregaIso)
  if (Number.isNaN(data.getTime())) {
    return null
  const prazo = Number(validadeDias)
  if (Number.isNaN(prazo) || prazo <= 0) {
    return null
  data.setUTCDate(data.getUTCDate() + prazo)
  return data.toISOString()
}

async function registrarHistoricoPreco(materialId, valorUnitario, usuario) {
  if (!materialId) {
    return
  await execute(
    supabaseAdmin.from('material_price_history').insert({
      id: randomId(),
      materialId,
      valorUnitario,
      usuarioResponsavel: usuario || 'sistema',
      criadoEm: nowIso(),
    }),
    'Falha ao registrar histÃ³rico de preÃ§o.'
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
  if (resolvedRange?.end) {
    const fimIso = resolvedRange.end.toISOString()
    entradasFiltered = entradasFiltered.lte('dataEntrada', fimIso)
    saidasFiltered = saidasFiltered.lte('dataEntrega', fimIso)

  const [materiaisRegistros, entradas, saidas] = await Promise.all([
    execute(
      supabaseAdmin.from(MATERIAIS_VIEW).select('*').order('nome'),
      'Falha ao listar materiais.',
    ),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saídas.'),
  ])

  return {
    materiais: (materiaisRegistros ?? []).map(mapMaterialRecord),
    entradas: (entradas ?? []).map(mapEntradaRecord),
    saidas: (saidas ?? []).map(mapSaidaRecord),
    periodo,
}

async function calcularSaldoMaterialAtual(materialId) {
  const [entradas, saidas] = await Promise.all([
    execute(
      supabaseAdmin.from('entradas').select('materialId, quantidade, dataEntrada').eq('materialId', materialId),
      'Falha ao consultar entradas do material.'
    ),
    execute(
      supabaseAdmin.from('saidas').select('materialId, quantidade, dataEntrega').eq('materialId', materialId),
      'Falha ao consultar saÃ­das do material.'
    ),
  ])

  return calcularSaldoMaterial(materialId, entradas, saidas, null)
}

async function obterSaidasDetalhadasPorPessoa(pessoaId) {
  if (!pessoaId) {
    return []
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
  const partes = [material.nome]
  if (material.fabricante) {
    partes.push(material.fabricante)
  const numeroEspecifico = material.numeroEspecifico || material.numeroCalcado || material.numeroVestimenta
  if (numeroEspecifico) {
    partes.push(numeroEspecifico)
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
    const atual = await executeMaybeSingle(
      supabaseAdmin.from('pessoas').select('*').eq('id', id),
      'Falha ao obter pessoa.'
    )
    if (!atual) {
      throw createHttpError(404, 'Pessoa nÃ£o encontrada.')
    }

    const dados = sanitizePessoaPayload(payload)
    validatePessoaPayload(dados)
    await ensureMatriculaDisponivel(dados.matricula, id)

    const usuario = resolveUsuarioNome(user)
    const agora = nowIso()

    const camposAlterados = []
    const comparacoes = [
      { campo: 'nome' },
      { campo: 'matricula' },
      { campo: 'centroServico', atualKey: 'local' },
      { campo: 'cargo' },
    ]

    comparacoes.forEach(({ campo, atualKey }) => {
      const valorAtual = atual[atualKey ?? campo] || ''
      const valorNovo = campo === 'centroServico' ? dados.centroServico : dados[campo]
      if (valorAtual !== valorNovo) {
        camposAlterados.push({
          campo,
          de: valorAtual,
          para: valorNovo,
        })
      }
    })

    if (camposAlterados.length > 0) {
      await execute(
        supabaseAdmin
          .from('pessoas_historico')
          .insert({
            pessoa_id: id,
            data_edicao: agora,
            usuario_responsavel: usuario,
            campos_alterados: camposAlterados,
          }),
        'Falha ao registrar histórico de edição.',
      )
    }

    const pessoaAtualizada = await executeSingle(
      supabaseAdmin
        .from('pessoas')
        .update({
          nome: dados.nome,
          matricula: dados.matricula,
          local: dados.centroServico,
          cargo: dados.cargo,
          atualizadoEm: agora,
          usuarioEdicao: usuario,
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar pessoa.'
    )

    return mapPessoaRecord(pessoaAtualizada)
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
  async groups() {
    const registros =
      (await execute(
        supabaseAdmin
          .from('materiais')
          .select('grupoMaterial', { distinct: true })
          .not('grupoMaterial', 'is', null)
          .neq('grupoMaterial', '')
          .order('grupoMaterial'),
        'Falha ao listar grupos de materiais.'
      )) ?? []
    return registros
      .map((item) => (item.grupoMaterial && item.grupoMaterial.trim()) || '')
      .filter((value) => Boolean(value))
      .sort((a, b) => a.localeCompare(b))
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
      'Falha ao listar medidas de calçado.',
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
    await ensureMaterialChaveUnica(dados.chaveUnica)

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
      grupoMaterial: dados.grupoMaterial,
      numeroCalcado: dados.numeroCalcado,
      numeroVestimenta: dados.numeroVestimenta,
      numeroEspecifico: dados.numeroEspecifico,
      descricao: dados.descricao,
      chaveUnica: dados.chaveUnica,
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
      throw createHttpError(404, 'Material nÃ£o encontrado.')
    }

    const dados = await sanitizeMaterialPayload({
      ...atual,
      ...payload,
    })
    validateMaterialPayload(dados)
    await ensureMaterialChaveUnica(dados.chaveUnica, id)

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
          grupoMaterial: dados.grupoMaterial,
          numeroCalcado: dados.numeroCalcado,
          numeroVestimenta: dados.numeroVestimenta,
          numeroEspecifico: dados.numeroEspecifico,
          descricao: dados.descricao,
          chaveUnica: dados.chaveUnica,
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
        'Falha ao listar histÃ³rico de preÃ§os.'
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
    if (centroCusto) {
      query = query.ilike('centroCusto', centroCusto)
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
    entradas = entradas.map(mapEntradaRecord)

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
      throw createHttpError(404, 'Material nÃ£o encontrado.')
    }

    const usuario = resolveUsuarioNome(user)

    const entrada = await executeSingle(
        supabaseAdmin
          .from('entradas')
          .insert({
            id: randomId(),
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centroCusto: dados.centroCusto,
            dataEntrada: dados.dataEntrada,
            usuarioResponsavel: usuario,
          })
        .select(),
      'Falha ao registrar entrada.'
    )

    return mapEntradaRecord(entrada)
  },
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
      (await execute(query, 'Falha ao listar saídas.')) ?? []
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
      throw createHttpError(404, 'Pessoa nÃ£o encontrada.')
    }
    if (!material) {
      throw createHttpError(404, 'Material nÃ£o encontrado.')
    }

    const estoqueDisponivel = await calcularSaldoMaterialAtual(material.id)
    if (Number(dados.quantidade) > estoqueDisponivel) {
      throw createHttpError(400, 'Quantidade informada maior que estoque disponÃ­vel.')
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
      'Falha ao registrar saÃ­da.'
    )

    return {
      ...mapSaidaRecord(saida),
      estoqueAtual: estoqueDisponivel - Number(dados.quantidade),
    }
  },
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
        supabaseAdmin.from('acidentes').select('*').order('data', { ascending: false }),
        'Falha ao listar acidentes.'
      )) ?? []
    return acidentes.map(mapAcidenteRecord)
  },
  async create(payload, user) {
    const dados = sanitizeAcidentePayload(payload)
    validateAcidentePayload(dados)

    const pessoa = await obterPessoaPorMatricula(dados.matricula)
    if (!pessoa) {
      throw createHttpError(404, 'Pessoa nï¿½o encontrada para a matrï¿½cula informada.')
    }

    const centroServicoBase = dados.centroServico || pessoa.centroServico || pessoa.setor || pessoa.local || ''
    const localBase = dados.local || pessoa.local || pessoa.centroServico || ''
    const agora = nowIso()
    const usuario = resolveUsuarioNome(user)

    const acidente = await executeSingle(
      supabaseAdmin
        .from('acidentes')
        .insert({
          id: randomId(),
          matricula: dados.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          data: dados.data,
          tipo: dados.tipo,
          agente: dados.agente,
          lesao: dados.lesao,
          parteLesionada: dados.parteLesionada,
          setor: centroServicoBase,
          local: localBase,
          diasPerdidos: dados.diasPerdidos,
          diasDebitados: dados.diasDebitados,
          hht: dados.hht,
          cid: dados.cid,
          cat: dados.cat,
          observacao: dados.observacao,
          criadoEm: agora,
          atualizadoEm: null,
          registradoPor: usuario,
        })
        .select(),
      'Falha ao registrar acidente.'
    )

    return mapAcidenteRecord(acidente)
  },
  async update(id, payload, user) {
    const atual = await executeMaybeSingle(
      supabaseAdmin.from('acidentes').select('*').eq('id', id),
      'Falha ao obter acidente.'
    )
    if (!atual) {
      throw createHttpError(404, 'Acidente nï¿½o encontrado.')
    }

    let pessoa = null
    if (payload.matricula !== undefined && trim(payload.matricula)) {
      pessoa = await obterPessoaPorMatricula(trim(payload.matricula))
      if (!pessoa) {
        throw createHttpError(404, 'Pessoa nï¿½o encontrada para a matrï¿½cula informada.')
      }
    }

    const dados = sanitizeAcidentePayload({ ...atual, ...payload })
    validateAcidentePayload(dados)

    const centroServicoPessoa = pessoa?.centroServico || pessoa?.setor || pessoa?.local || ''
    const localPessoa = pessoa?.local || pessoa?.centroServico || ''
    const centroServicoFinal = dados.centroServico || centroServicoPessoa || atual.setor || ''
    const localFinal = dados.local || localPessoa || atual.local || centroServicoFinal
    const agora = nowIso()
    const usuario = resolveUsuarioNome(user)

    dados.centroServico = centroServicoFinal
    dados.local = localFinal

    const acidenteAtualizado = await executeSingle(
      supabaseAdmin
        .from('acidentes')
        .update({
          matricula: dados.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          data: dados.data,
          tipo: dados.tipo,
          agente: dados.agente,
          lesao: dados.lesao,
          parteLesionada: dados.parteLesionada,
          setor: centroServicoFinal,
          local: localFinal,
          diasPerdidos: dados.diasPerdidos,
          diasDebitados: dados.diasDebitados,
          hht: dados.hht,
          cid: dados.cid,
          cat: dados.cat,
          observacao: dados.observacao,
          atualizadoEm: agora,
          atualizadoPor: usuario,
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar acidente.'
    )

    return mapAcidenteRecord(acidenteAtualizado)
  },
}

export async function healthCheck() {
  const { error } = await supabaseAdmin
    .from('materiais')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (error) {
    throw mapSupabaseError(error, GENERIC_SUPABASE_ERROR)
  return { status: 'ok' }
}






