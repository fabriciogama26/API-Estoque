import { readState, writeState } from './localDataStore.js'
import {
  montarEstoqueAtual,
  montarDashboard,
  parsePeriodo,
  calcularSaldoMaterial,
} from '../lib/estoque.js'
import { montarDashboardAcidentes } from '../lib/acidentesDashboard.js'
import gruposEpi from '../data/grupos-epi.json'
import { buildEpiTermHtml } from '../../shared/documents/epiTermTemplate.js'
import { filterPessoas } from '../rules/PessoasRules.js'

const nowIso = () => new Date().toISOString()

const randomId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const trim = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const sanitizeDigitsOnly = (value = '') => String(value).replace(/\D/g, '')

const toIsoOrNull = (value, defaultNow = false) => {
  if (!value) {
    return defaultNow ? nowIso() : null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return defaultNow ? nowIso() : null
  }
  return date.toISOString()
}

const toLocalDateIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const isaidateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  const candidate = isaidateOnly ? `${raw}T00:00:00` : raw
  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

const createError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const sanitizePessoaPayload = (payload = {}) => {
  const centroServico = trim(payload.centroServico ?? payload.local)
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    cargo: trim(payload.cargo),
    centroServico,
    dataAdmissao: toLocalDateIso(payload.dataAdmissao),
    tipoExecucao: trim(payload.tipoExecucao),
  }
}

const validatePessoaPayload = (payload) => {
  if (!payload.nome) throw createError(400, 'Nome obrigatorio.')
  if (!payload.matricula) throw createError(400, 'Matricula obrigatoria.')
  if (!payload.centroServico) throw createError(400, 'Centro de servico obrigatorio.')
  if (!payload.cargo) throw createError(400, 'Cargo obrigatorio.')
  if (!payload.tipoExecucao) throw createError(400, 'Tipo Execucao obrigatorio.')
}

const mapLocalPessoaRecord = (pessoa) => {
  if (!pessoa || typeof pessoa !== 'object') {
    return pessoa
  }
  const centroServico = pessoa.centroServico ?? pessoa.local ?? ''
  return {
    ...pessoa,
    centroServico,
    local: pessoa.local ?? centroServico,
  }
}

const mapLocalEntradaRecord = (entrada) => {
  if (!entrada || typeof entrada !== 'object') {
    return entrada
  }
  return {
    ...entrada,
    centroCusto: entrada.centroCusto ?? '',
    centroServico: entrada.centroServico ?? '',
  }
}

const mapLocalSaidaRecord = (saida) => {
  if (!saida || typeof saida !== 'object') {
    return saida
  }
  return {
    ...saida,
    centroCusto: saida.centroCusto ?? '',
    centroServico: saida.centroServico ?? '',
  }
}

const normalizePessoaHistory = (lista) => {
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

const normalizeAcidenteHistory = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }
  return lista.map((registro) => ({
    ...registro,
    camposAlterados: Array.isArray(registro.camposAlterados)
      ? registro.camposAlterados.slice()
      : [],
  }))
}

const ACIDENTE_HISTORY_FIELDS = [
  'matricula',
  'nome',
  'cargo',
  'data',
  'tipo',
  'agente',
  'lesao',
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

const normalizeHistoryValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return ''
  }
  return value
}

const mapLocalAcidenteRecord = (acidente) => {
  if (!acidente || typeof acidente !== 'object') {
    return acidente
  }
  const centroServico = acidente.centroServico ?? acidente.setor ?? ''
  return {
    ...acidente,
    centroServico,
    setor: acidente.setor ?? centroServico,
    local: acidente.local ?? centroServico,
  }
}

const mapLocalMaterialResumo = (material) => {
  if (!material || typeof material !== 'object') {
    return null
  }
  return {
    id: material.id,
    nome: material.nome || '',
    fabricante: material.fabricante || '',
    ca: material.ca || '',
    numeroEspecifico: material.numeroEspecifico || '',
    numeroCalcado: material.numeroCalcado || '',
    numeroVestimenta: material.numeroVestimenta || '',
    grupoMaterial: material.grupoMaterial || '',
  }
}

