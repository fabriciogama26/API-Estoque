import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import {
  montarEstoqueAtual,
  montarDashboard,
  parsePeriodo,
  resolvePeriodoRange,
  calcularSaldoMaterial,
} from '../lib/estoque.js'
import { montarDashboardAcidentes } from '../lib/acidentesDashboard.js'

const GENERIC_ERROR = 'Falha ao comunicar com o Supabase.'

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
  'tipo',
  'agente',
  'lesao',
  'lesoes',
  'partesLesionadas',
  'parteLesionada',
  'centroServico',
  'local',
  'diasPerdidos',
  'diasDebitados',
  'hht',
  'cid',
  'cat',
  'observacao',
]

const MATERIAL_COR_RELATION_TABLE = 'material_grupo_cor'
const MATERIAL_CARACTERISTICA_RELATION_TABLE = 'material_grupo_caracteristica_epi'

const MATERIAL_COR_RELATION_ID_COLUMNS = ['grupo_material_cor']
const MATERIAL_COR_RELATION_TEXT_COLUMNS = []

const MATERIAL_CARACTERISTICA_RELATION_ID_COLUMNS = ['grupo_caracteristica_epi']
const MATERIAL_CARACTERISTICA_RELATION_TEXT_COLUMNS = []


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
  'caracteristicaNome',
  'corNome',
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
  "corNome",
  "numeroCalcadoNome",
  "numeroVestimentaNome",
  "usuarioCadastroNome",
  "usuarioAtualizacaoNome",
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const normalizeUuid = (value) => {
  const texto = trim(value)
  if (!texto) {
    return null
  }
  return UUID_REGEX.test(texto) ? texto : null
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
    .filter(Boolean)
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

const normalizeCatalogoOptions = (lista) =>
  normalizeOptionList(lista).map((item) => ({
    id: item.id ?? item.nome,
    nome: item.nome,
  }))

const normalizeCatalogoLista = (lista) =>
  normalizeCatalogoOptions(lista).map((item) => item.nome)

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
            ordem: 1000 + index,
            ativo: true,
          })),
          { onConflict: 'grupo,subgrupo,nome' },
        ),
      'Falha ao salvar partes lesionadas.',
    )
  } catch (error) {
    console.warn('Nao foi possivel upsert partes lesionadas.', error)
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
  const baseFilters = [
    `nome.ilike.${like}`,
    `matricula.ilike.${like}`,
    `usuarioCadastro.ilike.${like}`,
    `usuarioEdicao.ilike.${like}`,
  ]

  let query = builder.or(baseFilters.join(','))

  const relatedTables = [
    'centros_servico',
    'setores',
    'cargos',
    'centros_custo',
    'tipo_execucao',
  ]

  relatedTables.forEach((table) => {
    query = query.or(`nome.ilike.${like}`, { foreignTable: table })
  })

  return query
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
    .select('id, nome, ativo, ordem')
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('nome', { ascending: true })
  if (error) {
    throw mapSupabaseError(error, 'Falha ao carregar agentes de acidente.')
  }
  const lista = (data ?? [])
    .filter((item) => item && item.nome && item.ativo !== false)
    .map((item) => ({
      id: item.id ?? null,
      nome: trim(item.nome),
      ordem: item.ordem ?? null,
    }))
    .filter((item) => Boolean(item.nome))
    .sort((a, b) => {
      const ordemA = a.ordem ?? Number.MAX_SAFE_INTEGER
      const ordemB = b.ordem ?? Number.MAX_SAFE_INTEGER
      if (ordemA !== ordemB) {
        return ordemA - ordemB
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
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
      console.warn('Falha ao carregar catalogo de agentes.', catalogError)
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
            console.warn('Falha ao atualizar cache de agentes.', cacheError)
          }
        }
      }
      return id
    }
  } catch (lookupError) {
    console.warn('Nao foi possivel localizar agente para lesoes.', lookupError)
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
    console.warn('Nao foi possivel upsert lesoes.', error)
  }
  return lista
}

function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

function mapSupabaseError(error, fallbackMessage = GENERIC_ERROR) {
  if (!error) {
    return new Error(fallbackMessage)
  }
  const err = new Error(error.message || fallbackMessage)
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

async function executeSingle(builder, fallbackMessage) {
  ensureSupabase()
  const { data, error } = await builder.single()
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
          console.warn(
            'Supabase rejeitou IDs de vínculo de material.',
            {
              table,
              columnName,
              values: normalizedValues,
            },
            error
          )
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

  let idInserted = false
  try {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_COR_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_COR_RELATION_ID_COLUMNS,
      values: idValues,
      deleteMessage: 'Falha ao limpar vínculos de cores do material.',
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
      deleteMessage: 'Falha ao limpar vínculos de cores do material.',
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

  let idInserted = false
  try {
    await replaceMaterialRelationsWithFallback({
      table: MATERIAL_CARACTERISTICA_RELATION_TABLE,
      materialId,
      columnCandidates: MATERIAL_CARACTERISTICA_RELATION_ID_COLUMNS,
      values: idValues,
      deleteMessage: 'Falha ao limpar vínculos de características do material.',
      insertMessage: 'Falha ao vincular características ao material.',
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
      deleteMessage: 'Falha ao limpar vínculos de características do material.',
      insertMessage: 'Falha ao vincular características ao material.',
      deleteFirst: false,
    })
  }
}

async function syncMaterialRelations(
  materialId,
  { corIds, corNames, caracteristicaIds, caracteristicaNames },
) {
  await replaceMaterialCorVinculos(materialId, corIds, corNames)
  await replaceMaterialCaracteristicaVinculos(
    materialId,
    caracteristicaIds,
    caracteristicaNames,
  )
async function resolveUsuarioResponsavel() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) {
    return 'anônimo'
  }
  const metadata = user.user_metadata ?? {}
  return user.id || 'anônimo'
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
  const caracteristicasTexto = trim(
    record.caracteristicaNome ?? record.caracteristicas_texto ?? ''
  )
  const coresTexto = trim(record.corNome ?? record.cores_texto ?? '')
  const usuarioCadastroId = trim(record.usuarioCadastro ?? record.usuario_cadastro ?? '')
  const usuarioCadastroNome =
    trim(record.usuarioCadastroNome ?? record.usuario_cadastro_nome ?? '') ||
    usuarioCadastroId

  const usuarioAtualizacaoId = trim(
    record.usuarioAtualizacao ?? record.usuario_atualizacao ?? '',
  )
  const usuarioAtualizacaoNome =
    trim(record.usuarioAtualizacaoNome ?? record.usuario_atualizacao_nome ?? '') ||
    usuarioAtualizacaoId

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
    caracteristicas: [],
    caracteristicasIds: [],
    caracteristicasNomes: [],
    caracteristicasTexto,
    corMaterial: coresTexto,
    cores: [],
    coresIds: [],
    coresNomes: [],
    coresTexto,
    usuarioCadastro: usuarioCadastroId,
    usuarioCadastroNome,
    usuarioAtualizacao: usuarioAtualizacaoId,
    usuarioAtualizacaoNome,
    dataCadastro: record.dataCadastro ?? record.data_cadastro ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
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

  const centroServico = resolveTextValue(
    record.centroServico ??
      record.centro_servico ??
      centroServicoRel ??
      record.setor ??
      record.local ??
      '',
  )
  const setor = resolveTextValue(record.setor ?? setorRel ?? centroServico)
  const cargo = resolveTextValue(record.cargo ?? cargoRel ?? '')
  const tipoExecucao = resolveTextValue(
    record.tipoExecucao ?? record.tipo_execucao ?? tipoExecucaoRel ?? '',
  )
  const centroCusto = resolveTextValue(centroCustoRel ?? record.centro_custo ?? centroServico)

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
    usuarioCadastro: resolveTextValue(record.usuarioCadastro ?? record.usuario_cadastro ?? ''),
    usuarioEdicao: resolveTextValue(record.usuarioEdicao ?? record.usuario_edicao ?? ''),
    criadoEm: record.criadoEm ?? record.criado_em ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
    historicoEdicao: normalizePessoaHistorico(historicoRaw),
  }
}

