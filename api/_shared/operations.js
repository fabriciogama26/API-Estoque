import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabaseClient.js'
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
  return {
    ...record,
    centroCusto: record.centroCusto ?? '',
    centroServico: record.centroServico ?? '',
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
  const centroServico = record.centroServico ?? record.setor ?? ''
  return {
    ...record,
    centroServico,
    setor: record.setor ?? centroServico,
    local: record.local ?? centroServico,
  }
}

function normalizePessoaHistorico(lista) {
  if (!Array.isArray(lista)) {
    return []
  }
  return lista.map((registro) => ({
    ...registro,
    camposAlterados: Array.isArray(registro.camposAlterados)
      ? registro.camposAlterados.map((campo) =>
          campo?.campo === 'local' ? { ...campo, campo: 'centroServico' } : campo
        )
      : [],
  }))
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

function sanitizeMaterialPayload(payload = {}) {
  return {
    nome: trim(payload.nome),
    fabricante: trim(payload.fabricante),
    validadeDias: payload.validadeDias !== undefined ? Number(payload.validadeDias) : null,
    ca: trim(payload.ca),
    valorUnitario: Number(payload.valorUnitario ?? 0),
    estoqueMinimo:
      payload.estoqueMinimo !== undefined && payload.estoqueMinimo !== null
        ? Number(payload.estoqueMinimo)
        : null,
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
  }
}

function validateMaterialPayload(payload) {
  if (!payload.nome) throw createHttpError(400, 'Nome do EPI obrigatório.')
  if (!payload.fabricante) throw createHttpError(400, 'Fabricante obrigatório.')
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw createHttpError(400, 'Validade deve ser maior que zero.')
  }
  if (!payload.ca) {
    throw createHttpError(400, 'CA obrigatório.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw createHttpError(400, 'Valor unitário deve ser maior que zero.')
  }
  if (
    payload.estoqueMinimo !== null &&
    (Number.isNaN(Number(payload.estoqueMinimo)) || Number(payload.estoqueMinimo) < 0)
  ) {
    throw createHttpError(400, 'Estoque mínimo deve ser zero ou positivo.')
  }
}

async function ensureMaterialUnico(nome, fabricante, ignoreId) {
  if (!nome || !fabricante) {
    return
  }

  let query = supabaseAdmin
    .from('materiais')
    .select('id')
    .eq('nome', nome)
    .eq('fabricante', fabricante)
    .limit(1)

  if (ignoreId) {
    query = query.neq('id', ignoreId)
  }

  const existente = await executeMaybeSingle(query, 'Falha ao validar material.')
  if (existente) {
    throw createHttpError(409, 'Material já cadastrado para esse fabricante.')
  }
}

function sanitizeEntradaPayload(payload = {}) {
  return {
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrada: payload.dataEntrada ? new Date(payload.dataEntrada).toISOString() : nowIso(),
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
  }
}

function validateEntradaPayload(payload) {
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatório para entrada.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createHttpError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatório.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de serviço obrigatório.')
  if (payload.dataEntrada && Number.isNaN(Date.parse(payload.dataEntrada))) {
    throw createHttpError(400, 'Data de entrada inválida.')
  }
}

function sanitizeSaidaPayload(payload = {}) {
  return {
    pessoaId: trim(payload.pessoaId),
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrega: payload.dataEntrega ? new Date(payload.dataEntrega).toISOString() : nowIso(),
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
    status: trim(payload.status) || 'entregue',
  }
}

function validateSaidaPayload(payload) {
  if (!payload.pessoaId) throw createHttpError(400, 'Pessoa obrigatória para saída.')
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatório para saída.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createHttpError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createHttpError(400, 'Centro de custo obrigatório.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de serviço obrigatório.')
  if (payload.dataEntrega && Number.isNaN(Date.parse(payload.dataEntrega))) {
    throw createHttpError(400, 'Data de entrega inválida.')
  }
}

const sanitizeOptional = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = trim(value)
  return trimmed || null
}

function sanitizeAcidentePayload(payload = {}) {
  const centroServico = trim(payload.centroServico ?? payload.setor)
  const local = trim(payload.local)
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
    diasPerdidos:
      payload.diasPerdidos !== undefined && payload.diasPerdidos !== null
        ? Number(payload.diasPerdidos)
        : 0,
    diasDebitados:
      payload.diasDebitados !== undefined && payload.diasDebitados !== null
        ? Number(payload.diasDebitados)
        : 0,
    cid: sanitizeOptional(payload.cid),
    cat: sanitizeOptional(payload.cat),
    observacao: sanitizeOptional(payload.observacao),
  }
}