const resolveEmpresaInfoLocal = () => ({
  nome: import.meta.env.VITE_TERMO_EPI_EMPRESA_NOME || '',
  documento: import.meta.env.VITE_TERMO_EPI_EMPRESA_DOCUMENTO || '',
  endereco: import.meta.env.VITE_TERMO_EPI_EMPRESA_ENDERECO || '',
  contato: import.meta.env.VITE_TERMO_EPI_EMPRESA_CONTATO || '',
  logoUrl: import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_URL || '',
  logoSecundarioUrl: import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL || '',
})

const buildDescricaoMaterialLocal = (material) => {
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

const montarContextoTermoEpiLocal = (pessoa, saidasDetalhadas) => {
  const entregasOrdenadas = saidasDetalhadas
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
      descricao: buildDescricaoMaterialLocal(saida.material),
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

function obterContextoTermoEpiLocal(params = {}) {
  const matriculaParam = trim(params.matricula).toLowerCase()
  const nomeParam = trim(params.nome).toLowerCase()

  if (!matriculaParam && !nomeParam) {
    throw createError(400, 'Informe a matricula ou o nome do colaborador.')
  }

  return readState((state) => {
    let pessoa = null
    if (matriculaParam) {
      pessoa =
        state.pessoas.find(
          (item) => item.matricula && String(item.matricula).trim().toLowerCase() === matriculaParam
        ) || null
    }

    if (!pessoa && nomeParam) {
      const matching = state.pessoas.filter((item) =>
        String(item.nome || '').trim().toLowerCase().includes(nomeParam)
      )
      if (matching.length > 1) {
        throw createError(409, 'Mais de um colaborador encontrado para o nome informado. Informe a matricula.')
      }
      pessoa = matching[0] || null
    }

    if (!pessoa) {
      throw createError(404, 'Colaborador nao encontrado para os dados informados.')
    }

    const pessoaRecord = mapLocalPessoaRecord(pessoa)

    const saidasPessoa = state.saidas.filter((saida) => saida.pessoaId === pessoa.id).map(mapLocalSaidaRecord)
    if (!saidasPessoa.length) {
      throw createError(404, 'Nenhuma saida registrada para o colaborador informado.')
    }

    const materiaisMap = new Map(state.materiais.map((material) => [material.id, mapLocalMaterialResumo(material)]))

    const saidasDetalhadas = saidasPessoa.map((saida) => ({
      ...saida,
      material: materiaisMap.get(saida.materialId) || null,
    }))

    const contextoBase = montarContextoTermoEpiLocal(pessoaRecord, saidasDetalhadas)
    return {
      ...contextoBase,
      empresa: resolveEmpresaInfoLocal(),
    }
  })
}

const normalizeKeyPart = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const isGrupo = (value, target) => normalizeKeyPart(value) === normalizeKeyPart(target)

const buildNumeroEspecifico = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, 'Calçado')) {
    return numeroCalcado
  }
  if (isGrupo(grupoMaterial, 'Vestimenta')) {
    return numeroVestimenta
  }
  return ''
}

const buildChaveUnica = ({ grupoMaterial, nome, fabricante, numeroEspecifico }) =>
  [
    normalizeKeyPart(grupoMaterial),
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(numeroEspecifico),
  ].join('||')

const gruposEpiPadrao = (() => {
  if (Array.isArray(gruposEpi)) {
    return gruposEpi
  }
  if (Array.isArray(gruposEpi?.grupos)) {
    return gruposEpi.grupos
  }
  return []
})()
  .map((item) => (item ? String(item).trim() : ''))
  .filter(Boolean)

const sanitizeMaterialPayload = (payload = {}) => {
  const grupoMaterial = trim(payload.grupoMaterial)
  const numeroCalcado = sanitizeDigitsOnly(payload.numeroCalcado)
  const numeroVestimenta = trim(payload.numeroVestimenta)
  const numeroEspecifico = buildNumeroEspecifico({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  })

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
    grupoMaterial,
    numeroCalcado: isGrupo(grupoMaterial, 'Calçado') ? numeroCalcado : '',
    numeroVestimenta: isGrupo(grupoMaterial, 'Vestimenta') ? numeroVestimenta : '',
    numeroEspecifico,
    chaveUnica: buildChaveUnica({
      grupoMaterial,
      nome: payload.nome,
      fabricante: payload.fabricante,
      numeroEspecifico,
    }),
  }
}

