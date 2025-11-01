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

const resolveTextValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'object') {
    if (typeof value.nome === 'string') {
      return value.nome.trim()
    }
    if (typeof value.label === 'string') {
      return value.label.trim()
    }
    if (typeof value.descricao === 'string') {
      return value.descricao.trim()
    }
  }
  return String(value).trim()
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

const MATERIAL_HISTORY_FIELDS = [
  'nome',
  'fabricante',
  'validadeDias',
  'ca',
  'valorUnitario',
  'estoqueMinimo',
  'ativo',
  'descricao',
  'grupoMaterial',
  'numeroCalcado',
  'numeroVestimenta',
  'numeroEspecifico',
  'chaveUnica',
]

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
}

async function resolveAgenteId(agenteNome) {
  const nome = trim(agenteNome)
  if (!nome) {
    return null
  }
  const alvoNormalizado = normalizeAgenteLookupKey(nome)
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from('acidente_agentes')
      .select('id, nome')
      .eq('nome', nome)
      .limit(1)
    if (error) {
      throw error
    }
    if (Array.isArray(data) && data.length === 1) {
      return data[0]?.id ?? null
    }
    const { data: fallback, error: fallbackError } = await supabase
      .from('acidente_agentes')
      .select('id, nome')
      .ilike('nome', nome)
      .limit(1)
    if (fallbackError) {
      throw fallbackError
    }
    if (Array.isArray(fallback) && fallback.length === 1) {
      return fallback[0]?.id ?? null
    }
    const { data: catalogo, error: catalogoError } = await supabase
      .from('acidente_agentes')
      .select('id, nome')
    if (catalogoError) {
      throw catalogoError
    }
    const encontrado = (catalogo ?? []).find(
      (item) => normalizeAgenteLookupKey(item?.nome) === alvoNormalizado,
    )
    return encontrado?.id ?? null
  } catch (lookupError) {
    console.warn('Nao foi possivel localizar agente para lesoes.', lookupError)
    return null
  }
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

async function resolveUsuarioResponsavel() {
  ensureSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) {
    return 'anônimo'
  }
  const metadata = user.user_metadata ?? {}
  return (
    metadata.nome ||
    metadata.full_name ||
    metadata.display_name ||
    user.email ||
    user.phone ||
    user.id ||
    'anônimo'
  )
}