function validateAcidentePayload(payload) {
  if (!payload.matricula) throw createHttpError(400, 'Matr�cula obrigat�ria.')
  if (!payload.nome) throw createHttpError(400, 'Nome obrigat�rio.')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigat�rio.')
  if (!payload.tipo) throw createHttpError(400, 'Tipo de acidente obrigat�rio.')
  if (!payload.agente) throw createHttpError(400, 'Agente causador obrigat�rio.')
  if (!payload.lesao) throw createHttpError(400, 'Les�o obrigat�ria.')
  if (!payload.parteLesionada) throw createHttpError(400, 'Parte lesionada obrigat�ria.')
  if (!payload.centroServico) throw createHttpError(400, 'Centro de servi�o obrigat�rio.')
  if (!payload.local) throw createHttpError(400, 'Local obrigat�rio.')
  if (!payload.data || Number.isNaN(Date.parse(payload.data))) {
    throw createHttpError(400, 'Data do acidente obrigat�ria.')
  }
  if (Number.isNaN(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createHttpError(400, 'Dias perdidos deve ser zero ou positivo.')
  }
  if (Number.isNaN(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createHttpError(400, 'Dias debitados deve ser zero ou positivo.')
  }
}
  if (Number.isNaN(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createHttpError(400, 'Dias perdidos deve ser zero ou positivo.')
  }
  if (Number.isNaN(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createHttpError(400, 'Dias debitados deve ser zero ou positivo.')
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

async function obterMaterialPorId(id)(id) {
  if (!id) {
    return null
  }
  return executeMaybeSingle(
    supabaseAdmin.from('materiais').select('*').eq('id', id),
    'Falha ao obter material.'
  )
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

  const [materiais, entradas, saidas] = await Promise.all([
    execute(supabaseAdmin.from('materiais').select('*').order('nome'), 'Falha ao listar materiais.'),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saídas.'),
  ])

  return {
    materiais,
    entradas: (entradas ?? []).map(mapEntradaRecord),
    saidas: (saidas ?? []).map(mapSaidaRecord),
    periodo,
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

export const PessoasOperations = {
  async list() {
    const pessoas =
      (await execute(
        supabaseAdmin.from('pessoas').select('*').order('nome'),
        'Falha ao listar pessoas.'
      )) ?? []
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
          historicoEdicao: [],
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
      throw createHttpError(404, 'Pessoa não encontrada.')
    }

    const dados = sanitizePessoaPayload(payload)
    validatePessoaPayload(dados)
    await ensureMatriculaDisponivel(dados.matricula, id)

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

    const historicoAtual = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
    const usuario = resolveUsuarioNome(user)
    const agora = nowIso()

    if (camposAlterados.length > 0) {
      historicoAtual.push({
        id: randomId(),
        dataEdicao: agora,
        usuarioResponsavel: usuario,
        camposAlterados,
      })
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
          historicoEdicao: historicoAtual,
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
    const pessoa = await executeMaybeSingle(
      supabaseAdmin.from('pessoas').select('historicoEdicao').eq('id', id),
      'Falha ao obter hist?rico.'
    )
    return normalizePessoaHistorico(pessoa?.historicoEdicao ?? [])
  },
}

export const MateriaisOperations = {
  async list() {
    return (
      (await execute(
        supabaseAdmin.from('materiais').select('*').order('nome'),
        'Falha ao listar materiais.'
      )) ?? []
    )
  },
  async create(payload, user) {
    const dados = sanitizeMaterialPayload(payload)
    validateMaterialPayload(dados)
    await ensureMaterialUnico(dados.nome, dados.fabricante)

    const agora = nowIso()
    const usuario = resolveUsuarioNome(user)

    const material = await executeSingle(
      supabaseAdmin
        .from('materiais')
        .insert({
          id: randomId(),
          ...dados,
          usuarioCadastro: usuario,
          dataCadastro: agora,
        })
        .select(),
      'Falha ao criar material.'
    )

    await registrarHistoricoPreco(material.id, dados.valorUnitario, usuario)
    return material
  },
  async update(id, payload, user) {
    const atual = await executeMaybeSingle(
      supabaseAdmin.from('materiais').select('*').eq('id', id),
      'Falha ao obter material.'
    )
    if (!atual) {
      throw createHttpError(404, 'Material não encontrado.')
    }

    const dados = sanitizeMaterialPayload({
      ...atual,
      ...payload,
    })
    validateMaterialPayload(dados)
    await ensureMaterialUnico(dados.nome, dados.fabricante, id)

    const usuario = resolveUsuarioNome(user)

    const materialAtualizado = await executeSingle(
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
          usuarioAtualizacao: usuario,
          atualizadoEm: nowIso(),
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar material.'
    )

    if (Number(dados.valorUnitario) !== Number(atual.valorUnitario)) {
      await registrarHistoricoPreco(id, dados.valorUnitario, usuario)
    }

    return materialAtualizado
  },
  async get(id) {
    return executeMaybeSingle(
      supabaseAdmin.from('materiais').select('*').eq('id', id),
      'Falha ao obter material.'
    )
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
  async list() {
    const entradas =
      (await execute(
        supabaseAdmin.from('entradas').select('*').order('dataEntrada', { ascending: false }),
        'Falha ao listar entradas.'
      )) ?? []
    return entradas.map(mapEntradaRecord)
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
            centroCusto: dados.centroCusto,
            centroServico: dados.centroServico,
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
  async list() {
    return (
      (await execute(
        supabaseAdmin.from('saidas').select('*').order('dataEntrega', { ascending: false }),
        'Falha ao listar saídas.'
      )) ?? []
    )
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
      throw createHttpError(404, 'Pessoa n�o encontrada para a matr�cula informada.')
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
      throw createHttpError(404, 'Acidente n�o encontrado.')
    }

    let pessoa = null
    if (payload.matricula !== undefined && trim(payload.matricula)) {
      pessoa = await obterPessoaPorMatricula(trim(payload.matricula))
      if (!pessoa) {
        throw createHttpError(404, 'Pessoa n�o encontrada para a matr�cula informada.')
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
  }
  return { status: 'ok' }
}
