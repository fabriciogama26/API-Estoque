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
  'dataEsocial',
  'sesmt',
  'dataSesmt',
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

const PESSOAS_VIEW_SELECT = `
  id,
  nome,
  matricula,
  "dataAdmissao",
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
  centro_servico,
  setor,
  cargo,
  centro_custo,
  tipo_execucao
`

const buildPessoasViewQuery = () => supabase.from('pessoas_view').select(PESSOAS_VIEW_SELECT)

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
    throw new Error('Selecione o centro de custo.')
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
    console.warn('Nao foi possivel resolver centro de estoque.', error)
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
    console.warn('Nao foi possivel resolver material.', error)
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
    console.warn('Nao foi possivel carregar materiais por ids.', error)
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
    console.warn('Nao foi possivel resolver pessoa.', error)
    return null
  }
}

async function buildEntradaSnapshot(entrada) {
  if (!entrada) {
    return null
  }
  const [material, centroNome] = await Promise.all([
    fetchMaterialSnapshot(entrada.materialId),
    resolveCentroCustoNome(entrada.centroCustoId || entrada.centroCusto),
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
  }
}

async function registrarEntradaHistoricoSupabase(entradaAtual, entradaAnterior = null) {
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
    console.warn('Nao foi possivel registrar historico da entrada.', error)
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
  const filtros = [
    `nome.ilike.${like}`,
    `matricula.ilike.${like}`,
    `usuarioCadastro.ilike.${like}`,
    `usuarioCadastroNome.ilike.${like}`,
    `usuarioEdicao.ilike.${like}`,
    `usuarioEdicaoNome.ilike.${like}`,
    `centro_servico.ilike.${like}`,
    `setor.ilike.${like}`,
    `cargo.ilike.${like}`,
    `centro_custo.ilike.${like}`,
    `tipo_execucao.ilike.${like}`,
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
  const grupoMaterialPersist = dados.grupoMaterialId || dados.grupoMaterial || ''
  const payload = {
    nome: nomePersist,
    fabricante: fabricantePersist,
    validadeDias: dados.validadeDias ?? null,
    ca: dados.ca ?? '',
    valorUnitario: dados.valorUnitario ?? 0,
    estoqueMinimo: dados.estoqueMinimo ?? 0,
    ativo: dados.ativo ?? true,
    descricao: dados.descricao ?? '',
    grupoMaterial: grupoMaterialPersist,
    numeroCalcado: dados.numeroCalcado || null,
    numeroVestimenta: dados.numeroVestimenta || null,
    numeroEspecifico: dados.numeroEspecifico ?? '',
  }

  if (includeCreateAudit) {
    payload.usuarioCadastro = usuario ?? ''
    payload.dataCadastro = agora ?? new Date().toISOString()
  }

  if (includeUpdateAudit) {
    payload.usuarioAtualizacao = usuario ?? ''
    payload.atualizadoEm = agora ?? new Date().toISOString()
  }

  return payload
}

async function resolveUsuarioResponsavel() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) {
    return 'anônimo'
  }
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
    caracteristicas: caracteristicasLista,
    caracteristicasIds,
    caracteristicasNomes,
    caracteristicasTexto,
    corMaterial: coresLista[0]?.nome || coresTexto || '',
    cores: coresLista,
    coresIds,
    coresNomes,
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
  }
}