function mapEntradaRecord(record) {
  if (!record) {
    return null
  }
  return {
    id: record.id,
    materialId: record.materialId ?? record.material_id ?? null,
    quantidade: toNumber(record.quantidade),
    centroCusto: resolveTextValue(record.centroCusto ?? record.centro_custo ?? ''),
    dataEntrada: record.dataEntrada ?? record.data_entrada ?? null,
    usuarioResponsavel: record.usuarioResponsavel ?? record.usuario_responsavel ?? '',
  }
}

function mapSaidaRecord(record) {
  if (!record) {
    return null
  }
  return {
    id: record.id,
    materialId: record.materialId ?? record.material_id ?? null,
    pessoaId: record.pessoaId ?? record.pessoa_id ?? null,
    quantidade: toNumber(record.quantidade),
    centroCusto: resolveTextValue(record.centroCusto ?? record.centro_custo ?? ''),
    centroServico: resolveTextValue(record.centroServico ?? record.centro_servico ?? ''),
    dataEntrega: record.dataEntrega ?? record.data_entrega ?? null,
    dataTroca: record.dataTroca ?? record.data_troca ?? null,
    status: record.status ?? '',
    usuarioResponsavel: record.usuarioResponsavel ?? record.usuario_responsavel ?? '',
  }
}

function mapAcidenteRecord(record) {
  if (!record) {
    return null
  }
  const centroServico = resolveTextValue(
    record.centroServico ?? record.centro_servico ?? record.setor ?? '',
  )
  const partes = normalizeStringArray(record.partes_lesionadas ?? record.partesLesionadas ?? [])
  const partePrincipal = partes.length
    ? partes[0]
    : trim(record.parteLesionada ?? record.parte_lesionada ?? '')
  let lesoes = normalizeStringArray(record.lesoes ?? record.lesoesRegistradas ?? [])
  if (!lesoes.length) {
    const unica = trim(record.lesao ?? '')
    if (unica) {
      lesoes = [unica]
    }
  }
  const lesaoPrincipal = lesoes[0] ?? ''
  const tiposLista = splitMultiValue(record.tipos ?? record.tipo ?? '')
  const tiposTexto = tiposLista.join('; ')
  const agentesLista = splitMultiValue(record.agentes ?? record.agente ?? '')
  const agentesTexto = agentesLista.join('; ')
  const agentePrincipalRegistro = trim(record.agentePrincipal ?? record.agente_principal ?? '')
  const agentePrincipal =
    agentePrincipalRegistro || (agentesLista.length ? agentesLista[agentesLista.length - 1] : '')
  return {
    id: record.id,
    matricula: record.matricula ?? '',
    nome: record.nome ?? '',
    cargo: record.cargo ?? '',
    data: record.data ?? null,
    diasPerdidos: toNumber(record.diasPerdidos ?? record.dias_perdidos),
    diasDebitados: toNumber(record.diasDebitados ?? record.dias_debitados),
    tipo: tiposTexto,
    tipos: tiposLista,
    agente: agentesTexto,
    agentes: agentesLista,
    tipoPrincipal: tiposLista[0] ?? '',
    agentePrincipal,
    cid: record.cid ?? '',
    lesao: lesaoPrincipal,
    lesoes,
    parteLesionada: partePrincipal,
    partesLesionadas: partes,
    centroServico,
    setor: resolveTextValue(record.setor ?? centroServico),
    local: resolveTextValue(record.local ?? centroServico),
    cat: record.cat ?? null,
    observacao: record.observacao ?? '',
    criadoEm: record.criadoEm ?? record.criado_em ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
    registradoPor: record.registradoPor ?? record.registrado_por ?? '',
    atualizadoPor: record.atualizadoPor ?? record.atualizado_por ?? '',
    hht: toNullableNumber(record.hht),
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
  }
}

const MATERIAL_REFERENCE_MAPPINGS = {
  nome: {
    tabela: 'materiais_view',
    colunaTexto: 'materialItemNome',
    colunaId: 'nome',
  },
  fabricante: {
    tabela: 'fabricante_view',
    colunaTexto: 'nome',
    colunaId: 'id',
  },
  grupoMaterial: {
    tabela: 'grupo_material_view',
    colunaTexto: 'nome',
    colunaId: 'id',
  },
  numeroCalcado: {
    tabela: 'medidas_calcado_view',
    colunaTexto: 'nome',
    colunaId: 'id',
  },
  numeroVestimenta: {
    tabela: 'medidas_vestimenta_view',
    colunaTexto: 'nome',
    colunaId: 'id',
  },
}

