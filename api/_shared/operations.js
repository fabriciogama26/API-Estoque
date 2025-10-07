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
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    local: trim(payload.local),
    cargo: trim(payload.cargo),
  }
}

function validatePessoaPayload(payload) {
  if (!payload.nome) throw createHttpError(400, 'Nome obrigatório.')
  if (!payload.matricula) throw createHttpError(400, 'Matrícula obrigatória.')
  if (!payload.local) throw createHttpError(400, 'Local obrigatório.')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigatório.')
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
    dataEntrada: payload.dataEntrada ? new Date(payload.dataEntrada).toISOString() : nowIso(),
    usuarioResponsavel: trim(payload.usuarioResponsavel) || null,
  }
}

function validateEntradaPayload(payload) {
  if (!payload.materialId) throw createHttpError(400, 'Material obrigatório para entrada.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createHttpError(400, 'Quantidade deve ser maior que zero.')
  }
  if (payload.dataEntrada && Number.isNaN(Date.parse(payload.dataEntrada))) {
    throw createHttpError(400, 'Data de entrada inválida.')
  }
}

function sanitizeSaidaPayload(payload = {}) {
  return {
    pessoaId: trim(payload.pessoaId),
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
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
  return {
    matricula: trim(payload.matricula),
    nome: trim(payload.nome),
    cargo: trim(payload.cargo),
    data: payload.data ? new Date(payload.data).toISOString() : '',
    tipo: trim(payload.tipo),
    agente: trim(payload.agente),
    lesao: trim(payload.lesao),
    parteLesionada: trim(payload.parteLesionada),
    setor: trim(payload.setor),
    local: trim(payload.local),
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
  if (!payload.matricula) throw createHttpError(400, 'Matrícula obrigatória.')
  if (!payload.nome) throw createHttpError(400, 'Nome obrigatório.')
  if (!payload.cargo) throw createHttpError(400, 'Cargo obrigatório.')
  if (!payload.tipo) throw createHttpError(400, 'Tipo de acidente obrigatório.')
  if (!payload.agente) throw createHttpError(400, 'Agente causador obrigatório.')
  if (!payload.lesao) throw createHttpError(400, 'Lesão obrigatória.')
  if (!payload.parteLesionada) throw createHttpError(400, 'Parte lesionada obrigatória.')
  if (!payload.setor) throw createHttpError(400, 'Setor obrigatório.')
  if (!payload.local) throw createHttpError(400, 'Local obrigatório.')
  if (!payload.data || Number.isNaN(Date.parse(payload.data))) {
    throw createHttpError(400, 'Data do acidente obrigatória.')
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
  return executeMaybeSingle(
    supabaseAdmin.from('pessoas').select('*').eq('matricula', matricula).limit(1),
    'Falha ao consultar pessoa por matrícula.'
  )
}

async function obterMaterialPorId(id) {
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

  return { materiais, entradas, saidas, periodo }
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
    return (
      (await execute(
        supabaseAdmin.from('pessoas').select('*').order('nome'),
        'Falha ao listar pessoas.'
      )) ?? []
    )
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
          ...dados,
          usuarioCadastro: usuario,
          criadoEm: agora,
          atualizadoEm: null,
          usuarioEdicao: null,
          historicoEdicao: [],
        })
        .select(),
      'Falha ao criar pessoa.'
    )

    return pessoa
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
    ;['nome', 'matricula', 'local', 'cargo'].forEach((campo) => {
      if (atual[campo] !== dados[campo]) {
        camposAlterados.push({
          campo,
          de: atual[campo] || '',
          para: dados[campo],
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
          ...dados,
          atualizadoEm: agora,
          usuarioEdicao: usuario,
          historicoEdicao: historicoAtual,
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar pessoa.'
    )

    return pessoaAtualizada
  },
  async get(id) {
    return executeMaybeSingle(
      supabaseAdmin.from('pessoas').select('*').eq('id', id),
      'Falha ao obter pessoa.'
    )
  },
  async history(id) {
    const pessoa = await executeMaybeSingle(
      supabaseAdmin.from('pessoas').select('historicoEdicao').eq('id', id),
      'Falha ao obter histórico.'
    )
    return pessoa?.historicoEdicao ?? []
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
    return (
      (await execute(
        supabaseAdmin.from('entradas').select('*').order('dataEntrada', { ascending: false }),
        'Falha ao listar entradas.'
      )) ?? []
    )
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
          ...dados,
          usuarioResponsavel: usuario,
        })
        .select(),
      'Falha ao registrar entrada.'
    )

    return entrada
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
          ...dados,
          usuarioResponsavel: usuario,
          dataTroca,
        })
        .select(),
      'Falha ao registrar saída.'
    )

    return {
      ...saida,
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
    return (
      (await execute(
        supabaseAdmin.from('acidentes').select('*').order('data', { ascending: false }),
        'Falha ao listar acidentes.'
      )) ?? []
    )
  },
  async create(payload, user) {
    const dados = sanitizeAcidentePayload(payload)
    validateAcidentePayload(dados)

    const pessoa = await obterPessoaPorMatricula(dados.matricula)
    if (!pessoa) {
      throw createHttpError(404, 'Pessoa não encontrada para a matrícula informada.')
    }

    const acidente = await executeSingle(
      supabaseAdmin
        .from('acidentes')
        .insert({
          id: randomId(),
          ...dados,
          setor: dados.setor || pessoa.setor || pessoa.local || '',
          local: dados.local || pessoa.local || pessoa.setor || '',
          criadoEm: nowIso(),
          atualizadoEm: null,
          registradoPor: resolveUsuarioNome(user),
        })
        .select(),
      'Falha ao registrar acidente.'
    )

    return acidente
  },
  async update(id, payload, user) {
    const atual = await executeMaybeSingle(
      supabaseAdmin.from('acidentes').select('*').eq('id', id),
      'Falha ao obter acidente.'
    )
    if (!atual) {
      throw createHttpError(404, 'Acidente não encontrado.')
    }

    let pessoa = null
    if (payload.matricula !== undefined && trim(payload.matricula)) {
      pessoa = await obterPessoaPorMatricula(trim(payload.matricula))
      if (!pessoa) {
        throw createHttpError(404, 'Pessoa não encontrada para a matrícula informada.')
      }
    }

    const dados = sanitizeAcidentePayload({ ...atual, ...payload })
    validateAcidentePayload(dados)

    const acidenteAtualizado = await executeSingle(
      supabaseAdmin
        .from('acidentes')
        .update({
          ...dados,
          setor: dados.setor || pessoa?.setor || pessoa?.local || atual.setor,
          local: dados.local || pessoa?.local || pessoa?.setor || atual.local,
          atualizadoEm: nowIso(),
          atualizadoPor: resolveUsuarioNome(user),
        })
        .eq('id', id)
        .select(),
      'Falha ao atualizar acidente.'
    )

    return acidenteAtualizado
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