function mapEntradaRecord(record) {
  if (!record) {
    return null
  }
  const centroEstoqueValor = record.centroEstoque ?? record.centro_estoque ?? null
  const centroCustoRaw = record.centroCusto ?? record.centro_custo ?? ''
  const centroCustoId = normalizeUuid(centroEstoqueValor ?? centroCustoRaw)
  const centroCustoNome =
    resolveTextValue(
      record.centroEstoqueNome ??
        record.centroEstoqueNome ??
        record.centro_custo_nome ??
        record.centro_estoque_nome ??
        '',
    ) ||
    (centroCustoId ? '' : resolveTextValue(centroCustoRaw))
  const usuarioRaw = record.usuarioResponsavel ?? record.usuario_responsavel ?? ''
  const usuarioId = isUuidValue(usuarioRaw) ? usuarioRaw : null
  const usuarioTexto = resolveTextValue(usuarioRaw)
  return {
    id: record.id,
    materialId: record.materialId ?? record.material_id ?? null,
    quantidade: toNumber(record.quantidade),
    centroCustoId: centroCustoId ?? null,
    centroCusto: centroCustoNome || centroCustoRaw || '',
    dataEntrada: record.dataEntrada ?? record.data_entrada ?? null,
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? '' : usuarioTexto,
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
    centroCustoId: record.centroCustoId ?? record.centro_custo ?? null,
    centroCusto: resolveTextValue(record.centroCustoNome ?? record.centroCusto ?? record.centro_custo ?? ''),
    centroServicoId: record.centroServicoId ?? record.centro_servico ?? null,
    centroServico: resolveTextValue(
      record.centroServicoNome ?? record.centroServico ?? record.centro_servico ?? ''
    ),
    dataEntrega: record.dataEntrega ?? record.data_entrega ?? null,
    dataTroca: record.dataTroca ?? record.data_troca ?? null,
    statusId,
    status: statusTexto || statusRaw,
    statusNome: statusRelNome || statusTexto || statusRaw,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelId: usuarioId,
    usuarioResponsavelNome: usuarioId ? '' : usuarioTexto,
  }
}