function mapMaterialRecord(record) {
  if (!record) {
    return null
  }
  return {
    id: record.id,
    nome: record.nome ?? '',
    fabricante: record.fabricante ?? '',
    validadeDias: record.validadeDias ?? record.validade_dias ?? null,
    ca: record.ca ?? record.ca_number ?? '',
    valorUnitario: toNumber(record.valorUnitario ?? record.valor_unitario),
    estoqueMinimo: toNumber(record.estoqueMinimo ?? record.estoque_minimo),
    ativo: record.ativo ?? true,
    grupoMaterial: record.grupoMaterial ?? record.grupo_material ?? '',
    numeroCalcado: record.numeroCalcado ?? record.numero_calcado ?? '',
    numeroVestimenta: record.numeroVestimenta ?? record.numero_vestimenta ?? '',
    numeroEspecifico: record.numeroEspecifico ?? record.numero_especifico ?? '',
    chaveUnica: record.chaveUnica ?? record.chave_unica ?? '',
    descricao: record.descricao ?? '',
    usuarioCadastro: record.usuarioCadastro ?? record.usuario_cadastro ?? '',
    usuarioAtualizacao: record.usuarioAtualizacao ?? record.usuario_atualizacao ?? '',
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

function sanitizeMaterialPayload(payload = {}) {
  return {
    nome: trim(payload.nome),
    fabricante: trim(payload.fabricante),
    validadeDias: toNullableNumber(payload.validadeDias ?? payload.validade_dias),
    ca: trim(payload.ca ?? ''),
    valorUnitario: toNumber(payload.valorUnitario ?? payload.valor_unitario ?? 0),
    estoqueMinimo: toNumber(payload.estoqueMinimo ?? payload.estoque_minimo ?? 0),
    ativo: payload.ativo ?? true,
    descricao: trim(payload.descricao ?? ''),
    grupoMaterial: trim(payload.grupoMaterial ?? payload.grupo_material ?? ''),
    numeroCalcado: trim(payload.numeroCalcado ?? payload.numero_calcado ?? ''),
    numeroVestimenta: trim(payload.numeroVestimenta ?? payload.numero_vestimenta ?? ''),
    numeroEspecifico: trim(payload.numeroEspecifico ?? payload.numero_especifico ?? ''),
    chaveUnica: trim(payload.chaveUnica ?? payload.chave_unica ?? ''),
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
    supabase.from('materiais').select('*').order('nome', { ascending: true }),
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
      execute(supabase.from('materiais').select('id, nome, fabricante'), 'Falha ao listar materiais.'),
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
      supabase.from('materiais').select('id', { head: true, count: 'exact' }).limit(1),
      'Falha ao verificar status do Supabase.'
    )
    return { status: 'ok' }
  },
  pessoas: {
    async list(params = {}) {
      let query = supabase
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

      const centroServico = trim(params.centroServico ?? params.local ?? '')
      if (centroServico && centroServico.toLowerCase() !== 'todos') {
        const centroId = await resolveReferenceId(
          'centros_servico',
          centroServico,
          'Centro de serviço inválido para filtro.'
        )
        query = query.eq('centro_servico_id', centroId)
      }

      const setor = trim(params.setor ?? '')
      if (setor && setor.toLowerCase() !== 'todos') {
        const setorId = await resolveReferenceId('setores', setor, 'Setor inválido para filtro.')
        query = query.eq('setor_id', setorId)
      }

      const cargo = trim(params.cargo ?? '')
      if (cargo && cargo.toLowerCase() !== 'todos') {
        const cargoId = await resolveReferenceId('cargos', cargo, 'Cargo inválido para filtro.')
        query = query.eq('cargo_id', cargoId)
      }

      const tipoExecucaoFiltro = trim(params.tipoExecucao ?? '')
      if (tipoExecucaoFiltro && tipoExecucaoFiltro.toLowerCase() !== 'todos') {
        const tipoId = await resolveReferenceId(
          'tipo_execucao',
          tipoExecucaoFiltro.toUpperCase(),
          'Tipo de execução inválido para filtro.'
        )
        query = query.eq('tipo_execucao_id', tipoId)
      }

      const termo = trim(params.termo)
      if (termo) {
        const like = `%${termo}%`
        query = query.or(
          [
            `nome.ilike.${like}`,
            `matricula.ilike.${like}`,
            `centros_servico.nome.ilike.${like}`,
            `setores.nome.ilike.${like}`,
            `cargos.nome.ilike.${like}`,
            `tipo_execucao.nome.ilike.${like}`,
            `"usuarioCadastro".ilike.${like}`,
            `"usuarioEdicao".ilike.${like}`,
          ].join(',')
        )
      }

      const data = await execute(query, 'Falha ao listar pessoas.')
      return (data ?? []).map(mapPessoaRecord)
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
    async create(payload) {
      const dados = sanitizeMaterialPayload(payload)
      if (!dados.nome || !dados.fabricante || !dados.validadeDias || dados.validadeDias <= 0) {
        throw new Error('Preencha nome, fabricante e validade (em dias).')
      }
      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()

      const registro = await executeSingle(
        supabase
          .from('materiais')
          .insert({
            ...dados,
            usuarioCadastro: usuario,
            dataCadastro: agora,
            usuarioAtualizacao: usuario,
            atualizadoEm: agora,
          })
          .select(),
        'Falha ao criar material.'
      )
      return mapMaterialRecord(registro)
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('Material inválido.')
      }
      const atualLista = await execute(
        supabase
          .from('materiais')
          .select('*')
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
      const registro = await executeSingle(
        supabase
          .from('materiais')
          .update({
            ...dados,
            usuarioAtualizacao: usuario,
            atualizadoEm: agora,
          })
          .eq('id', id)
          .select(),
        'Falha ao atualizar material.'
      )
      return mapMaterialRecord(registro)
    },
    async get(id) {
      const registro = await executeSingle(
        supabase.from('materiais').select('*').eq('id', id),
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
          .select('nome, ativo, ordem')
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('nome', { ascending: true }),
        'Falha ao listar grupos de materiais.'
      )
      return (data ?? [])
        .filter((item) => item && item.nome && item.ativo !== false)
        .map((item) => item.nome.trim())
        .filter(Boolean)
    },
    async items(grupoNome) {
      const nome = trim(grupoNome)
      if (!nome) {
        return []
      }
      const grupos = await execute(
        supabase
          .from('grupos_material')
          .select('id')
          .eq('nome', nome)
          .limit(1),
        'Falha ao localizar grupo de material.'
      )
      const grupoId = grupos?.[0]?.id
      if (!grupoId) {
        return []
      }
      const data = await execute(
        supabase
          .from('grupos_material_itens')
          .select('nome, ativo, ordem')
          .eq('grupo_id', grupoId)
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('nome', { ascending: true }),
        'Falha ao listar EPIs do grupo.'
      )
      const itens = new Set()
      ;(data ?? []).forEach((item) => {
        if (item && item.nome && item.ativo !== false) {
          const nomeItem = String(item.nome).trim()
          if (nomeItem) {
            itens.add(nomeItem)
          }
        }
      })
      return Array.from(itens)
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








