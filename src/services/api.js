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
  const centroServico =
    record.centroServico ?? record.centro_servico ?? record.local ?? ''
  return {
    id: record.id,
    nome: record.nome ?? '',
    matricula: record.matricula ?? '',
    centroServico,
    cargo: record.cargo ?? '',
    tipoExecucao: record.tipoExecucao ?? record.tipo_execucao ?? '',
    dataAdmissao: record.dataAdmissao ?? record.data_admissao ?? null,
    usuarioCadastro: record.usuarioCadastro ?? record.usuario_cadastro ?? '',
    usuarioEdicao: record.usuarioEdicao ?? record.usuario_edicao ?? '',
    criadoEm: record.criadoEm ?? record.criado_em ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizado_em ?? null,
    historicoEdicao: Array.isArray(record.historicoEdicao ?? record.historico_edicao)
      ? record.historicoEdicao ?? record.historico_edicao
      : [],
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
    centroCusto: record.centroCusto ?? record.centro_custo ?? '',
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
    centroCusto: record.centroCusto ?? record.centro_custo ?? '',
    centroServico: record.centroServico ?? record.centro_servico ?? '',
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
  const centroServico =
    record.centroServico ?? record.centro_servico ?? record.setor ?? ''
  return {
    id: record.id,
    matricula: record.matricula ?? '',
    nome: record.nome ?? '',
    cargo: record.cargo ?? '',
    data: record.data ?? null,
    diasPerdidos: toNumber(record.diasPerdidos ?? record.dias_perdidos),
    diasDebitados: toNumber(record.diasDebitados ?? record.dias_debitados),
    tipo: record.tipo ?? '',
    agente: record.agente ?? '',
    cid: record.cid ?? '',
    lesao: record.lesao ?? '',
    parteLesionada: record.parteLesionada ?? record.parte_lesionada ?? '',
    centroServico,
    setor: record.setor ?? centroServico,
    local: record.local ?? centroServico,
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
    cargo: trim(payload.cargo),
    tipoExecucao: trim(payload.tipoExecucao ?? ''),
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
    supabase.from('pessoas').select('*').order('nome', { ascending: true }),
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
      let query = supabase.from('pessoas').select('*').order('nome', { ascending: true })

      const centroServico = trim(params.centroServico ?? params.local ?? '')
      if (centroServico) {
        query = query.eq('centro_servico', centroServico)
      }

      const cargo = trim(params.cargo ?? '')
      if (cargo) {
        query = query.eq('cargo', cargo)
      }

      const termo = trim(params.termo)
      if (termo) {
        const like = `%${termo}%`
        query = query.or(
          [
            `nome.ilike.${like}`,
            `matricula.ilike.${like}`,
            `centro_servico.ilike.${like}`,
            `cargo.ilike.${like}`,
            `tipoExecucao.ilike.${like}`,
            `usuarioCadastro.ilike.${like}`,
            `usuarioEdicao.ilike.${like}`,
          ].join(',')
        )
      }

      const data = await execute(query, 'Falha ao listar pessoas.')
      return (data ?? []).map(mapPessoaRecord)
    },
    async create(payload) {
      const dados = sanitizePessoaPayload(payload)
      if (!dados.nome || !dados.matricula || !dados.centroServico || !dados.cargo) {
        throw new Error('Preencha nome, matrícula, centro de serviço e cargo.')
      }

      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()

      const registro = await executeSingle(
        supabase
          .from('pessoas')
          .insert({
            nome: dados.nome,
            matricula: dados.matricula,
            centro_servico: dados.centroServico,
            cargo: dados.cargo,
            tipoExecucao: dados.tipoExecucao || null,
            dataAdmissao: dados.dataAdmissao,
            usuarioCadastro: usuario,
            historicoEdicao: [],
            criadoEm: agora,
            atualizadoEm: null,
          })
          .select(),
        'Falha ao criar pessoa.'
      )

      return mapPessoaRecord(registro)
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigatório.')
      }

      const atual = await executeSingle(
        supabase.from('pessoas').select('*').eq('id', id),
        'Falha ao obter pessoa.'
      )
      if (!atual) {
        throw new Error('Pessoa não encontrada.')
      }

      const dados = sanitizePessoaPayload(payload)
      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()

      const historico = Array.isArray(atual.historicoEdicao) ? [...atual.historicoEdicao] : []
      const camposAlterados = []
      ;['nome', 'matricula', 'centroServico', 'cargo', 'tipoExecucao', 'dataAdmissao'].forEach((campo) => {
        const chaveAtual =
          campo === 'centroServico'
            ? 'centro_servico'
            : campo === 'dataAdmissao'
              ? 'dataAdmissao'
              : campo
        const valorAtual = atual[chaveAtual] ?? (campo === 'centroServico' ? atual.centroServico ?? atual.centro_servico ?? '' : '')
        const valorNovo = dados[campo] ?? (campo === 'dataAdmissao' ? null : '')
        if (valorAtual !== valorNovo) {
          camposAlterados.push({
            campo,
            de: valorAtual,
            para: valorNovo,
          })
        }
      })

      if (camposAlterados.length > 0) {
        historico.push({
          id: randomId(),
          dataEdicao: agora,
          usuarioResponsavel: usuario,
          camposAlterados,
        })
      }

      const registro = await executeSingle(
        supabase
          .from('pessoas')
          .update({
            nome: dados.nome,
            matricula: dados.matricula,
            centro_servico: dados.centroServico,
            cargo: dados.cargo,
            tipoExecucao: dados.tipoExecucao || null,
            dataAdmissao: dados.dataAdmissao,
            atualizadoEm: agora,
            usuarioEdicao: usuario,
            historicoEdicao: historico,
          })
          .eq('id', id)
          .select(),
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
      const pessoa = await executeSingle(
        supabase.from('pessoas').select('historicoEdicao').eq('id', id),
        'Falha ao obter histórico.'
      )
      return Array.isArray(pessoa?.historicoEdicao) ? pessoa.historicoEdicao : []
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
        throw new Error('ID obrigatório.')
      }
      const dados = sanitizeMaterialPayload(payload)
      const usuario = await resolveUsuarioResponsavel()
      const agora = new Date().toISOString()
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
      }))
    },
    async groups() {
      const data = await execute(
        supabase
          .from('materiais')
          .select('grupoMaterial')
          .not('grupoMaterial', 'is', null)
          .neq('grupoMaterial', '')
          .order('grupoMaterial', { ascending: true }),
        'Falha ao listar grupos de materiais.'
      )
      const grupos = new Set((data ?? []).map((item) => item.grupoMaterial).filter(Boolean))
      return Array.from(grupos)
    },
  },
  entradas: {
    list: carregarEntradas,
    async create(payload) {
      const usuario = await resolveUsuarioResponsavel()
      const dados = {
        materialId: trim(payload.materialId),
        quantidade: toNumber(payload.quantidade, null),
        centroCusto: trim(payload.centroCusto),
        dataEntrada: payload.dataEntrada ? new Date(payload.dataEntrada).toISOString() : new Date().toISOString(),
        usuarioResponsavel: usuario,
      }
      if (!dados.materialId || !dados.quantidade || dados.quantidade <= 0 || !dados.centroCusto) {
        throw new Error('Preencha material, quantidade (>0) e centro de custo.')
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
      const dados = {
        pessoaId: trim(payload.pessoaId),
        materialId: trim(payload.materialId),
        quantidade: toNumber(payload.quantidade, null),
        centroCusto: trim(payload.centroCusto),
        centroServico: trim(payload.centroServico ?? payload.centro_servico ?? ''),
        dataEntrega: payload.dataEntrega ? new Date(payload.dataEntrega).toISOString() : new Date().toISOString(),
        status: trim(payload.status) || 'entregue',
      }
      if (!dados.pessoaId || !dados.materialId || !dados.quantidade || dados.quantidade <= 0) {
        throw new Error('Preencha pessoa, material e quantidade (>0).')
      }

      const pessoa = await executeSingle(
        supabase.from('pessoas').select('centro_servico').eq('id', dados.pessoaId),
        'Falha ao obter pessoa.'
      )

      if (!dados.centroServico) {
        dados.centroServico = pessoa?.centro_servico ?? ''
      }

      const material = await executeSingle(
        supabase.from('materiais').select('id, validadeDias').eq('id', dados.materialId),
        'Falha ao obter material.'
      )

      const estoqueDisponivel = await calcularSaldoMaterialAtual(dados.materialId)
      if (dados.quantidade > estoqueDisponivel) {
        const error = new Error('Quantidade informada maior que o estoque disponível.')
        error.status = 400
        throw error
      }

      const dataTroca = calcularDataTroca(dados.dataEntrega, material?.validadeDias)

      const registro = await executeSingle(
        supabase
          .from('saidas')
          .insert({
            pessoaId: dados.pessoaId,
            materialId: dados.materialId,
            quantidade: dados.quantidade,
            centro_custo: dados.centroCusto,
            centro_servico: dados.centroServico,
            dataEntrega: dados.dataEntrega,
            dataTroca,
            status: dados.status,
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
    async create(payload) {
      const dados = {
        matricula: trim(payload.matricula),
        nome: trim(payload.nome),
        cargo: trim(payload.cargo),
        tipo: trim(payload.tipo),
        agente: trim(payload.agente),
        lesao: trim(payload.lesao),
        parteLesionada: trim(payload.parteLesionada),
        centroServico: trim(payload.centroServico ?? payload.centro_servico ?? payload.setor ?? ''),
        local: trim(payload.local) || trim(payload.centroServico ?? payload.centro_servico ?? payload.setor ?? ''),
        data: payload.data ? new Date(payload.data).toISOString() : null,
        diasPerdidos: toNumber(payload.diasPerdidos),
        diasDebitados: toNumber(payload.diasDebitados),
        hht: toNullableNumber(payload.hht),
        cid: trim(payload.cid),
        cat: trim(payload.cat),
        observacao: trim(payload.observacao),
      }
      if (!dados.matricula || !dados.nome || !dados.cargo || !dados.tipo || !dados.agente || !dados.lesao || !dados.parteLesionada || !dados.centroServico || !dados.data) {
        throw new Error('Preencha os campos obrigatórios do acidente.')
      }
      const usuario = await resolveUsuarioResponsavel()
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .insert({
            ...dados,
            centro_servico: dados.centroServico,
            registradoPor: usuario,
          })
          .select(),
        'Falha ao registrar acidente.'
      )
      return mapAcidenteRecord(registro)
    },
    async update(id, payload) {
      if (!id) {
        throw new Error('ID obrigatório.')
      }
      const atual = await executeSingle(
        supabase.from('acidentes').select('*').eq('id', id),
        'Falha ao obter acidente.'
      )
      if (!atual) {
        throw new Error('Acidente não encontrado.')
      }

      const dados = {
        matricula: trim(payload.matricula ?? atual.matricula),
        nome: trim(payload.nome ?? atual.nome),
        cargo: trim(payload.cargo ?? atual.cargo),
        tipo: trim(payload.tipo ?? atual.tipo),
        agente: trim(payload.agente ?? atual.agente),
        lesao: trim(payload.lesao ?? atual.lesao),
        parteLesionada: trim(payload.parteLesionada ?? atual.parteLesionada ?? atual.parte_lesionada ?? ''),
        centroServico: trim(payload.centroServico ?? payload.centro_servico ?? atual.centro_servico ?? atual.setor ?? ''),
        local: trim(payload.local ?? atual.local ?? ''),
        data: payload.data ? new Date(payload.data).toISOString() : atual.data,
        diasPerdidos: toNumber(payload.diasPerdidos ?? atual.diasPerdidos ?? atual.dias_perdidos ?? 0),
        diasDebitados: toNumber(payload.diasDebitados ?? atual.diasDebitados ?? atual.dias_debitados ?? 0),
        hht: toNullableNumber(payload.hht ?? atual.hht),
        cid: trim(payload.cid ?? atual.cid ?? ''),
        cat: trim(payload.cat ?? atual.cat ?? ''),
        observacao: trim(payload.observacao ?? atual.observacao ?? ''),
      }

      const usuario = await resolveUsuarioResponsavel()
      const registro = await executeSingle(
        supabase
          .from('acidentes')
          .update({
            ...dados,
            centro_servico: dados.centroServico,
            atualizadoPor: usuario,
            atualizadoEm: new Date().toISOString(),
          })
          .eq('id', id)
          .select(),
        'Falha ao atualizar acidente.'
      )
      return mapAcidenteRecord(registro)
    },
    async dashboard(params = {}) {
      const acidentes = await carregarAcidentes()
      return montarDashboardAcidentes(acidentes, params)
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