const validateMaterialPayload = (payload) => {
  if (!payload.nome) throw createError(400, 'Nome do material obrigatorio.')
  if (/\d/.test(payload.nome)) {
    throw createError(400, 'O campo EPI não pode conter números.')
  }
  if (!payload.fabricante) throw createError(400, 'Fabricante obrigatorio.')
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw createError(400, 'Validade deve ser maior que zero.')
  }
  if (!payload.ca) {
    throw createError(400, 'CA obrigatorio.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw createError(400, 'Valor unitario deve ser maior que zero.')
  }
  if (!payload.grupoMaterial) {
    throw createError(400, 'Grupo de material obrigatorio.')
  }
  if (isGrupo(payload.grupoMaterial, 'Calçado') && !payload.numeroCalcado) {
    throw createError(400, 'Informe o número do calçado.')
  }
  if (isGrupo(payload.grupoMaterial, 'Vestimenta') && !payload.numeroVestimenta) {
    throw createError(400, 'Informe o número da vestimenta.')
  }
  if (
    payload.estoqueMinimo !== null &&
    (Number.isNaN(Number(payload.estoqueMinimo)) || Number(payload.estoqueMinimo) < 0)
  ) {
    throw createError(400, 'Estoque minimo deve ser zero ou positivo.')
  }
}

const sanitizeEntradaPayload = (payload = {}) => ({
  materialId: trim(payload.materialId),
  quantidade: Number(payload.quantidade ?? 0),
  centroCusto: trim(payload.centroCusto),
  dataEntrada: toIsoOrNull(payload.dataEntrada, true),
  usuarioResponsavel: trim(payload.usuarioResponsavel) || 'sistema',
})