function mapSaidaHistoryRecord(record) {
  if (!record) {
    return null
  }
  const usuarioNome = resolveTextValue(
    record.usuario?.display_name ??
      record.usuario?.username ??
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
    status: saida.status,
    statusId: saida.statusId || '',
    dataEntrega: saida.dataEntrega,
    dataTroca: saida.dataTroca,
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
    console.warn('Nao foi possivel registrar historico da saida.', error)
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
    dataEsocial: record.dataEsocial ?? record.data_esocial ?? null,
    sesmt: Boolean(record.sesmt ?? record.sesmt_flag ?? false),
    dataSesmt: record.dataSesmt ?? record.data_sesmt ?? null,
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

function sanitizeMaterialPayload(payload = {}) {
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
  const nomeDisplayId = trim(payload.nome ?? payload.materialItemNome ?? payload.nomeItemRelacionado ?? '')
  const nomeEpi =
    trim(payload.materialItemNome ?? payload.nomeItemRelacionado ?? payload.nome ?? '') || ''
  const materialItemNome =
    nomeEpi || trim(payload.materialItemNome ?? payload.nomeItemRelacionado ?? '')
  const fabricanteId = normalizeRelationId(payload.fabricante ?? payload.fabricante_id ?? '')
  const nomeId = normalizeRelationId(nomeDisplayId)
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
  const data = await execute(
    supabase
      .from(sourceTable)
      .select(MATERIAL_SELECT_COLUMNS)
      .or(filtros.join(','))
      .order('nome', { ascending: true })
      .order('fabricante', { ascending: true, nullsFirst: false })
      .limit(limiteSeguro),
    'Falha ao buscar materiais.'
  )
  return (data ?? []).map(mapMaterialRecord)
}

async function carregarCentrosCusto() {
  const data = await execute(
    supabase.from(CENTROS_CUSTO_TABLE).select('id, nome').order('nome', { ascending: true }),
    'Falha ao listar centros de custo.'
  )
  return normalizeDomainOptions(data ?? [])
}

async function carregarCentrosEstoqueCatalogo() {
  const data = await execute(
    supabase.from(CENTRO_ESTOQUE_TABLE).select('id, almox').order('almox', { ascending: true }),
    'Falha ao listar centros de estoque.'
  )
  return normalizeDomainOptions(
    (data ?? []).map((item) => ({
      id: item?.id ?? null,
      nome: resolveTextValue(item?.almox ?? ''),
    }))
  )
}

async function carregarCentrosServico() {
  const data = await execute(
    supabase.from('centros_servico').select('id, nome').order('nome'),
    'Falha ao listar centros de serviço.'
  )
  return normalizeDomainOptions(data ?? [])
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
  const centroFiltro = trim(params.centroCusto)
  if (centroFiltro) {
    if (isUuidValue(centroFiltro)) {
      query = query.or(`centro_estoque.eq.${centroFiltro},centro_custo.eq.${centroFiltro}`)
    } else {
      query = query.ilike('centro_custo', `%${centroFiltro}%`)
    }
  }
  const registradoPor = trim(params.registradoPor)
  if (registradoPor) {
    query = isUuidValue(registradoPor)
      ? query.eq('usuarioResponsavel', registradoPor)
      : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
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
    supabase.from('status_saida').select('id, status'),
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
    new Set(registros.map((entrada) => entrada.usuarioResponsavelId).filter(Boolean))
  )
  if (!ids.length) {
    return registros.map((entrada) => ({
      ...entrada,
      usuarioResponsavelNome: entrada.usuarioResponsavel,
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
    const mapa = new Map(
      (usuarios ?? []).map((usuario) => [
        usuario.id,
        resolveTextValue(usuario.display_name ?? usuario.username ?? usuario.email ?? ''),
      ])
    )
    return registros.map((entrada) => {
      const nome =
        entrada.usuarioResponsavelId && mapa.has(entrada.usuarioResponsavelId)
          ? mapa.get(entrada.usuarioResponsavelId)
          : entrada.usuarioResponsavel
      return {
        ...entrada,
        usuarioResponsavelNome: nome || '',
        usuarioResponsavel: nome || entrada.usuarioResponsavel,
      }
    })
  } catch (error) {
    console.warn('Falha ao resolver usuarios responsaveis.', error)
    return registros.map((entrada) => ({
      ...entrada,
      usuarioResponsavelNome: entrada.usuarioResponsavel,
    }))
  }
}

const STATUS_SAIDA_CACHE_TTL = 5 * 60 * 1000
let statusSaidaCache = null
let statusSaidaCacheTimestamp = 0
const statusCanceladoIds = new Set()

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
    console.warn('Falha ao resolver status das saidas.', error)
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
    console.warn('Falha ao resolver centros de estoque.', error)
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
    console.warn('Falha ao resolver centros de custo.', error)
    return registros
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
    if (isUuidValue(statusFiltro)) {
      query = query.eq('status', statusFiltro)
    } else {
      query = query.eq('status', statusFiltro)
    }
  }

  const registradoPor = trim(params.registradoPor)
  if (registradoPor) {
    query = isUuidValue(registradoPor)
      ? query.eq('usuarioResponsavel', registradoPor)
      : query.ilike('usuarioResponsavel', `%${registradoPor}%`)
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
              centro_servico_id,
              centros_servico ( id, nome ),
              setor_id,
              setores ( id, nome ),
              cargo_id,
              cargos ( id, nome ),
              centro_custo_id,
              centros_custo ( id, nome ),
              tipo_execucao_id,
              tipo_execucao ( id, nome )
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
    supabase.from('acidentes').select('*').order('data', { ascending: false }),
    'Falha ao listar acidentes.'
  )
  return (data ?? []).map(mapAcidenteRecord)
}

async function calcularSaldoMaterialAtual(materialId) {
  await ensureStatusCanceladoIdLoaded()
  const [entradas, saidas] = await Promise.all([
    execute(
      supabase.from('entradas').select('materialId, quantidade, dataEntrada').eq('materialId', materialId),
      'Falha ao consultar entradas.'
    ),
    execute(
      supabase
        .from('saidas')
        .select('materialId, quantidade, dataEntrega, status, status_rel:status_saida ( id, status )')
        .eq('materialId', materialId),
      'Falha ao consultar saidas.'
    ),
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
  data.setUTCHours(0, 0, 0, 0)
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
        let builder = buildPessoasViewQuery().order('nome', { ascending: true })

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
        const registros = (data ?? []).map(mapPessoaRecord)
        return registros
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
    async search(params = {}) {
      const termo = params?.termo ?? params?.q ?? params?.query ?? ''
      const limit = params?.limit ?? 10
      return buscarMateriaisPorTermo(termo, limit)
    },
    async create(payload) {
      const dados = sanitizeMaterialPayload(payload)
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
      const corRelationIds =
        corNames.length > 0 ? await resolveCorIdsFromNames(corNames) : coresIds
      const caracteristicaRelationIds =
        caracteristicaNames.length > 0
          ? await resolveCaracteristicaIdsFromNames(caracteristicaNames)
          : caracteristicaIds
      const supabasePayload = buildMaterialSupabasePayload(dados, {
        usuario,
        agora,
        includeCreateAudit: true,
        includeUpdateAudit: true,
      })

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

        await insereCores(materialCriadoId, corRelationIds, corNames)
        await insereCaracteristicas(
          materialCriadoId,
          caracteristicaRelationIds,
          caracteristicaNames,
        )
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
      const dadosCombinados = sanitizeMaterialPayload({ ...materialAtual, ...payload })
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
      const dados = sanitizeMaterialPayload(payload)
      const coresIds = Array.isArray(dados.coresIds) ? dados.coresIds : []
      const caracteristicaIds = Array.isArray(dados.caracteristicasIds)
        ? dados.caracteristicasIds
        : []
      const corNames = extractTextualNames(dados.cores)
      const caracteristicaNames = extractTextualNames(dados.caracteristicas)
      const corRelationIds =
        corNames.length > 0 ? await resolveCorIdsFromNames(corNames) : coresIds
      const caracteristicaRelationIds =
        caracteristicaNames.length > 0
          ? await resolveCaracteristicaIdsFromNames(caracteristicaNames)
          : caracteristicaIds
      const supabasePayload = buildMaterialSupabasePayload(dados, {
        usuario,
        agora,
        includeUpdateAudit: true,
      })

      await execute(
        supabase.from('materiais').update(supabasePayload).eq('id', id),
        'Falha ao atualizar material.'
      )
      await insereCores(id, corRelationIds, corNames)
      await insereCaracteristicas(id, caracteristicaRelationIds, caracteristicaNames)
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
    materialOptions: carregarMateriaisDeEntradas,
    async searchMateriais(params = {}) {
      const termo = params?.termo ?? params?.q ?? params?.query ?? ''
      const limit = Number.isFinite(Number(params?.limit)) ? Number(params.limit) : 10
      return buscarMateriaisPorTermo(termo, limit, { source: ENTRADAS_MATERIAIS_VIEW })
    },
    async create(payload) {
      const usuario = await resolveUsuarioResponsavel()
      const dados = normalizeEntradaInput(payload)
      const registro = await executeSingle(
        supabase
          .from('entradas')
          .insert({
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centro_estoque: dados.centroCusto,
            centro_custo: dados.centroCusto,
            dataEntrada: dados.dataEntrada,
            usuarioResponsavel: usuario,
          })
          .select(),
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
      const usuario = await resolveUsuarioResponsavel()
      const dados = normalizeEntradaInput(payload)
      const registro = await executeSingle(
        supabase
          .from('entradas')
          .update({
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centro_estoque: dados.centroCusto,
            centro_custo: dados.centroCusto,
            dataEntrada: dados.dataEntrada,
            usuarioResponsavel: usuario,
          })
          .eq('id', id)
          .select(),
        'Falha ao atualizar entrada.'
      )
      const entradaNormalizada = mapEntradaRecord(registro)
      await registrarEntradaHistoricoSupabase(entradaNormalizada, entradaAnterior)
      return entradaNormalizada
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
      const usuario = await resolveUsuarioResponsavel()
      const pessoaId = trim(payload.pessoaId)
      const materialId = trim(payload.materialId)
      const quantidade = toNumber(payload.quantidade, null)
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
      if (!centroCustoIdFinal) {
        throw new Error('Centro de custo inválido.')
      }
      if (!centroServicoIdFinal) {
        throw new Error('Centro de serviço inválido.')
      }

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
            centro_custo: centroCustoIdFinal,
            centro_servico: centroServicoIdFinal,
            dataEntrega: dataEntregaIso,
            dataTroca,
            status,
            usuarioResponsavel: usuario,
          })
          .select(),
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
      const usuario = await resolveUsuarioResponsavel()
      const pessoaId = trim(payload.pessoaId ?? saidaAtual.pessoaId)
      const materialId = trim(payload.materialId ?? saidaAtual.materialId)
      const quantidade = toNumber(payload.quantidade, null)
      const dataEntregaEntrada = trim(payload.dataEntrega ?? '')
      if (!pessoaId || !materialId || !quantidade || quantidade <= 0) {
        throw new Error('Preencha pessoa, material e quantidade (>0).')
      }
      if (!dataEntregaEntrada && !saidaAtual.dataEntrega) {
        throw new Error('Informe a data de entrega.')
      }
      const dataEntregaDate = dataEntregaEntrada
        ? buildDateWithCurrentTime(dataEntregaEntrada)
        : saidaAtual.dataEntrega
        ? new Date(saidaAtual.dataEntrega)
        : null
      if (!dataEntregaDate || Number.isNaN(dataEntregaDate.getTime())) {
        throw new Error('Data de entrega invalida.')
      }

      let centroCustoIdFinal = trim(payload.centroCustoId ?? '') || saidaAtual.centroCustoId || null
      let centroServicoIdFinal = trim(payload.centroServicoId ?? '') || saidaAtual.centroServicoId || null
      if (!centroCustoIdFinal || !centroServicoIdFinal || pessoaId !== saidaAtual.pessoaId) {
        const pessoa = await executeSingle(
          supabase.from('pessoas').select('centro_servico_id, centro_custo_id').eq('id', pessoaId),
          'Falha ao obter pessoa.'
        )
        centroCustoIdFinal = centroCustoIdFinal || pessoa?.centro_custo_id || null
        centroServicoIdFinal = centroServicoIdFinal || pessoa?.centro_servico_id || null
      }
      if (!centroCustoIdFinal) {
        throw new Error('Centro de custo inválido.')
      }
      if (!centroServicoIdFinal) {
        throw new Error('Centro de serviço inválido.')
      }

      const material = await executeSingle(
        supabase.from('materiais').select('id, validadeDias').eq('id', materialId),
        'Falha ao obter material.'
      )

      const estoqueDisponivel = await calcularSaldoMaterialAtual(materialId)
      const quantidadeAnterior = toNumber(saidaAtual.quantidade, 0)
      const estoqueConsiderado =
        materialId === saidaAtual.materialId ? estoqueDisponivel + quantidadeAnterior : estoqueDisponivel
      if (quantidade > estoqueConsiderado) {
        const error = new Error('Quantidade informada maior que o estoque disponível.')
        error.status = 400
        throw error
      }

      const dataEntregaIso = dataEntregaDate.toISOString()
      const dataTroca = calcularDataTroca(dataEntregaIso, material?.validadeDias)
      const statusValor =
        trim(payload.statusId ?? payload.status ?? '') ||
        saidaAtual.statusId ||
        saidaAtual.status ||
        STATUS_ENTREGUE_ID

      const registro = await executeSingle(
        supabase
          .from('saidas')
          .update({
            pessoaId,
            materialId,
            quantidade,
            centro_custo: centroCustoIdFinal,
            centro_servico: centroServicoIdFinal,
            dataEntrega: dataEntregaIso,
            dataTroca,
            status: statusValor,
            usuarioResponsavel: usuario,
          })
          .eq('id', id)
          .select(),
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
      const usuario = await resolveUsuarioResponsavel()
      let statusCanceladoId = await resolveStatusSaidaIdByName(STATUS_CANCELADO_NOME)
      if (!statusCanceladoId) {
        throw new Error('Status CANCELADO nao encontrado.')
      }
      const registro = await executeSingle(
        supabase
          .from('saidas')
          .update({
            status: statusCanceladoId,
            usuarioResponsavel: usuario,
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
        supabase
          .from('saidas_historico')
          .select(
            `
              id,
              saida_id,
              material_id,
              material_saida,
              created_at,
              usuario:usuarioResponsavel ( id, display_name, username, email )
            `
          )
          .eq('saida_id', id)
          .order('created_at', { ascending: false }),
        'Falha ao listar historico de saida.'
      )
      return (registros ?? []).map(mapSaidaHistoryRecord)
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
    async saldo(materialId) {
      return obterSaldoMaterial(materialId)
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
        dataEsocial: payload.dataEsocial ? new Date(payload.dataEsocial).toISOString() : null,
        sesmt: Boolean(payload.sesmt),
        dataSesmt: payload.dataSesmt ? new Date(payload.dataSesmt).toISOString() : null,
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
        dataEsocial,
        sesmt,
        dataSesmt,
        ...resto
      } = dados
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .insert({
            ...resto,
            centro_servico: centroServicoDb,
            partes_lesionadas: partesPayload,
            data_esocial: dataEsocial,
            sesmt,
            data_sesmt: dataSesmt,
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
        dataEsocial:
          payload.dataEsocial !== undefined && payload.dataEsocial !== null
            ? (payload.dataEsocial ? new Date(payload.dataEsocial).toISOString() : null)
            : atual.data_esocial ?? atual.dataEsocial ?? null,
        sesmt:
          payload.sesmt !== undefined
            ? Boolean(payload.sesmt)
            : Boolean(atual.sesmt),
        dataSesmt:
          payload.dataSesmt !== undefined && payload.dataSesmt !== null
            ? (payload.dataSesmt ? new Date(payload.dataSesmt).toISOString() : null)
            : atual.data_sesmt ?? atual.dataSesmt ?? null,
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
        dataEsocial: dados.dataEsocial,
        sesmt: dados.sesmt,
        dataSesmt: dados.dataSesmt,
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
        agentePrincipal: _agentePrincipal,
        tipoPrincipal: _tipoPrincipal,
        dataEsocial,
        sesmt,
        dataSesmt,
        ...resto
      } = dados
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .update({
            ...resto,
            centro_servico: centroServicoDb,
            partes_lesionadas: partesPayload,
            data_esocial: dataEsocial,
            sesmt,
            data_sesmt: dataSesmt,
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
      let usuarioNomeMap = new Map()
      if (responsaveisIds.length > 0) {
        try {
          const usuarios = await execute(
            supabase.from('app_users').select('id, display_name, username, email').in('id', responsaveisIds),
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
          console.warn('Nao foi possivel resolver nomes dos usuarios do historico de acidentes.', usuarioError)
        }
      }
      return registros.map((item) => {
        const usuarioId = (item.usuario_responsavel ?? item.usuarioResponsavel ?? '').trim()
        const usuarioNome = usuarioId
          ? usuarioNomeMap.get(usuarioId) ?? usuarioId
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
      if (!matricula && !nome) {
        throw new Error('Informe a matrícula ou o nome do colaborador.')
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

async function resolveReferenceId(table, value, errorMessage) {
  const nome = trim(value)
  if (!nome) {
    throw new Error(errorMessage ?? ('Informe um valor para ' + table + '.'))
  }

  const data = await execute(
    supabase.from(table).select('id').eq('nome', nome).limit(1),
    'Falha ao consultar ' + table + '.'
  )

  const id = Array.isArray(data) && data.length ? data[0]?.id ?? null : null
  if (!id) {
    throw new Error(errorMessage ?? ('Valor "' + nome + '" não encontrado.'))
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

async function carregarPessoasViewDetalhes(ids) {
  const selecionados = Array.from(new Set((ids || []).filter(Boolean)))
  if (selecionados.length === 0) {
    return new Map()
  }
  try {
    const registros = await execute(
      supabase
        .from('pessoas_view')
        .select(
          `
            id,
            centro_servico_id,
            centro_servico,
            setor_id,
            setor,
            cargo_id,
            cargo,
            centro_custo_id,
            centro_custo,
            tipo_execucao_id,
            tipo_execucao
          `
        )
        .in('id', selecionados),
      'Falha ao consultar pessoas_view.'
    )
    const mapa = new Map()
    ;(registros ?? []).forEach((registro) => {
      if (!registro?.id) {
        return
      }
      mapa.set(registro.id, {
        centroServicoId: registro.centro_servico_id ?? null,
        centroServico: resolveTextValue(registro.centro_servico ?? ''),
        setorId: registro.setor_id ?? null,
        setor: resolveTextValue(registro.setor ?? ''),
        cargoId: registro.cargo_id ?? null,
        cargo: resolveTextValue(registro.cargo ?? ''),
        centroCustoId: registro.centro_custo_id ?? null,
        centroCusto: resolveTextValue(registro.centro_custo ?? ''),
        tipoExecucaoId: registro.tipo_execucao_id ?? null,
        tipoExecucao: resolveTextValue(registro.tipo_execucao ?? ''),
      })
    })
    return mapa
  } catch (error) {
    console.warn('Nao foi possivel usar pessoas_view como fallback.', error)
    return new Map()
  }
}