async function sanitizeMaterialPayload(payload = {}) {
  const safePayload = payload ?? {}

  const nomeTexto =
    trim(
      safePayload.materialItemNome ??
        safePayload.nomeItemRelacionado ??
        safePayload.material_item_nome ??
        safePayload.nome ??
        '',
    ) || ''
  const nomeId =
    normalizeRelationId(
      safePayload.nome ??
        safePayload.nomeId ??
        safePayload.materialItemId ??
        safePayload.material_item_id ??
        null,
    ) || null
  const nomeRef = nomeId || nomeTexto ? { id: nomeId, nome: nomeTexto } : null

  const fabricanteNome =
    trim(
      safePayload.fabricanteNome ??
        safePayload.fabricante_nome ??
        safePayload.fabricante ??
        '',
    ) || ''
  const fabricanteId =
    normalizeRelationId(
      safePayload.fabricante ??
        safePayload.fabricanteId ??
        safePayload.fabricante_id ??
        null,
    ) || null
  const fabricanteRef = fabricanteId || fabricanteNome ? { id: fabricanteId, nome: fabricanteNome } : null

  const grupoMaterialNome =
    trim(
      safePayload.grupoMaterialNome ??
        safePayload.grupo_material_nome ??
        safePayload.grupoMaterial ??
        safePayload.grupo_material ??
        '',
    ) || ''
  const grupoMaterialId =
    normalizeRelationId(
      safePayload.grupoMaterialId ??
        safePayload.grupo_material_id ??
        safePayload.grupoMaterial ??
        safePayload.grupo_material ??
        null,
    ) || null
  const grupoMaterialRef =
    grupoMaterialId || grupoMaterialNome ? { id: grupoMaterialId, nome: grupoMaterialNome } : null

  const numeroCalcadoNome =
    trim(
      safePayload.numeroCalcadoNome ??
        safePayload.numero_calcado_nome ??
        safePayload.numeroCalcado ??
        safePayload.numero_calcado ??
        '',
    ) || ''
  const numeroCalcadoId =
    normalizeRelationId(
      safePayload.numeroCalcado ??
        safePayload.numeroCalcadoId ??
        safePayload.numero_calcado ??
        safePayload.numero_calcado_id ??
        null,
    ) || null
  const numeroCalcadoRef =
    numeroCalcadoId || numeroCalcadoNome ? { id: numeroCalcadoId, nome: numeroCalcadoNome } : null

  const numeroVestimentaNome =
    trim(
      safePayload.numeroVestimentaNome ??
        safePayload.numero_vestimenta_nome ??
        safePayload.numeroVestimenta ??
        safePayload.numero_vestimenta ??
        '',
    ) || ''
  const numeroVestimentaId =
    normalizeRelationId(
      safePayload.numeroVestimenta ??
        safePayload.numeroVestimentaId ??
        safePayload.numero_vestimenta ??
        safePayload.numero_vestimenta_id ??
        null,
    ) || null
  const numeroVestimentaRef =
    numeroVestimentaId || numeroVestimentaNome
      ? { id: numeroVestimentaId, nome: numeroVestimentaNome }
      : null

  const refs = await resolveRefs(
    {
      nome: nomeRef,
      fabricante: fabricanteRef,
      grupoMaterial: grupoMaterialRef,
      numeroCalcado: numeroCalcadoRef,
      numeroVestimenta: numeroVestimentaRef,
    },
    MATERIAL_REFERENCE_MAPPINGS,
  )

  const nomeResolved = refs.nome ?? nomeRef ?? { id: nomeId, nome: nomeTexto }
  const fabricanteResolved =
    refs.fabricante ?? fabricanteRef ?? { id: fabricanteId, nome: fabricanteNome }
  const grupoMaterialResolved =
    refs.grupoMaterial ?? grupoMaterialRef ?? { id: grupoMaterialId, nome: grupoMaterialNome }
  const numeroCalcadoResolved =
    refs.numeroCalcado ?? numeroCalcadoRef ?? { id: numeroCalcadoId, nome: numeroCalcadoNome }
  const numeroVestimentaResolved =
    refs.numeroVestimenta ?? numeroVestimentaRef ?? {
      id: numeroVestimentaId,
      nome: numeroVestimentaNome,
    }

  const caracteristicasSelecionadas = normalizeOptionList(
    safePayload.caracteristicas ??
      safePayload.caracteristicasSelecionadas ??
      safePayload.caracteristicasEpi ??
      safePayload.caracteristicaEpi ??
      safePayload.caracteristica_epi ??
      safePayload.caracteristicas_epi ??
      [],
  )

  const coresSelecionadas = normalizeOptionList(
    safePayload.cores ??
      safePayload.coresSelecionadas ??
      safePayload.coresIds ??
      safePayload.corMaterial ??
      safePayload.cor_material ??
      safePayload.cor ??
      [],
  )

  const caracteristicaEpi = formatCaracteristicaTexto(
    caracteristicasSelecionadas.length
      ? caracteristicasSelecionadas.map((item) => item.nome)
      : safePayload.caracteristicaEpi ?? safePayload.caracteristica_epi ?? '',
  )

  const corMaterialTexto =
    coresSelecionadas.length
      ? coresSelecionadas.map((item) => item.nome).join('; ')
      : trim(safePayload.corMaterial ?? safePayload.cor_material ?? '')

  const numeroEspecifico = trim(
    safePayload.numeroEspecifico ?? safePayload.numero_especifico ?? '',
  )

  const validadeDias = toNullableNumber(
    safePayload.validadeDias ?? safePayload.validade_dias,
  )
  const valorUnitario = toNumber(
    safePayload.valorUnitario ?? safePayload.valor_unitario ?? 0,
  )
  const estoqueMinimo = toNumber(
    safePayload.estoqueMinimo ?? safePayload.estoque_minimo ?? 0,
  )
  const ativo =
    safePayload.ativo === undefined || safePayload.ativo === null
      ? true
      : Boolean(safePayload.ativo)

  const resultadoBase = {
    ...safePayload,
  }
  delete resultadoBase.nome
  delete resultadoBase.nomeId
  delete resultadoBase.nome_item_relacionado
  delete resultadoBase.nomeItemRelacionado
  delete resultadoBase.materialItemNome
  delete resultadoBase.material_item_nome
  delete resultadoBase.materialItemId
  delete resultadoBase.material_item_id
  delete resultadoBase.fabricante
  delete resultadoBase.fabricanteId
  delete resultadoBase.fabricante_id
  delete resultadoBase.fabricanteNome
  delete resultadoBase.fabricante_nome
  delete resultadoBase.grupoMaterial
  delete resultadoBase.grupo_material
  delete resultadoBase.grupoMaterialId
  delete resultadoBase.grupo_material_id
  delete resultadoBase.grupoMaterialNome
  delete resultadoBase.grupo_material_nome
  delete resultadoBase.numeroCalcado
  delete resultadoBase.numero_calcado
  delete resultadoBase.numeroCalcadoId
  delete resultadoBase.numero_calcado_id
  delete resultadoBase.numeroCalcadoNome
  delete resultadoBase.numero_calcado_nome
  delete resultadoBase.numeroVestimenta
  delete resultadoBase.numero_vestimenta
  delete resultadoBase.numeroVestimentaId
  delete resultadoBase.numero_vestimenta_id
  delete resultadoBase.numeroVestimentaNome
  delete resultadoBase.numero_vestimenta_nome

  return {
    ...resultadoBase,
    nome: nomeResolved?.id ?? nomeId ?? '',
    nomeId: nomeResolved?.id ?? nomeId ?? '',
    nomeItemRelacionado: nomeResolved?.nome ?? nomeTexto,
    materialItemNome: nomeResolved?.nome ?? nomeTexto,
    fabricante: fabricanteResolved?.id ?? fabricanteId ?? '',
    fabricanteNome: fabricanteResolved?.nome ?? fabricanteNome,
    validadeDias,
    ca: trim(safePayload.ca ?? ''),
    valorUnitario,
    estoqueMinimo,
    ativo,
    descricao: trim(safePayload.descricao ?? ''),
    grupoMaterial: grupoMaterialResolved?.nome ?? grupoMaterialNome,
    grupoMaterialNome: grupoMaterialResolved?.nome ?? grupoMaterialNome,
    grupoMaterialId: grupoMaterialResolved?.id ?? grupoMaterialId ?? null,
    numeroCalcado: numeroCalcadoResolved?.id ?? numeroCalcadoId ?? null,
    numeroCalcadoNome: numeroCalcadoResolved?.nome ?? numeroCalcadoNome,
    numeroVestimenta: numeroVestimentaResolved?.id ?? numeroVestimentaId ?? null,
    numeroVestimentaNome:
      numeroVestimentaResolved?.nome ?? numeroVestimentaNome,
    numeroEspecifico,
    caracteristicaEpi,
    caracteristicas: caracteristicasSelecionadas,
    caracteristicasIds: normalizeRelationIds(
      caracteristicasSelecionadas.map((item) => item?.id),
    ),
    cores: coresSelecionadas,
    coresIds: normalizeRelationIds(coresSelecionadas.map((item) => item?.id)),
    corMaterial: corMaterialTexto,
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
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  const candidate = isDateOnly ? `${raw}T00:00:00` : raw
  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
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

async function carregarPessoas() {
  const data = await execute(
    supabase
      .from('pessoas')
      .select(`
        id,
        nome,
        matricula,
        "dataAdmissao",
        "usuarioCadastro",
        "usuarioEdicao",
        "criadoEm",
        "atualizadoEm",
        centro_servico_id,
        setor_id,
        cargo_id,
        centro_custo_id,
        tipo_execucao_id,
        centros_servico ( id, nome ),
        setores ( id, nome ),
        cargos ( id, nome ),
        centros_custo ( id, nome ),
        tipo_execucao ( id, nome )
      `)
      .order('nome', { ascending: true }),
    'Falha ao listar pessoas.'
  )
  return (data ?? []).map(mapPessoaRecord)
}

async function carregarEntradas(params = {}) {
  let query = supabase.from('entradas').select('*').order('dataEntrada', { ascending: false })

  if (params.materialId) {
    query = query.eq('materialId', params.materialId)
  }
  if (params.centroCusto) {
    query = query.ilike('centro_custo', `%${trim(params.centroCusto)}%`)
  }

  const periodo = resolvePeriodoRange(parsePeriodo(params))
  if (periodo?.start || periodo?.end) {
    query = buildDateFilters(query, 'dataEntrada', periodo?.start?.toISOString(), periodo?.end?.toISOString())
  }

  const data = await execute(query, 'Falha ao listar entradas.')
  let registros = (data ?? []).map(mapEntradaRecord)

  const termo = trim(params.termo).toLowerCase()
  if (termo) {
    registros = registros.filter((entrada) => {
      const alvo = [
        entrada.centroCusto,
        entrada.usuarioResponsavel,
      ]
        .join(' ')
        .toLowerCase()
      return alvo.includes(termo)
    })
  }

  return registros
}

async function carregarSaidas(params = {}) {
  let query = supabase.from('saidas').select('*').order('dataEntrega', { ascending: false })

  if (params.materialId) {
    query = query.eq('materialId', params.materialId)
  }
  if (params.pessoaId) {
    query = query.eq('pessoaId', params.pessoaId)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.centroCusto) {
    query = query.ilike('centro_custo', `%${trim(params.centroCusto)}%`)
  }
  if (params.centroServico) {
    query = query.ilike('centro_servico', `%${trim(params.centroServico)}%`)
  }

  const periodo = resolvePeriodoRange(parsePeriodo(params))
  if (periodo?.start || periodo?.end) {
    query = buildDateFilters(query, 'dataEntrega', periodo?.start?.toISOString(), periodo?.end?.toISOString())
  }

  const data = await execute(query, 'Falha ao listar saidas.')
  let registros = (data ?? []).map(mapSaidaRecord)

  const termo = trim(params.termo).toLowerCase()
  if (termo) {
    const [pessoasRaw, materiaisRaw] = await Promise.all([
      execute(supabase.from('pessoas').select('id, nome, centro_servico'), 'Falha ao listar pessoas.'),
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
      const alvo = [
        material?.nome ?? '',
        material?.fabricante ?? '',
        pessoa?.nome ?? '',
        pessoa?.centroServico ?? '',
        saida.centroServico ?? '',
        saida.centroCusto ?? '',
        saida.usuarioResponsavel ?? '',
        saida.status ?? '',
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
    supabase.from('acidentes').select('*').order('data', { ascending: false }),
    'Falha ao listar acidentes.'
  )
  return (data ?? []).map(mapAcidenteRecord)
}

async function calcularSaldoMaterialAtual(materialId) {
  const [entradas, saidas] = await Promise.all([
    execute(
      supabase.from('entradas').select('materialId, quantidade, dataEntrada').eq('materialId', materialId),
      'Falha ao consultar entradas.'
    ),
    execute(
      supabase.from('saidas').select('materialId, quantidade, dataEntrega').eq('materialId', materialId),
      'Falha ao consultar saidas.'
    ),
  ])

  const entradasNormalizadas = (entradas ?? []).map(mapEntradaRecord)
  const saidasNormalizadas = (saidas ?? []).map(mapSaidaRecord)
  return calcularSaldoMaterial(materialId, entradasNormalizadas, saidasNormalizadas, null)
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
    descricao: saida.material?.nome ?? '',
    numeroCa: saida.material?.ca ?? '',
    centroCusto: saida.centroCusto ?? '',
    centroServico: saida.centroServico ?? '',
    status: saida.status ?? '',
    usuarioResponsavel: saida.usuarioResponsavel ?? '',
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
      const filtros = {
        centroServicoId: null,
        setorId: null,
        cargoId: null,
        tipoExecucaoId: null,
      }

      const centroServico = trim(params.centroServico ?? params.local ?? '')
      if (centroServico && centroServico.toLowerCase() !== 'todos') {
        filtros.centroServicoId = await resolveReferenceId(
          'centros_servico',
          centroServico,
          'Centro de serviço inválido para filtro.'
        )
      }

      const setor = trim(params.setor ?? '')
      if (setor && setor.toLowerCase() !== 'todos') {
        filtros.setorId = await resolveReferenceId('setores', setor, 'Setor inválido para filtro.')
      }

      const cargo = trim(params.cargo ?? '')
      if (cargo && cargo.toLowerCase() !== 'todos') {
        filtros.cargoId = await resolveReferenceId('cargos', cargo, 'Cargo inválido para filtro.')
      }

      const tipoExecucaoFiltro = trim(params.tipoExecucao ?? '')
      if (tipoExecucaoFiltro && tipoExecucaoFiltro.toLowerCase() !== 'todos') {
        filtros.tipoExecucaoId = await resolveReferenceId(
          'tipo_execucao',
          tipoExecucaoFiltro.toUpperCase(),
          'Tipo de execução inválido para filtro.'
        )
      }

      const termo = trim(params.termo)

      const buildQuery = () => {
        let builder = supabase
          .from('pessoas')
          .select(`
            id,
            nome,
            matricula,
            "dataAdmissao",
            "usuarioCadastro",
            "usuarioEdicao",
            "criadoEm",
            "atualizadoEm",
            centro_servico_id,
            setor_id,
            cargo_id,
            centro_custo_id,
            tipo_execucao_id,
            centros_servico ( id, nome ),
            setores ( id, nome ),
            cargos ( id, nome ),
            centros_custo ( id, nome ),
            tipo_execucao ( id, nome )
          `)
          .order('nome', { ascending: true })

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
        return builder
      }

      try {
        let query = buildQuery()
        if (termo) {
          const like = `%${termo}%`
          query = applyPessoaSearchFilters(query, like)
        }
        const data = await execute(query, 'Falha ao listar pessoas.')
        return (data ?? []).map(mapPessoaRecord)
      } catch (error) {
        if (!termo) {
          throw error
        }
        console.warn(
          'Erro ao aplicar filtro remoto por termo em pessoas, usando filtro local.',
          error
        )
        const fallbackData = await execute(buildQuery(), 'Falha ao listar pessoas.')
        const registros = (fallbackData ?? []).map(mapPessoaRecord)
        return registros.filter((pessoa) => pessoaMatchesSearch(pessoa, termo))
      }
    },
    async create(payload) {
      const dados = sanitizePessoaPayload(payload)
      if (!dados.nome || !dados.matricula || !dados.centroServico || !dados.setor || !dados.cargo) {
        throw new Error('Preencha nome, matricula, centro de servico, setor e cargo.')
      }

      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()
      const referencias = await resolvePessoaReferencias(dados)

      const registro = await executeSingle(
        supabase
          .from('pessoas')
          .insert({
            nome: dados.nome,
            matricula: dados.matricula,
            centro_servico_id: referencias.centroServicoId,
            setor_id: referencias.setorId,
            cargo_id: referencias.cargoId,
            centro_custo_id: referencias.centroCustoId,
            tipo_execucao_id: referencias.tipoExecucaoId,
            dataAdmissao: dados.dataAdmissao,
            usuarioCadastro: usuario,
            criadoEm: agora,
            atualizadoEm: null,
          })
          .select(`
            id,
            nome,
            matricula,
            "dataAdmissao",
            "usuarioCadastro",
            "usuarioEdicao",
            "criadoEm",
            "atualizadoEm",
            centro_servico_id,
            setor_id,
            cargo_id,
            centro_custo_id,
            tipo_execucao_id,
            centros_servico ( id, nome ),
            setores ( id, nome ),
            cargos ( id, nome ),
            centros_custo ( id, nome ),
            tipo_execucao ( id, nome )
          `),
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
            "dataAdmissao",
            "usuarioCadastro",
            "usuarioEdicao",
            "criadoEm",
            "atualizadoEm",
            centro_servico_id,
            setor_id,
            cargo_id,
            centro_custo_id,
            tipo_execucao_id,
            centros_servico ( id, nome ),
            setores ( id, nome ),
            cargos ( id, nome ),
            centros_custo ( id, nome ),
            tipo_execucao ( id, nome )
          `)
          .eq('id', id),
        'Falha ao obter pessoa.'
      )
      if (!atualRaw) {
        throw new Error('Pessoa nao encontrada.')
      }

      const atual = mapPessoaRecord(atualRaw)
      const dados = sanitizePessoaPayload(payload)
      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()

      const normalizeDateValue = (value) => {
        if (!value) {
          return null
        }
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
          return null
        }
        return date.toISOString()
      }

      const camposAlterados = []
      ;['nome', 'matricula', 'centroServico', 'setor', 'cargo', 'tipoExecucao', 'dataAdmissao'].forEach((campo) => {
        const valorAtual =
          campo === 'dataAdmissao'
            ? normalizeDateValue(atual.dataAdmissao)
            : resolveTextValue(atual[campo] ?? '')
        const valorNovo =
          campo === 'dataAdmissao'
            ? normalizeDateValue(dados.dataAdmissao)
            : resolveTextValue(dados[campo] ?? '')
        if (valorAtual !== valorNovo) {
          camposAlterados.push({
            campo,
            de: valorAtual ?? '',
            para: valorNovo ?? '',
          })
        }
      })

      if (camposAlterados.length > 0) {
        await execute(
          supabase
            .from('pessoas_historico')
            .insert({
              pessoa_id: id,
              data_edicao: agora,
              usuario_responsavel: usuario,
              campos_alterados: camposAlterados,
            }),
          'Falha ao registrar historico de edicao.'
        )
      }

      const referencias = await resolvePessoaReferencias(dados)

      await execute(
        supabase
          .from('pessoas')
          .update({
            nome: dados.nome,
            matricula: dados.matricula,
            centro_servico_id: referencias.centroServicoId,
            setor_id: referencias.setorId,
            cargo_id: referencias.cargoId,
            centro_custo_id: referencias.centroCustoId,
            tipo_execucao_id: referencias.tipoExecucaoId,
            dataAdmissao: dados.dataAdmissao,
            atualizadoEm: agora,
            usuarioEdicao: usuario,
          })
          .eq('id', id),
        'Falha ao atualizar pessoa.'
      )

      const registro = await executeSingle(
        supabase
          .from('pessoas')
          .select(`
            id,
            nome,
            matricula,
            "dataAdmissao",
            "usuarioCadastro",
            "usuarioEdicao",
            "criadoEm",
            "atualizadoEm",
            centro_servico_id,
            setor_id,
            cargo_id,
            centro_custo_id,
            tipo_execucao_id,
            centros_servico ( id, nome ),
            setores ( id, nome ),
            cargos ( id, nome ),
            centros_custo ( id, nome ),
            tipo_execucao ( id, nome )
          `)
          .eq('id', id),
        'Falha ao obter pessoa.'
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
        'Falha ao obter histórico.'
      )
      return normalizePessoaHistorico(registros ?? [])
    },
  },
  materiais: {
    async list() {
      return carregarMateriais()
    },
    async listDetalhado() {
      return carregarMateriaisDetalhados()
    },
    async create(payload) {
      const dados = await sanitizeMaterialPayload(payload)
      if (!dados.nome || !dados.fabricante || !dados.validadeDias || dados.validadeDias <= 0) {
        throw new Error('Preencha nome, fabricante e validade (em dias).')
      }
      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()

      const coresIds = Array.isArray(dados.coresIds) ? dados.coresIds : []
      const caracteristicaIds = Array.isArray(dados.caracteristicasIds)
        ? dados.caracteristicasIds
        : []
      const corNames = extractTextualNames(dados.cores)
      const caracteristicaNames = extractTextualNames(dados.caracteristicas)
      const supabasePayload = {
        nome: dados.nome ?? '',
        fabricante: dados.fabricante ?? '',
        validadeDias: dados.validadeDias ?? null,
        ca: dados.ca ?? '',
        valorUnitario: dados.valorUnitario ?? 0,
        estoqueMinimo: dados.estoqueMinimo ?? 0,
        ativo: dados.ativo ?? true,
        descricao: dados.descricao ?? '',
        grupoMaterial: dados.grupoMaterialId ?? dados.grupoMaterial ?? '',
        numeroCalcado: dados.numeroCalcado ?? null,
        numeroVestimenta: dados.numeroVestimenta ?? null,
        numeroEspecifico: dados.numeroEspecifico ?? '',
        usuarioCadastro: usuario ?? '',
        dataCadastro: agora,
        usuarioAtualizacao: usuario ?? '',
        atualizadoEm: agora,
      }

      let materialCriadoId
      try {
        const inseridos = await execute(
          supabase.from('materiais').insert(supabasePayload).select('id'),
          'Falha ao criar material.'
        )
        materialCriadoId = Array.isArray(inseridos) && inseridos.length ? inseridos[0].id : inseridos?.id
        if (!materialCriadoId) {
          throw new Error('Falha ao criar material.')
        }

        await syncMaterialRelations(materialCriadoId, {
          corIds: coresIds,
          corNames,
          caracteristicaIds,
          caracteristicaNames,
        })
      } catch (error) {
        if (materialCriadoId) {
          try {
            ensureSupabase()
            const { error: cleanupError } = await supabase
              .from('materiais')
              .delete()
              .eq('id', materialCriadoId)
            if (cleanupError) {
              console.error('Falha ao remover material apos erro de vinculo.', cleanupError)
            }
          } catch (cleanupError) {
            console.error('Falha ao limpar material apos erro de vinculo.', cleanupError)
          }
        }
        throw error
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
        throw new Error('Material inválido.')
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
      const dadosCombinados = await sanitizeMaterialPayload({ ...materialAtual, ...payload })
      const usuario = await resolveUsuarioResponsavel()
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
            usuarioResponsavel: usuario,
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
            console.warn(
              'Registro de historico do material ignorado devido a politica de RLS.',
              historicoErro
            )
          } else {
            throw mapSupabaseError(historicoErro, 'Falha ao registrar histórico do material.')
          }
        }
      }
      const dados = await sanitizeMaterialPayload(payload)
      const coresIds = Array.isArray(dados.coresIds) ? dados.coresIds : []
      const caracteristicaIds = Array.isArray(dados.caracteristicasIds)
        ? dados.caracteristicasIds
        : []
      const corNames = extractTextualNames(dados.cores)
      const caracteristicaNames = extractTextualNames(dados.caracteristicas)
      const supabasePayload = {
        nome: dados.nome ?? '',
        fabricante: dados.fabricante ?? '',
        validadeDias: dados.validadeDias ?? null,
        ca: dados.ca ?? '',
        valorUnitario: dados.valorUnitario ?? 0,
        estoqueMinimo: dados.estoqueMinimo ?? 0,
        ativo: dados.ativo ?? true,
        descricao: dados.descricao ?? '',
        grupoMaterial: dados.grupoMaterialId ?? dados.grupoMaterial ?? '',
        numeroCalcado: dados.numeroCalcado ?? null,
        numeroVestimenta: dados.numeroVestimenta ?? null,
        numeroEspecifico: dados.numeroEspecifico ?? '',
        usuarioAtualizacao: usuario ?? '',
        atualizadoEm: agora,
      }

      await execute(
        supabase.from('materiais').update(supabasePayload).eq('id', id),
        'Falha ao atualizar material.'
      )
      await syncMaterialRelations(id, {
        corIds: coresIds,
        corNames,
        caracteristicaIds,
        caracteristicaNames,
      })
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
        'Falha ao obter histórico de preços.'
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
          .select('id, nome, ativo, ordem')
          .order('ordem', { ascending: true, nullsFirst: false })
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
        'Falha ao listar medidas de calçado.',
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
          .select('id, nome, ativo, ordem')
          .eq('grupo_id', id)
          .order('ordem', { ascending: true, nullsFirst: false })
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
      async create(payload) {
        const usuario = await resolveUsuarioResponsavel()
        const materialId = trim(payload.materialId)
        const quantidade = toNumber(payload.quantidade, null)
        const centroCusto = trim(payload.centroCusto)
        const dataEntradaRaw = trim(payload.dataEntrada)

        if (!materialId || !quantidade || quantidade <= 0 || !centroCusto) {
          throw new Error('Preencha material, quantidade (>0) e centro de custo.')
        }
        if (!dataEntradaRaw) {
          throw new Error('Informe a data de entrada.')
        }
        const dataEntradaDate = new Date(dataEntradaRaw)
        if (Number.isNaN(dataEntradaDate.getTime())) {
          throw new Error('Data de entrada invalida.')
        }

        const dados = {
          materialId,
          quantidade,
          centroCusto,
          dataEntrada: dataEntradaDate.toISOString(),
          usuarioResponsavel: usuario,
        }
        const registro = await executeSingle(
          supabase
            .from('entradas')
            .insert({
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centro_custo: dados.centroCusto,
            dataEntrada: dados.dataEntrada,
            usuarioResponsavel: dados.usuarioResponsavel,
          })
          .select(),
        'Falha ao registrar entrada.'
      )
      return mapEntradaRecord(registro)
    },
  },
  saidas: {
    list: carregarSaidas,
    async create(payload) {
      const usuario = await resolveUsuarioResponsavel()
      const pessoaId = trim(payload.pessoaId)
      const materialId = trim(payload.materialId)
      const quantidade = toNumber(payload.quantidade, null)
      const centroCusto = trim(payload.centroCusto)
      const centroServicoInput = trim(payload.centroServico ?? payload.centro_servico ?? '')
      const dataEntregaRaw = trim(payload.dataEntrega)
      const status = trim(payload.status) || 'entregue'

      if (!pessoaId || !materialId || !quantidade || quantidade <= 0) {
        throw new Error('Preencha pessoa, material e quantidade (>0).')
      }
      if (!centroCusto) {
        throw new Error('Informe o centro de custo.')
      }
      if (!dataEntregaRaw) {
        throw new Error('Informe a data de entrega.')
      }
      const dataEntregaDate = new Date(dataEntregaRaw)
      if (Number.isNaN(dataEntregaDate.getTime())) {
        throw new Error('Data de entrega invalida.')
      }

      const pessoa = await executeSingle(
        supabase.from('pessoas').select('centro_servico').eq('id', pessoaId),
        'Falha ao obter pessoa.'
      )

      const centroServico = centroServicoInput || pessoa?.centro_servico || ''

      const material = await executeSingle(
        supabase.from('materiais').select('id, validadeDias').eq('id', materialId),
        'Falha ao obter material.'
      )

      const estoqueDisponivel = await calcularSaldoMaterialAtual(materialId)
      if (quantidade > estoqueDisponivel) {
        const error = new Error('Quantidade informada maior que o estoque disponível.')
        error.status = 400
        throw error
      }

      const dataEntregaIso = dataEntregaDate.toISOString()
      const dataTroca = calcularDataTroca(dataEntregaIso, material?.validadeDias)

      const registro = await executeSingle(
        supabase
          .from('saidas')
          .insert({
            pessoaId,
            materialId,
            quantidade,
            centro_custo: centroCusto,
            centro_servico: centroServico,
            dataEntrega: dataEntregaIso,
            dataTroca,
            status,
            usuarioResponsavel: usuario,
          })
          .select(),
        'Falha ao registrar saida.'
      )

      return mapSaidaRecord(registro)
    },
  },
  estoque: {
    async current(params = {}) {
      const [materiais, entradas, saidas] = await Promise.all([
        carregarMateriais(),
        carregarEntradas(params),
        carregarSaidas(params),
      ])
      return montarEstoqueAtual(materiais, entradas, saidas, parsePeriodo(params))
    },
    async dashboard(params = {}) {
      const periodo = parsePeriodo(params)
      const [materiais, entradas, saidas, pessoas] = await Promise.all([
        carregarMateriais(),
        carregarEntradas(params),
        carregarSaidas(params),
        carregarPessoas(),
      ])
      return montarDashboard({ materiais, entradas, saidas, pessoas }, periodo)
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
        console.warn('Falha ao carregar agentes do cache, tentando consulta direta.', catalogoError)
      }
      const data = await execute(
        supabase
          .from('acidente_agentes')
          .select('id, nome, ativo, ordem')
          .order('ordem', { ascending: true, nullsFirst: false })
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
          .select('nome, grupo, subgrupo, ativo, ordem')
          .order('grupo', { ascending: true })
          .order('subgrupo', { ascending: true })
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('nome', { ascending: true }),
        'Falha ao listar partes lesionadas.',
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => {
          const nome = String(item.nome).trim()
          const label = [item.grupo, item.subgrupo, nome]
            .map((parte) => (parte ? String(parte).trim() : ''))
            .filter(Boolean)
            .join(' / ')
          return { nome, label: label || nome }
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
        .select('agente_id, nome, ativo, ordem, agente:acidente_agentes(nome)')
        .order('ordem', { ascending: true, nullsFirst: false })
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
        .select('nome, ativo, ordem, agente_id, agente:acidente_agentes(nome)')
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('nome', { ascending: true })
      if (agenteId) {
        query = query.eq('agente_id', agenteId)
      }
      const data = await execute(query, 'Falha ao listar tipos de acidente.')
      const tipos = new Set()
      ;(data ?? []).forEach((item) => {
        if (!item || item.ativo === false) {
          return
        }
        const agenteNome = String(item?.agente?.nome ?? '').trim()
        if (filtrarPorNome && normalizeAgenteLookupKey(agenteNome) !== alvoNormalizado) {
          return
        }
        const tipoNome = String(item.nome ?? '').trim()
        if (tipoNome) {
          tipos.add(tipoNome)
        }
      })
      return Array.from(tipos).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    },
    async locals() {
      const data = await execute(
        supabase
          .from('acidente_locais')
          .select('nome, ativo, ordem')
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('nome', { ascending: true }),
        'Falha ao listar locais de acidente.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => item.nome.trim())
        .filter(Boolean)
    },
    async create(payload) {
      const partes = normalizeStringArray(payload.partesLesionadas ?? payload.partes_lesionadas ?? [])
      let lesoes = normalizeStringArray(
        payload.lesoes ??
          payload.lesoes_list ??
          payload.lesoesSelecionadas ??
          payload.lesoesSelecionada ??
          [],
      )
      if (!lesoes.length) {
        const unica = trim(payload.lesao ?? '')
        if (unica) {
          lesoes = [unica]
        }
      }
      const lesaoPrincipal = lesoes[0] ?? ''
      const partePrincipal = partes[0] ?? trim(payload.parteLesionada)
      const agentesLista = splitMultiValue(
        payload.agentes ?? payload.agente ?? '',
      )
      const tiposLista = splitMultiValue(payload.tipos ?? payload.tipo ?? '')
      const agentePrincipal = trim(
        payload.agentePrincipal ??
          (agentesLista.length ? agentesLista[agentesLista.length - 1] : ''),
      )
      const tipoPrincipal = trim(payload.tipoPrincipal ?? tiposLista[0] ?? '')
      const dados = {
        matricula: trim(payload.matricula),
        nome: trim(payload.nome),
        cargo: trim(payload.cargo),
        tipo: tiposLista.join('; '),
        tipoPrincipal,
        agente: agentesLista.join('; '),
        agentePrincipal,
        lesao: lesaoPrincipal,
        lesoes,
        centroServico: trim(payload.centroServico ?? payload.centro_servico ?? payload.setor ?? ''),
        local: trim(payload.local) || trim(payload.centroServico ?? payload.centro_servico ?? payload.setor ?? ''),
        data: payload.data ? new Date(payload.data).toISOString() : null,
        diasPerdidos: toNumber(payload.diasPerdidos),
        diasDebitados: toNumber(payload.diasDebitados),
        hht: toNullableNumber(payload.hht),
        cid: trim(payload.cid),
        cat: trim(payload.cat),
        observacao: trim(payload.observacao),
        partesLesionadas: partes,
        partePrincipal,
      }
      if (!dados.matricula || !dados.nome || !dados.cargo || !dados.tipo || !dados.agente || !lesoes.length || !partes.length || !dados.centroServico || !dados.data) {
        throw new Error('Preencha os campos obrigatorios do acidente.')
      }
      const usuario = await resolveUsuarioResponsavel()
      await ensureAcidentePartes(partes)
      await ensureAcidenteLesoes(agentePrincipal, lesoes)
      const {
        centroServico: centroServicoDb,
        partesLesionadas: partesPayload,
        lesao: _lesaoPrincipal,
        partePrincipal: _partePrincipal,
        agentePrincipal: _agentePrincipal,
        tipoPrincipal: _tipoPrincipal,
        ...resto
      } = dados
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .insert({
            ...resto,
            centro_servico: centroServicoDb,
            partes_lesionadas: partesPayload,
            registradoPor: usuario,
          })
          .select(),
        'Falha ao registrar acidente.'
      )
      return mapAcidenteRecord(registro)
    },

    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigat?rio.')
      }
      const atual = await executeSingle(
        supabase.from('acidentes').select('*').eq('id', id),
        'Falha ao obter acidente.'
      )
      if (!atual) {
        throw new Error('Acidente n?o encontrado.')
      }

      const partes = normalizeStringArray(
        payload.partesLesionadas ?? payload.partes_lesionadas ?? atual.partes_lesionadas ?? [],
      )
      let lesoes = normalizeStringArray(
        payload.lesoes ??
          payload.lesoes_list ??
          payload.lesoesSelecionadas ??
          payload.lesoesSelecionada ??
          atual.lesoes ??
          [],
      )
      if (!lesoes.length) {
        const unica = trim(payload.lesao ?? '')
        if (unica) {
          lesoes = [unica]
        }
      }
      const lesaoPrincipal = lesoes[0] ?? ''
      const partePrincipal =
        partes[0] ??
        trim(payload.parteLesionada ?? atual.parteLesionada ?? atual.parte_lesionada ?? '')
      const agentesLista = splitMultiValue(
        payload.agentes ?? payload.agente ?? atual.agentes ?? atual.agente ?? '',
      )
      const tiposLista = splitMultiValue(
        payload.tipos ?? payload.tipo ?? atual.tipos ?? atual.tipo ?? '',
      )
      const agentePrincipal = trim(
        payload.agentePrincipal ??
          (agentesLista.length ? agentesLista[agentesLista.length - 1] : ''),
      )
      const tipoPrincipal = trim(payload.tipoPrincipal ?? tiposLista[0] ?? '')

      const dados = {
        matricula: trim(payload.matricula ?? atual.matricula),
        nome: trim(payload.nome ?? atual.nome),
        cargo: trim(payload.cargo ?? atual.cargo),
        tipo: tiposLista.join('; '),
        tipoPrincipal,
        agente: agentesLista.join('; '),
        agentePrincipal,
        lesao: lesaoPrincipal,
        lesoes,
        partesLesionadas: partes,
        centroServico: trim(payload.centroServico ?? payload.centro_servico ?? atual.centro_servico ?? atual.setor ?? ''),
        local: trim(payload.local ?? atual.local ?? ''),
        data: payload.data ? new Date(payload.data).toISOString() : atual.data,
        diasPerdidos: toNumber(payload.diasPerdidos ?? atual.diasPerdidos ?? atual.dias_perdidos ?? 0),
        diasDebitados: toNumber(payload.diasDebitados ?? atual.diasDebitados ?? atual.dias_debitados ?? 0),
        hht: toNullableNumber(payload.hht ?? atual.hht),
        cid: trim(payload.cid ?? atual.cid ?? ''),
        cat: trim(payload.cat ?? atual.cat ?? ''),
        observacao: trim(payload.observacao ?? atual.observacao ?? ''),
        partePrincipal,
      }

      if (!dados.matricula || !dados.nome || !dados.cargo || !dados.tipo || !dados.agente || !lesoes.length || !partes.length || !dados.centroServico || !dados.data) {
        throw new Error('Preencha os campos obrigatorios do acidente.')
      }

      const usuario = await resolveUsuarioResponsavel()
      await ensureAcidentePartes(partes)
      await ensureAcidenteLesoes(agentePrincipal, lesoes)

      const antigo = mapAcidenteRecord(atual)
      const novoComparacao = {
        matricula: dados.matricula,
        nome: dados.nome,
        cargo: dados.cargo,
        data: dados.data,
        tipo: dados.tipo,
        agente: dados.agente,
        lesao: lesaoPrincipal,
        lesoes,
        partesLesionadas: partes,
        parteLesionada: partePrincipal ?? '',
        centroServico: dados.centroServico,
        local: dados.local,
        diasPerdidos: dados.diasPerdidos,
        diasDebitados: dados.diasDebitados,
        hht: dados.hht,
        cid: dados.cid,
        cat: dados.cat,
        observacao: dados.observacao,
      }
      const camposAlterados = []
      ACIDENTE_HISTORY_FIELDS.forEach((campo) => {
        const valorAtual = normalizeHistoryValue(antigo[campo])
        const valorNovo = normalizeHistoryValue(novoComparacao[campo])
        if (valorAtual !== valorNovo) {
          camposAlterados.push({
            campo,
            de: valorAtual,
            para: valorNovo,
          })
        }
      })
      const agora = new Date().toISOString()
      const historicoRegistro =
        camposAlterados.length > 0
          ? {
              acidente_id: id,
              data_edicao: agora,
              usuario_responsavel: usuario,
              campos_alterados: camposAlterados,
            }
          : null

      const {
        centroServico: centroServicoDb,
        partesLesionadas: partesPayload,
        lesao: _lesaoPrincipal,
        partePrincipal: _partePrincipal,
        ...resto
      } = dados
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .update({
            ...resto,
            centro_servico: centroServicoDb,
            partes_lesionadas: partesPayload,
            atualizadoPor: usuario,
            atualizadoEm: agora,
          })
          .eq('id', id)
          .select(),
        'Falha ao atualizar acidente.'
      )
      await ensureAcidentePartes(partes)
      if (historicoRegistro) {
        await execute(
          supabase.from('acidente_historico').insert(historicoRegistro),
          'Falha ao registrar histórico do acidente.'
        )
      }
      return mapAcidenteRecord(registro)
    },
    async history(id) {
      if (!id) {
        throw new Error('ID obrigatório.')
      }
      const data = await execute(
        supabase
          .from('acidente_historico')
          .select('id, data_edicao, usuario_responsavel, campos_alterados')
          .eq('acidente_id', id)
          .order('data_edicao', { ascending: false }),
        'Falha ao obter histórico do acidente.'
      )
      return (data ?? []).map((item) => ({
        id: item.id,
        dataEdicao: item.data_edicao ?? item.dataEdicao ?? null,
        usuarioResponsavel: item.usuario_responsavel ?? item.usuarioResponsavel ?? '',
        camposAlterados: Array.isArray(item.campos_alterados ?? item.camposAlterados)
          ? item.campos_alterados ?? item.camposAlterados
          : [],
      }))
    },

async dashboard(params = {}) {
      const acidentes = await carregarAcidentes()
      return montarDashboardAcidentes(acidentes, params)
    },
  },
  references: {
    async pessoas() {
      const [centros, setores, cargos, tipos] = await Promise.all([
        execute(
          supabase.from('centros_servico').select('id, nome').order('nome'),
          'Falha ao carregar centros de servico.'
        ),
        execute(
          supabase.from('setores').select('id, nome').order('nome'),
          'Falha ao carregar setores.'
        ),
        execute(
          supabase.from('cargos').select('id, nome').order('nome'),
          'Falha ao carregar cargos.'
        ),
        execute(
          supabase.from('tipo_execucao').select('id, nome').order('nome'),
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
  documentos: {
    async termoEpiContext(params = {}) {
      const matricula = trim(params.matricula)
      const nome = trim(params.nome)
      if (!matricula && !nome) {
        throw new Error('Informe a matrícula ou o nome do colaborador.')
      }

      let pessoa = null
      if (matricula) {
        pessoa = await executeSingle(
          supabase.from('pessoas').select('*').eq('matricula', matricula),
          'Falha ao consultar colaborador.'
        )
      }
      if (!pessoa && nome) {
        const like = `%${nome.replace(/\s+/g, '%')}%`
        const resultados = await execute(
          supabase.from('pessoas').select('*').ilike('nome', like).order('nome').limit(1),
          'Falha ao consultar colaborador.'
        )
        pessoa = resultados?.[0] ?? null
      }

      if (!pessoa) {
        throw new Error('Colaborador não encontrado.')
      }

      const saidas = await execute(
        supabase
          .from('saidas')
          .select(
            `*, material:materialId (*), pessoa:pessoaId (*)`
          )
          .eq('pessoaId', pessoa.id)
          .order('dataEntrega', { ascending: true }),
        'Falha ao listar saidas do colaborador.'
      )

      if (!saidas || saidas.length === 0) {
        throw new Error('Nenhuma saida registrada para o colaborador informado.')
      }

      const saidasDetalhadas = (saidas ?? []).map((registro) => ({
        ...mapSaidaRecord(registro),
        material: mapMaterialRecord(registro.material),
      }))

      const contexto = montarContextoTermoEpi(mapPessoaRecord(pessoa), saidasDetalhadas)
      return {
        ...contexto,
        empresa: {
          nome: import.meta.env.VITE_TERMO_EPI_EMPRESA_NOME ?? '',
          documento: import.meta.env.VITE_TERMO_EPI_EMPRESA_DOCUMENTO ?? '',
          endereco: import.meta.env.VITE_TERMO_EPI_EMPRESA_ENDERECO ?? '',
          contato: import.meta.env.VITE_TERMO_EPI_EMPRESA_CONTATO ?? '',
          logoUrl: import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_URL ?? '',
          logoSecundarioUrl: import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL ?? '',
        },
      }
    },
  },
}



const normalizeReferenceLookupKey = (valor) => {
  const texto = resolveTextValue(valor)
  if (!texto) {
    return ''
  }
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const buildReferenceCacheKey = (tabela, colunaTexto, colunaId, tipo, valor) =>
  [tabela || '', colunaTexto || '', colunaId || '', tipo || '', valor || ''].join('::')

const extractReferenceInput = (valor, colunaTexto, colunaId) => {
  if (valor === undefined || valor === null) {
    return { id: null, nome: '' }
  }

  const registro = unwrapOptionRecord(valor)
  if (registro && typeof registro === 'object' && !Array.isArray(registro)) {
    const idCandidates = [colunaId, 'id', 'uuid', 'value', 'valor', 'codigo', 'code']
    let id = null
    for (const candidate of idCandidates) {
      if (!candidate) {
        continue
      }
      id = normalizeOptionId(registro[candidate])
      if (id) {
        break
      }
    }

    const textoCandidates = [
      registro[colunaTexto],
      registro.nome,
      registro.label,
      registro.descricao,
      registro.valor,
      registro.value,
    ]

    let nome = ''
    for (const candidate of textoCandidates) {
      const texto = resolveTextValue(candidate)
      if (texto) {
        nome = texto
        break
      }
    }

    if (!nome) {
      nome = resolveTextValue(valor)
    }

    if (id || nome) {
      return { id: id || null, nome }
    }
  }

  const idDireto = normalizeOptionId(valor)
  const nomeDireto = resolveTextValue(valor)
  return { id: idDireto || null, nome: nomeDireto }
}

const resolveReferencia = async (valorTexto, tabela, colunaTexto = 'nome', colunaId = 'id') => {
  const tableName = trim(tabela)
  if (!tableName) {
    return null
  }

  const { id: inputId, nome: inputNome } = extractReferenceInput(valorTexto, colunaTexto, colunaId)
  const normalizedText = normalizeReferenceLookupKey(inputNome)

  const cache = resolveReferencia.cache || (resolveReferencia.cache = new Map())
  const idKey = inputId
    ? buildReferenceCacheKey(tableName, colunaTexto, colunaId, 'id', inputId)
    : null
  const textKey = normalizedText
    ? buildReferenceCacheKey(tableName, colunaTexto, colunaId, 'text', normalizedText)
    : null

  const cachedKeys = [idKey, textKey].filter(Boolean)
  for (const key of cachedKeys) {
    if (cache.has(key)) {
      return cache.get(key)
    }
  }

  if (!inputId && !normalizedText) {
    return null
  }

  const selectFields = [colunaId, colunaTexto].filter(Boolean)
  const selectColumns = selectFields.length > 0 ? selectFields.join(', ') : '*'
  const fallbackMessage = `Falha ao consultar ${tableName}.`
  const pickFirst = (rows) => (Array.isArray(rows) && rows.length ? rows[0] ?? null : null)

  let registro = null

  if (inputId) {
    const dataPorId = await execute(
      supabase.from(tableName).select(selectColumns).eq(colunaId, inputId).limit(1),
      fallbackMessage,
    )
    registro = pickFirst(dataPorId)
  }

  const textoBusca = trim(inputNome)
  if (!registro && textoBusca) {
    const dataEq = await execute(
      supabase.from(tableName).select(selectColumns).eq(colunaTexto, textoBusca).limit(1),
      fallbackMessage,
    )
    registro = pickFirst(dataEq)

    if (!registro) {
      const dataIlike = await execute(
        supabase
          .from(tableName)
          .select(selectColumns)
          .ilike(colunaTexto, textoBusca)
          .order(colunaTexto, { ascending: true })
          .limit(1),
        fallbackMessage,
      )
      registro = pickFirst(dataIlike)
    }
  }

  const resolvedId = normalizeOptionId(registro?.[colunaId] ?? inputId)
  const resolvedNome = resolveTextValue(
    registro && colunaTexto ? registro[colunaTexto] : inputNome,
  )

  const resultado = resolvedId || resolvedNome ? { id: resolvedId ?? null, nome: resolvedNome || '' } : null

  const resolvedIdKey = resultado?.id
    ? buildReferenceCacheKey(tableName, colunaTexto, colunaId, 'id', resultado.id)
    : null
  const resolvedTextKey = resultado?.nome
    ? buildReferenceCacheKey(
        tableName,
        colunaTexto,
        colunaId,
        'text',
        normalizeReferenceLookupKey(resultado.nome),
      )
    : null

  const keysToStore = [idKey, textKey, resolvedIdKey, resolvedTextKey].filter(Boolean)
  keysToStore.forEach((key) => {
    cache.set(key, resultado)
  })

  return resultado
}

async function resolveRefs(payload, mappings = {}) {
  if (!payload || typeof payload !== 'object' || !mappings || typeof mappings !== 'object') {
    return {}
  }

  const entries = Object.entries(mappings)
  if (!entries.length) {
    return {}
  }

  const resolvedEntries = await Promise.all(
    entries.map(async ([alias, config]) => {
      if (!config || typeof config !== 'object') {
        return null
      }

      const {
        tabela,
        colunaTexto = 'nome',
        colunaId = 'id',
        sourceKey,
        from,
        field,
        value: explicitValue,
      } = config

      if (!tabela) {
        return { key: alias, value: null }
      }

      const resolvedSourceKey = field ?? from ?? sourceKey ?? alias
      const rawValue = explicitValue !== undefined ? explicitValue : payload?.[resolvedSourceKey]

      if (rawValue === undefined || rawValue === null) {
        return { key: alias, value: null }
      }

      const { id: existingId, nome: existingNome } = extractReferenceInput(
        rawValue,
        colunaTexto,
        colunaId,
      )
      if (!existingId && !existingNome) {
        return { key: alias, value: null }
      }

      const referencia = await resolveReferencia(rawValue, tabela, colunaTexto, colunaId)
      return { key: alias, value: referencia ?? null }
    }),
  )

  return resolvedEntries.reduce((acc, entry) => {
    if (!entry) {
      return acc
    }
    acc[entry.key] = entry.value
    return acc
  }, {})
}

async function resolveReferenceId(table, value, errorMessage) {
  const { id: entradaId, nome: entradaNome } = extractReferenceInput(value, 'nome', 'id')
  if (!entradaId && !entradaNome) {
    throw new Error(errorMessage ?? ('Informe um valor para ' + table + '.'))
  }

  const referencia = await resolveReferencia(value, table)
  const id = referencia?.id ?? null
  if (!id) {
    const label = entradaNome || entradaId || ''
    throw new Error(
      errorMessage ?? (label ? `Valor "${label}" não encontrado.` : 'Valor não encontrado.'),
    )
  }
  return id
}

async function resolvePessoaReferencias(dados) {
  const centroServicoId = await resolveReferenceId(
    'centros_servico',
    dados.centroServico,
    'Selecione um centro de serviço válido.'
  )
  const setorNome = dados.setor || dados.centroServico
  const setorId = await resolveReferenceId(
    'setores',
    setorNome,
    'Selecione um setor válido.'
  )
  const cargoId = await resolveReferenceId(
    'cargos',
    dados.cargo,
    'Selecione um cargo válido.'
  )
  const centroCustoId = await resolveReferenceId(
    'centros_custo',
    dados.centroServico,
    'Selecione um centro de custo válido.'
  )
  const tipoExecucaoId = await resolveReferenceId(
    'tipo_execucao',
    dados.tipoExecucao || 'PROPRIO',
    'Selecione o tipo de execução.'
  )
  return {
    centroServicoId,
    setorId,
    cargoId,
    centroCustoId,
    tipoExecucaoId,
  }
}


export { resolveReferencia, resolveRefs }







