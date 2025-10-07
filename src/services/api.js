import { supabase } from './supabaseClient.js'
import {
  parsePeriodo,
  resolvePeriodoRange,
  montarEstoqueAtual,
  montarDashboard,
  calcularSaldoMaterial,
} from '../lib/estoque.js'

const GENERIC_SUPABASE_ERROR = 'Falha ao comunicar com o Supabase.'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

function mapSupabaseError(error, fallbackMessage = GENERIC_SUPABASE_ERROR) {
  if (!error) {
    return new Error(fallbackMessage)
  }

  const message = error.message || fallbackMessage
  const mapped = new Error(message)
  mapped.code = error.code
  mapped.status = error.status || 500
  return mapped
}

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

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(36).slice(2)}`
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
  if (!payload.nome) {
    throw new Error('Nome obrigatório.')
  }
  if (!payload.matricula) {
    throw new Error('Matrícula obrigatória.')
  }
  if (!payload.local) {
    throw new Error('Local obrigatório.')
  }
  if (!payload.cargo) {
    throw new Error('Cargo obrigatório.')
  }
}

async function ensureMatriculaDisponivel(matricula, ignoreId) {
  if (!matricula) {
    return
  }
  let query = supabase.from('pessoas').select('id').eq('matricula', matricula).limit(1)
  if (ignoreId) {
    query = query.neq('id', ignoreId)
  }
  const existente = await executeMaybeSingle(query, 'Falha ao validar matrícula.')
  if (existente) {
    const error = new Error('Já existe uma pessoa com essa matrícula.')
    error.status = 409
    throw error
  }
}

function sanitizeMaterialPayload(payload = {}) {
  return {
    nome: trim(payload.nome),
    fabricante: trim(payload.fabricante),
    validadeDias: payload.validadeDias !== undefined ? Number(payload.validadeDias) : null,
    ca: trim(payload.ca),
    valorUnitario: Number(payload.valorUnitario ?? 0),
    estoqueMinimo: payload.estoqueMinimo !== undefined && payload.estoqueMinimo !== null
      ? Number(payload.estoqueMinimo)
      : null,
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
  }
}

function validateMaterialPayload(payload) {
  if (!payload.nome) {
    throw new Error('Nome do EPI obrigatório.')
  }
  if (!payload.fabricante) {
    throw new Error('Fabricante obrigatório.')
  }
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw new Error('Validade deve ser maior que zero.')
  }
  if (!payload.ca) {
    throw new Error('CA obrigatório.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw new Error('Valor unitário deve ser maior que zero.')
  }
  if (payload.estoqueMinimo !== null && (Number.isNaN(Number(payload.estoqueMinimo)) || Number(payload.estoqueMinimo) < 0)) {
    throw new Error('Estoque mínimo deve ser zero ou positivo.')
  }
}

async function ensureMaterialUnico(nome, fabricante, ignoreId) {
  if (!nome || !fabricante) {
    return
  }

  let query = supabase.from('materiais')
    .select('id')
    .eq('nome', nome)
    .eq('fabricante', fabricante)
    .limit(1)

  if (ignoreId) {
    query = query.neq('id', ignoreId)
  }

  const existente = await executeMaybeSingle(query, 'Falha ao validar material.')
  if (existente) {
    const error = new Error('Material já cadastrado para esse fabricante.')
    error.status = 409
    throw error
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
  if (!payload.materialId) {
    throw new Error('Material obrigatório para entrada.')
  }
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (payload.dataEntrada && Number.isNaN(Date.parse(payload.dataEntrada))) {
    throw new Error('Data de entrada inválida.')
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
  if (!payload.pessoaId) {
    throw new Error('Pessoa obrigatória para saída.')
  }
  if (!payload.materialId) {
    throw new Error('Material obrigatório para saída.')
  }
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (payload.dataEntrega && Number.isNaN(Date.parse(payload.dataEntrega))) {
    throw new Error('Data de entrega inválida.')
  }
}

const sanitizeOptional = (value) => {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
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
    diasPerdidos: payload.diasPerdidos !== undefined && payload.diasPerdidos !== null
      ? Number(payload.diasPerdidos)
      : 0,
    diasDebitados: payload.diasDebitados !== undefined && payload.diasDebitados !== null
      ? Number(payload.diasDebitados)
      : 0,
    cid: sanitizeOptional(payload.cid),
    cat: sanitizeOptional(payload.cat),
    observacao: sanitizeOptional(payload.observacao),
  }
}

function validateAcidentePayload(payload) {
  if (!payload.matricula) throw new Error('Matrícula obrigatória.')
  if (!payload.nome) throw new Error('Nome obrigatório.')
  if (!payload.cargo) throw new Error('Cargo obrigatório.')
  if (!payload.tipo) throw new Error('Tipo de acidente obrigatório.')
  if (!payload.agente) throw new Error('Agente causador obrigatório.')
  if (!payload.lesao) throw new Error('Lesão obrigatória.')
  if (!payload.parteLesionada) throw new Error('Parte lesionada obrigatória.')
  if (!payload.setor) throw new Error('Setor obrigatório.')
  if (!payload.local) throw new Error('Local obrigatório.')
  if (!payload.data || Number.isNaN(Date.parse(payload.data))) throw new Error('Data do acidente obrigatória.')

  if (Number.isNaN(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw new Error('Dias perdidos deve ser zero ou positivo.')
  }
  if (Number.isNaN(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw new Error('Dias debitados deve ser zero ou positivo.')
  }
}

async function obterPessoaPorId(id) {
  return executeMaybeSingle(
    supabase.from('pessoas').select('*').eq('id', id),
    'Falha ao obter pessoa.'
  )
}

async function obterPessoaPorMatricula(matricula) {
  if (!matricula) {
    return null
  }
  return executeMaybeSingle(
    supabase.from('pessoas').select('*').eq('matricula', matricula).limit(1),
    'Falha ao consultar pessoa por matrícula.'
  )
}

async function obterMaterialPorId(id) {
  if (!id) {
    return null
  }
  return executeMaybeSingle(
    supabase.from('materiais').select('*').eq('id', id),
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
    supabase.from('material_price_history').insert({
      id: randomId(),
      materialId,
      valorUnitario,
      usuarioResponsavel: usuario || 'sistema',
      criadoEm: nowIso(),
    }),
    'Falha ao registrar histórico de preço.'
  )
}

async function carregarMovimentacoes(periodo) {
  const range = resolvePeriodoRange(periodo)

  const entradasQuery = supabase.from('entradas').select('*').order('dataEntrada', { ascending: false })
  const saidasQuery = supabase.from('saidas').select('*').order('dataEntrega', { ascending: false })

  let entradasFiltered = entradasQuery
  let saidasFiltered = saidasQuery

  if (range?.start) {
    const inicioIso = range.start.toISOString()
    entradasFiltered = entradasFiltered.gte('dataEntrada', inicioIso)
    saidasFiltered = saidasFiltered.gte('dataEntrega', inicioIso)
  }
  if (range?.end) {
    const fimIso = range.end.toISOString()
    entradasFiltered = entradasFiltered.lte('dataEntrada', fimIso)
    saidasFiltered = saidasFiltered.lte('dataEntrega', fimIso)
  }

  const [materiais, entradas, saidas] = await Promise.all([
    execute(supabase.from('materiais').select('*').order('nome'), 'Falha ao listar materiais.'),
    execute(entradasFiltered, 'Falha ao listar entradas.'),
    execute(saidasFiltered, 'Falha ao listar saídas.'),
  ])

  return { materiais, entradas, saidas }
}

async function calcularSaldoMaterialAtual(materialId) {
  const [entradas, saidas] = await Promise.all([
    execute(
      supabase.from('entradas').select('materialId, quantidade, dataEntrada').eq('materialId', materialId),
      'Falha ao consultar entradas do material.'
    ),
    execute(
      supabase.from('saidas').select('materialId, quantidade, dataEntrega').eq('materialId', materialId),
      'Falha ao consultar saídas do material.'
    ),
  ])

  return calcularSaldoMaterial(materialId, entradas, saidas, null)
}

export const api = {
  health: async () => {
    ensureSupabaseClient()
    const { error } = await supabase
      .from('materiais')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    if (error) {
      throw mapSupabaseError(error, GENERIC_SUPABASE_ERROR)
    }
    return { status: 'ok' }
  },
  pessoas: {
    list: async () => {
      ensureSupabaseClient()
      return execute(
        supabase.from('pessoas').select('*').order('nome'),
        'Falha ao listar pessoas.'
      ) ?? []
    },
    create: async (payload) => {
      ensureSupabaseClient()
      const dados = sanitizePessoaPayload(payload)
      validatePessoaPayload(dados)
      await ensureMatriculaDisponivel(dados.matricula)

      const agora = nowIso()
      const pessoa = await executeSingle(
        supabase.from('pessoas').insert({
          id: randomId(),
          ...dados,
          usuarioCadastro: payload?.usuarioCadastro || 'sistema',
          criadoEm: agora,
          atualizadoEm: null,
          usuarioEdicao: null,
          historicoEdicao: [],
        }).select().single(),
        'Falha ao criar pessoa.'
      )
      return pessoa
    },
    update: async (id, payload) => {
      ensureSupabaseClient()
      const atual = await executeMaybeSingle(
        supabase.from('pessoas').select('*').eq('id', id),
        'Falha ao obter pessoa.'
      )
      if (!atual) {
        const error = new Error('Pessoa não encontrada.')
        error.status = 404
        throw error
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
      const usuario = payload?.usuarioResponsavel || payload?.usuarioCadastro || 'sistema'
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
        supabase.from('pessoas')
          .update({
            ...dados,
            atualizadoEm: agora,
            usuarioEdicao: usuario,
            historicoEdicao: historicoAtual,
          })
          .eq('id', id)
          .select()
          .single(),
        'Falha ao atualizar pessoa.'
      )

      return pessoaAtualizada
    },
    get: async (id) => {
      ensureSupabaseClient()
      return executeMaybeSingle(
        supabase.from('pessoas').select('*').eq('id', id),
        'Falha ao obter pessoa.'
      )
    },
    history: async (id) => {
      ensureSupabaseClient()
      const pessoa = await executeMaybeSingle(
        supabase.from('pessoas').select('historicoEdicao').eq('id', id),
        'Falha ao obter histórico.'
      )
      return pessoa?.historicoEdicao ?? []
    },
  },
  materiais: {
    list: async () => {
      ensureSupabaseClient()
      return execute(
        supabase.from('materiais').select('*').order('nome'),
        'Falha ao listar materiais.'
      ) ?? []
    },
    create: async (payload) => {
      ensureSupabaseClient()
      const dados = sanitizeMaterialPayload(payload)
      validateMaterialPayload(dados)
      await ensureMaterialUnico(dados.nome, dados.fabricante)

      const agora = nowIso()
      const usuario = payload?.usuarioCadastro || 'sistema'

      const material = await executeSingle(
        supabase.from('materiais').insert({
          id: randomId(),
          ...dados,
          usuarioCadastro: usuario,
          dataCadastro: agora,
        }).select().single(),
        'Falha ao criar material.'
      )

      await registrarHistoricoPreco(material.id, dados.valorUnitario, usuario)
      return material
    },
    update: async (id, payload) => {
      ensureSupabaseClient()
      const atual = await executeMaybeSingle(
        supabase.from('materiais').select('*').eq('id', id),
        'Falha ao obter material.'
      )
      if (!atual) {
        const error = new Error('Material não encontrado.')
        error.status = 404
        throw error
      }

      const dados = sanitizeMaterialPayload({
        ...atual,
        ...payload,
      })
      validateMaterialPayload(dados)
      await ensureMaterialUnico(dados.nome, dados.fabricante, id)

      const usuario = payload?.usuarioResponsavel || payload?.usuarioCadastro || 'sistema'

      const materialAtualizado = await executeSingle(
        supabase.from('materiais')
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
          .select()
          .single(),
        'Falha ao atualizar material.'
      )

      if (Number(dados.valorUnitario) !== Number(atual.valorUnitario)) {
        await registrarHistoricoPreco(id, dados.valorUnitario, usuario)
      }

      return materialAtualizado
    },
    get: async (id) => {
      ensureSupabaseClient()
      return executeMaybeSingle(
        supabase.from('materiais').select('*').eq('id', id),
        'Falha ao obter material.'
      )
    },
    priceHistory: async (id) => {
      ensureSupabaseClient()
      return execute(
        supabase.from('material_price_history')
          .select('*')
          .eq('materialId', id)
          .order('criadoEm', { ascending: false }),
        'Falha ao listar histórico de preços.'
      ) ?? []
    },
  },
  entradas: {
    list: async () => {
      ensureSupabaseClient()
      return execute(
        supabase.from('entradas').select('*').order('dataEntrada', { ascending: false }),
        'Falha ao listar entradas.'
      ) ?? []
    },
    create: async (payload) => {
      ensureSupabaseClient()
      const dados = sanitizeEntradaPayload(payload)
      validateEntradaPayload(dados)

      const material = await obterMaterialPorId(dados.materialId)
      if (!material) {
        const error = new Error('Material não encontrado.')
        error.status = 404
        throw error
      }

      const entrada = await executeSingle(
        supabase.from('entradas').insert({
          id: randomId(),
          ...dados,
        }).select().single(),
        'Falha ao registrar entrada.'
      )

      return entrada
    },
  },
  saidas: {
    list: async () => {
      ensureSupabaseClient()
      return execute(
        supabase.from('saidas').select('*').order('dataEntrega', { ascending: false }),
        'Falha ao listar saídas.'
      ) ?? []
    },
    create: async (payload) => {
      ensureSupabaseClient()
      const dados = sanitizeSaidaPayload(payload)
      validateSaidaPayload(dados)

      const [pessoa, material] = await Promise.all([
        obterPessoaPorId(dados.pessoaId),
        obterMaterialPorId(dados.materialId),
      ])

      if (!pessoa) {
        const error = new Error('Pessoa não encontrada.')
        error.status = 404
        throw error
      }
      if (!material) {
        const error = new Error('Material não encontrado.')
        error.status = 404
        throw error
      }

      const estoqueDisponivel = await calcularSaldoMaterialAtual(material.id)
      if (Number(dados.quantidade) > estoqueDisponivel) {
        const error = new Error('Quantidade informada maior que estoque disponível.')
        error.status = 400
        throw error
      }

      const dataTroca = calcularDataTroca(dados.dataEntrega, material.validadeDias)

      const saida = await executeSingle(
        supabase.from('saidas').insert({
          id: randomId(),
          ...dados,
          dataTroca,
        }).select().single(),
        'Falha ao registrar saída.'
      )

      return {
        ...saida,
        estoqueAtual: estoqueDisponivel - Number(dados.quantidade),
      }
    },
  },
  estoque: {
    current: async (params = {}) => {
      ensureSupabaseClient()
      const periodo = parsePeriodo(params)
      const { materiais, entradas, saidas } = await carregarMovimentacoes(periodo)
      return montarEstoqueAtual(materiais, entradas, saidas, periodo)
    },
    dashboard: async (params = {}) => {
      ensureSupabaseClient()
      const periodo = parsePeriodo(params)
      const [{ materiais, entradas, saidas }, pessoas] = await Promise.all([
        carregarMovimentacoes(periodo),
        execute(supabase.from('pessoas').select('*'), 'Falha ao listar pessoas.'),
      ])
      return montarDashboard({ materiais, entradas, saidas, pessoas }, periodo)
    },
  },
  acidentes: {
    list: async () => {
      ensureSupabaseClient()
      return execute(
        supabase.from('acidentes').select('*').order('data', { ascending: false }),
        'Falha ao listar acidentes.'
      ) ?? []
    },
    create: async (payload) => {
      ensureSupabaseClient()

      const dados = sanitizeAcidentePayload(payload)
      validateAcidentePayload(dados)

      const pessoa = await obterPessoaPorMatricula(dados.matricula)
      if (!pessoa) {
        const error = new Error('Pessoa não encontrada para a matrícula informada.')
        error.status = 404
        throw error
      }

      const acidente = await executeSingle(
        supabase.from('acidentes').insert({
          id: randomId(),
          ...dados,
          setor: dados.setor || pessoa.setor || pessoa.local || '',
          local: dados.local || pessoa.local || pessoa.setor || '',
          criadoEm: nowIso(),
          atualizadoEm: null,
        }).select().single(),
        'Falha ao registrar acidente.'
      )

      return acidente
    },
    update: async (id, payload) => {
      ensureSupabaseClient()

      const atual = await executeMaybeSingle(
        supabase.from('acidentes').select('*').eq('id', id),
        'Falha ao obter acidente.'
      )
      if (!atual) {
        const error = new Error('Acidente não encontrado.')
        error.status = 404
        throw error
      }

      let pessoa = null
      if (payload.matricula !== undefined && trim(payload.matricula)) {
        pessoa = await obterPessoaPorMatricula(trim(payload.matricula))
        if (!pessoa) {
          const error = new Error('Pessoa não encontrada para a matrícula informada.')
          error.status = 404
          throw error
        }
      }

      const dados = sanitizeAcidentePayload({ ...atual, ...payload })
      validateAcidentePayload(dados)

      const acidenteAtualizado = await executeSingle(
        supabase.from('acidentes')
          .update({
            ...dados,
            setor: dados.setor || pessoa?.setor || pessoa?.local || atual.setor,
            local: dados.local || pessoa?.local || pessoa?.setor || atual.local,
            atualizadoEm: nowIso(),
          })
          .eq('id', id)
          .select()
          .single(),
        'Falha ao atualizar acidente.'
      )

      return acidenteAtualizado
    },
  },
}