const validateEntradaPayload = (payload) => {
  if (!payload.materialId) throw createError(400, 'Material obrigatorio.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createError(400, 'Centro de custo obrigatorio.')
}

const sanitizeSaidaPayload = (payload = {}) => ({
  pessoaId: trim(payload.pessoaId),
  materialId: trim(payload.materialId),
  quantidade: Number(payload.quantidade ?? 0),
  dataEntrega: toIsoOrNull(payload.dataEntrega, true),
  usuarioResponsavel: trim(payload.usuarioResponsavel) || 'sistema',
  status: trim(payload.status) || 'entregue',
})

const validateSaidaPayload = (payload) => {
  if (!payload.pessoaId) throw createError(400, 'Pessoa obrigatoria para saida.')
  if (!payload.materialId) throw createError(400, 'Material obrigatorio para saida.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createError(400, 'Centro de custo obrigatorio.')
  if (!payload.centroServico) throw createError(400, 'Centro de servico obrigatorio.')
}

const sanitizeOptional = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = trim(value)
  return trimmed || null
}

const sanitizeAcidentePayload = (payload = {}) => {
  const centroServico = trim(payload.centroServico ?? payload.setor)
  const local = trim(payload.local)
  return {
    matricula: trim(payload.matricula),
    nome: trim(payload.nome),
    cargo: trim(payload.cargo),
    data: toIsoOrNull(payload.data, false),
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
    hht:
      payload.hht !== undefined && payload.hht !== null && String(payload.hht).trim() !== ''
        ? Number(payload.hht)
        : null,
    cid: sanitizeOptional(payload.cid),
    cat: sanitizeOptional(payload.cat),
    observacao: sanitizeOptional(payload.observacao),
  }
}

const validateAcidentePayload = (payload) => {
  if (!payload.matricula) throw createError(400, 'Matricula obrigatoria.')
  if (!payload.nome) throw createError(400, 'Nome obrigatorio.')
  if (!payload.cargo) throw createError(400, 'Cargo obrigatorio.')
  if (!payload.tipo) throw createError(400, 'Tipo de acidente obrigatorio.')
  if (!payload.agente) throw createError(400, 'Agente causador obrigatorio.')
  if (!payload.lesao) throw createError(400, 'Lesao obrigatoria.')
  if (!payload.parteLesionada) throw createError(400, 'Parte lesionada obrigatoria.')
  if (!payload.centroServico) throw createError(400, 'Centro de servico obrigatorio.')
  if (!payload.data) throw createError(400, 'Data do acidente obrigatoria.')
  if (!Number.isInteger(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createError(400, 'Dias perdidos deve ser um inteiro zero ou positivo.')
  }
  if (!Number.isInteger(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createError(400, 'Dias debitados deve ser um inteiro zero ou positivo.')
  }
  if (payload.hht !== null && payload.hht !== undefined) {
    if (!Number.isInteger(Number(payload.hht)) || Number(payload.hht) < 0) {
      throw createError(400, 'HHT deve ser um inteiro zero ou positivo.')
    }
  }
  if (payload.cat && !/^\d+$/.test(String(payload.cat))) {
    throw createError(400, 'CAT deve conter apenas numeros inteiros.')
  }
}

const calcularDataTroca = (dataEntregaIso, validadeDias) => {
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

const normalizeSearchTerm = (value) => (value ? String(value).trim().toLowerCase() : '')

const toStartOfDay = (value) => {
  const raw = value ? String(value).trim() : ''
  if (!raw) {
    return null
  }
  const date = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

const toEndOfDay = (value) => {
  const raw = value ? String(value).trim() : ''
  if (!raw) {
    return null
  }
  const date = new Date(`${raw}T23:59:59.999`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function filterLocalEntradas(entradas, params = {}, state) {
  const termo = normalizeSearchTerm(params.termo)
  const materialId = trim(params.materialId || '')
  const centroCusto = normalizeSearchTerm(params.centroCusto)
  const inicio = toStartOfDay(params.dataInicio)
  const fim = toEndOfDay(params.dataFim)

  const materiaisMap = new Map(state.materiais.map((material) => [material.id, material]))

  return entradas.filter((entrada) => {
    if (materialId && entrada.materialId !== materialId) {
      return false
    }

    if (centroCusto && normalizeSearchTerm(entrada.centroCusto) !== centroCusto) {
      return false
    }

    if (inicio || fim) {
      const data = entrada.dataEntrada ? new Date(entrada.dataEntrada) : null
      if (!data || Number.isNaN(data.getTime())) {
        return false
      }
      if (inicio && data < inicio) {
        return false
      }
      if (fim && data > fim) {
        return false
      }
    }

    if (!termo) {
      return true
    }

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
  })
}

function filterLocalSaidas(saidas, params = {}, state) {
  const termo = normalizeSearchTerm(params.termo)
  const pessoaId = trim(params.pessoaId || '')
  const materialId = trim(params.materialId || '')
  const centroCusto = normalizeSearchTerm(params.centroCusto)
  const centroServico = normalizeSearchTerm(params.centroServico)
  const status = normalizeSearchTerm(params.status)
  const inicio = toStartOfDay(params.dataInicio)
  const fim = toEndOfDay(params.dataFim)

  const pessoasMap = new Map(
    state.pessoas.map((pessoa) => {
      const normalizada = mapLocalPessoaRecord(pessoa)
      return [normalizada.id || pessoa.id, normalizada]
    }),
  )
  const materiaisMap = new Map(state.materiais.map((material) => [material.id, material]))

  return saidas.filter((saida) => {
    if (pessoaId && saida.pessoaId !== pessoaId) {
      return false
    }

    if (materialId && saida.materialId !== materialId) {
      return false
    }

    if (status && normalizeSearchTerm(saida.status) !== status) {
      return false
    }

    if (centroCusto && normalizeSearchTerm(saida.centroCusto) !== centroCusto) {
      return false
    }

    if (centroServico && normalizeSearchTerm(saida.centroServico) !== centroServico) {
      return false
    }

    if (inicio || fim) {
      const data = saida.dataEntrega ? new Date(saida.dataEntrega) : null
      if (!data || Number.isNaN(data.getTime())) {
        return false
      }
      if (inicio && data < inicio) {
        return false
      }
      if (fim && data > fim) {
        return false
      }
    }

    if (!termo) {
      return true
    }

    const pessoa = pessoasMap.get(saida.pessoaId)
    const material = materiaisMap.get(saida.materialId)
    const alvo = [
      material?.nome || '',
      material?.fabricante || '',
      pessoa?.nome || '',
      (pessoa?.centroServico ?? pessoa?.local) || '',
      saida.centroCusto || '',
      saida.centroServico || '',
      saida.usuarioResponsavel || '',
      saida.status || '',
    ]
      .join(' ')
      .toLowerCase()

    return alvo.includes(termo)
  })
}

const sortByDateDesc = (lista, campo) =>
  lista.slice().sort((a, b) => {
    const aTime = a[campo] ? new Date(a[campo]).getTime() : 0
    const bTime = b[campo] ? new Date(b[campo]).getTime() : 0
    return bTime - aTime
  })

const localApi = {
  async health() {
    return { status: 'ok', mode: 'local' }
  },
  pessoas: {
      async list(params = {}) {
        return readState((state) => {
          const pessoas = state.pessoas.map(mapLocalPessoaRecord)
          const filters = {
            termo: params.termo ?? '',
            centroServico: params.centroServico ?? params.local ?? 'todos',
            local: params.local ?? params.centroServico ?? 'todos',
            cargo: params.cargo ?? 'todos',
          }
          return filterPessoas(pessoas, filters)
        })
      },
    async create(payload) {
      const dados = sanitizePessoaPayload(payload)
      validatePessoaPayload(dados)

      const usuario = trim(payload.usuarioCadastro) || 'sistema'

      return writeState((state) => {
        const exists = state.pessoas.find(
          (pessoa) => pessoa.matricula && pessoa.matricula.toLowerCase() === dados.matricula.toLowerCase()
        )
        if (exists) {
          throw createError(409, 'Ja existe uma pessoa com essa matricula.')
        }

        const agora = nowIso()
        const pessoa = {
          id: randomId(),
          nome: dados.nome,
          matricula: dados.matricula,
          centroServico: dados.centroServico,
          local: dados.centroServico,
          cargo: dados.cargo,
          dataAdmissao: dados.dataAdmissao,
          tipoExecucao: dados.tipoExecucao,
          usuarioCadastro: usuario,
          usuarioEdicao: null,
          historicoEdicao: [],
          criadoEm: agora,
          atualizadoEm: null,
        }

        state.pessoas.push(pessoa)
        return mapLocalPessoaRecord(pessoa)
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID da pessoa obrigatorio.')
      }
      const dados = sanitizePessoaPayload(payload)
      validatePessoaPayload(dados)
      const usuario = trim(payload.usuarioResponsavel) || 'sistema'

      return writeState((state) => {
        const index = state.pessoas.findIndex((pessoa) => pessoa.id === id)
        if (index === -1) {
          throw createError(404, 'Pessoa nao encontrada.')
        }

        const duplicate = state.pessoas.find(
          (pessoa) => pessoa.id !== id && pessoa.matricula && pessoa.matricula.toLowerCase() === dados.matricula.toLowerCase()
        )
        if (duplicate) {
          throw createError(409, 'Ja existe uma pessoa com essa matricula.')
        }

        const atual = state.pessoas[index]
        const camposAlterados = []
        const comparacoes = [
          { campo: 'nome' },
          { campo: 'matricula' },
          { campo: 'centroServico', atualKey: 'centroServico' },
          { campo: 'cargo' },
          { campo: 'dataAdmissao' },
          { campo: 'tipoExecucao' },
        ]

        comparacoes.forEach(({ campo, atualKey }) => {
          const valorAtual = (atualKey ? atual[atualKey] : atual[campo]) || ''
          const valorNovo = campo === 'centroServico' ? dados.centroServico : dados[campo]
          if (valorAtual !== valorNovo) {
            camposAlterados.push({
              campo,
              de: valorAtual,
              para: valorNovo,
            })
          }
        })

        const historico = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
        const agora = nowIso()
        if (camposAlterados.length > 0) {
          historico.push({
            id: randomId(),
            dataEdicao: agora,
            usuarioResponsavel: usuario,
            camposAlterados,
          })
        }

        const atualizado = {
          ...atual,
          nome: dados.nome,
          matricula: dados.matricula,
          centroServico: dados.centroServico,
          local: dados.centroServico,
          cargo: dados.cargo,
          dataAdmissao: dados.dataAdmissao,
          tipoExecucao: dados.tipoExecucao,
          usuarioEdicao: usuario,
          atualizadoEm: agora,
          historicoEdicao: historico,
        }
        state.pessoas[index] = atualizado
        return mapLocalPessoaRecord(atualizado)
      })
    },
    async get(id) {
      return readState((state) => {
        const pessoa = state.pessoas.find((item) => item.id === id) || null
        return mapLocalPessoaRecord(pessoa)
      })
    },
    async history(id) {
      return readState((state) => {
        const pessoa = state.pessoas.find((item) => item.id === id)
        if (!pessoa) {
          throw createError(404, 'Pessoa nao encontrada.')
        }
        const historico = Array.isArray(pessoa.historicoEdicao) ? pessoa.historicoEdicao.slice() : []
        return sortByDateDesc(normalizePessoaHistory(historico), 'dataEdicao')
      })
    },
  },
  materiais: {
    async list() {
      return readState((state) => state.materiais.slice())
    },
    async groups() {
      return readState((state) => {
        const set = new Set(gruposEpiPadrao)
        state.materiais
          .map((material) => material.grupoMaterial && material.grupoMaterial.trim())
          .filter(Boolean)
          .forEach((grupo) => set.add(grupo))
        return Array.from(set).sort((a, b) => a.localeCompare(b))
      })
    },
    async create(payload) {
      const dados = sanitizeMaterialPayload(payload)
      validateMaterialPayload(dados)
      const usuario = trim(payload.usuarioCadastro) || 'sistema'

      return writeState((state) => {
        const existe = state.materiais.find(
          (item) => item.chaveUnica && item.chaveUnica === dados.chaveUnica
        )
        if (existe) {
          throw createError(409, 'Já existe um EPI com essas mesmas informações cadastrado.')
        }

        const material = {
          id: randomId(),
          ...dados,
          usuarioCadastro: usuario,
          usuarioAtualizacao: null,
          criadoEm: nowIso(),
          atualizadoEm: null,
        }

        state.materiais.push(material)
        state.materialPriceHistory.push({
          id: randomId(),
          materialId: material.id,
          valorUnitario: Number(dados.valorUnitario),
          usuarioResponsavel: usuario,
          dataRegistro: nowIso(),
        })

        return material
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID do material obrigatorio.')
      }

      return writeState((state) => {
        const index = state.materiais.findIndex((material) => material.id === id)
        if (index === -1) {
          throw createError(404, 'Material nao encontrado.')
        }

        const atual = state.materiais[index]
        const dadosCompletos = sanitizeMaterialPayload({ ...atual, ...payload })
        validateMaterialPayload(dadosCompletos)
        const usuario = trim(payload.usuarioResponsavel) || 'sistema'

        const existe = state.materiais.find(
          (item) => item.id !== id && item.chaveUnica && item.chaveUnica === dadosCompletos.chaveUnica
        )
        if (existe) {
          throw createError(409, 'Já existe um EPI com essas mesmas informações cadastrado.')
        }

        const atualizado = {
          ...atual,
          ...dadosCompletos,
          usuarioAtualizacao: usuario,
          atualizadoEm: nowIso(),
        }

        state.materiais[index] = atualizado

        if (Number(dadosCompletos.valorUnitario) !== Number(atual.valorUnitario)) {
          state.materialPriceHistory.push({
            id: randomId(),
            materialId: id,
            valorUnitario: Number(dadosCompletos.valorUnitario),
            usuarioResponsavel: usuario,
            dataRegistro: nowIso(),
          })
        }

        return atualizado
      })
    },
    async get(id) {
      return readState((state) => state.materiais.find((material) => material.id === id) || null)
    },
    async priceHistory(id) {
      return readState((state) =>
        sortByDateDesc(
          state.materialPriceHistory.filter((registro) => registro.materialId === id),
          'dataRegistro'
        )
      )
    },
  },
    entradas: {
      async list(params = {}) {
        return readState((state) => {
          const mapped = state.entradas.map(mapLocalEntradaRecord)
          const filtradas = filterLocalEntradas(mapped, params, state)
          return sortByDateDesc(filtradas, 'dataEntrada')
        })
      },
    async create(payload) {
      const dados = sanitizeEntradaPayload(payload)
      validateEntradaPayload(dados)

      return writeState((state) => {
        const material = state.materiais.find((item) => item.id === dados.materialId)
        if (!material) {
          throw createError(404, 'Material nao encontrado.')
        }

        const entrada = {
          id: randomId(),
          ...dados,
        }
        state.entradas.push(entrada)
        return mapLocalEntradaRecord(entrada)
      })
    },
  },
    saidas: {
      async list(params = {}) {
        return readState((state) => {
          const mapped = state.saidas.map(mapLocalSaidaRecord)
          const filtradas = filterLocalSaidas(mapped, params, state)
          return sortByDateDesc(filtradas, 'dataEntrega')
        })
      },
    async create(payload) {
      const dados = sanitizeSaidaPayload(payload)
      validateSaidaPayload(dados)

      return writeState((state) => {
        const pessoa = state.pessoas.find((item) => item.id === dados.pessoaId)
        if (!pessoa) {
          throw createError(404, 'Pessoa nao encontrada.')
        }
        const material = state.materiais.find((item) => item.id === dados.materialId)
        if (!material) {
          throw createError(404, 'Material nao encontrado.')
        }

        const estoqueAtual = calcularSaldoMaterial(material.id, state.entradas, state.saidas, null)
        if (Number(dados.quantidade) > estoqueAtual) {
          throw createError(400, 'Quantidade informada maior que estoque disponivel.')
        }

        const dataTroca = calcularDataTroca(dados.dataEntrega, material.validadeDias)

        const saida = {
          id: randomId(),
          ...dados,
          dataTroca,
        }

        state.saidas.push(saida)
        const saidaNormalizada = mapLocalSaidaRecord(saida)
        return {
          ...saidaNormalizada,
          estoqueAtual: estoqueAtual - Number(dados.quantidade),
        }
      })
    },
  },
  estoque: {
    async current(params = {}) {
      const periodo = parsePeriodo(params)
      return readState((state) => montarEstoqueAtual(state.materiais, state.entradas, state.saidas, periodo))
    },
    async dashboard(params = {}) {
      const periodo = parsePeriodo(params)
      return readState((state) =>
        montarDashboard(
          {
            materiais: state.materiais,
            entradas: state.entradas,
            saidas: state.saidas,
            pessoas: state.pessoas,
          },
          periodo
        )
      )
    },
  },
  acidentes: {
    async list() {
      return readState((state) => sortByDateDesc(state.acidentes.map(mapLocalAcidenteRecord), 'data'))
    },
    async dashboard(params = {}) {
      return readState((state) =>
        montarDashboardAcidentes(state.acidentes.map(mapLocalAcidenteRecord), params)
      )
    },
    async create(payload) {
      const dados = sanitizeAcidentePayload(payload)
      validateAcidentePayload(dados)
      const usuario = trim(payload.usuarioResponsavel) || 'sistema'

      return writeState((state) => {
        const pessoa = state.pessoas.find(
          (item) => item.matricula && item.matricula.toLowerCase() === dados.matricula.toLowerCase()
        )
        if (!pessoa) {
          throw createError(404, 'Pessoa nao encontrada para a matricula informada.')
        }

        const centroServicoBase = dados.centroServico || pessoa?.centroServico || pessoa?.setor || pessoa?.local || ''
        const localBase = dados.local || pessoa?.local || pessoa?.centroServico || ''
        const agora = nowIso()
        const acidente = {
          id: randomId(),
          matricula: dados.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          data: dados.data,
          tipo: dados.tipo,
          agente: dados.agente,
          lesao: dados.lesao,
          parteLesionada: dados.parteLesionada,
          centroServico: centroServicoBase,
          setor: centroServicoBase,
          local: localBase,
          diasPerdidos: dados.diasPerdidos,
          diasDebitados: dados.diasDebitados,
          hht: dados.hht,
          cid: dados.cid,
          cat: dados.cat,
          observacao: dados.observacao,
          registradoPor: usuario,
          criadoEm: agora,
          atualizadoEm: null,
          atualizadoPor: null,
          historicoEdicao: [],
        }

        state.acidentes.push(acidente)
        return mapLocalAcidenteRecord(acidente)
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID do acidente obrigatorio.')
      }
      return writeState((state) => {
        const index = state.acidentes.findIndex((item) => item.id === id)
        if (index === -1) {
          throw createError(404, 'Acidente nao encontrado.')
        }

        const atual = state.acidentes[index]
        const usuario = trim(payload.usuarioResponsavel) || 'sistema'
        const dadosSanitizados = sanitizeAcidentePayload({ ...atual, ...payload })
        const pessoa = dadosSanitizados.matricula
          ? state.pessoas.find((item) =>
              item.matricula && item.matricula.toLowerCase() === dadosSanitizados.matricula.toLowerCase()
            )
          : null

        const dados = {
          ...atual,
          ...dadosSanitizados,
        }

        const centroServicoPessoa = pessoa?.centroServico || pessoa?.setor || pessoa?.local || ''
        const localPessoa = pessoa?.local || pessoa?.centroServico || ''
        dados.centroServico = dadosSanitizados.centroServico || centroServicoPessoa || atual.centroServico || atual.setor || ''
        dados.local = dadosSanitizados.local || localPessoa || atual.local || dados.centroServico
        dados.setor = dados.centroServico

        validateAcidentePayload(dados)

        const camposAlterados = []
        ACIDENTE_HISTORY_FIELDS.forEach((campo) => {
          let valorAtual
          if (campo === 'centroServico') {
            valorAtual = normalizeHistoryValue(atual.centroServico ?? atual.setor ?? '')
          } else if (campo === 'local') {
            valorAtual = normalizeHistoryValue(atual.local ?? atual.centroServico ?? '')
          } else {
            valorAtual = normalizeHistoryValue(atual[campo])
          }
          const valorNovo = normalizeHistoryValue(dados[campo])
          if (valorAtual !== valorNovo) {
            camposAlterados.push({
              campo,
              de: valorAtual,
              para: valorNovo,
            })
          }
        })

        const historicoBase = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
        const agora = nowIso()
        if (camposAlterados.length > 0) {
          historicoBase.push({
            id: randomId(),
            dataEdicao: agora,
            usuarioResponsavel: usuario,
            camposAlterados,
          })
        }

        const atualizado = {
          ...dados,
          centroServico: dados.centroServico,
          setor: dados.centroServico,
          local: dados.local,
          hht: dados.hht,
          atualizadoEm: agora,
          atualizadoPor: usuario,
          historicoEdicao: historicoBase,
        }

        state.acidentes[index] = atualizado
        return mapLocalAcidenteRecord(atualizado)
      })
    },
    async history(id) {
      return readState((state) => {
        const acidente = state.acidentes.find((item) => item.id === id)
        if (!acidente) {
          throw createError(404, 'Acidente nao encontrado.')
        }
        const historico = Array.isArray(acidente.historicoEdicao) ? acidente.historicoEdicao.slice() : []
        return sortByDateDesc(normalizeAcidenteHistory(historico), 'dataEdicao')
      })
    },
  },
  documentos: {
    async termoEpiContext(params = {}) {
      return obterContextoTermoEpiLocal(params)
    },
    async termoEpiPdf(params = {}) {
      const contexto = obterContextoTermoEpiLocal(params)
      const html = buildEpiTermHtml(contexto)
      return new Blob([html], { type: 'text/html;charset=utf-8' })
    },
  },
}

export { localApi }




