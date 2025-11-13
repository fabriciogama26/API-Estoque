import { readState, writeState } from './localDataStore.js'
import {
  montarEstoqueAtual,
  montarDashboard,
  parsePeriodo,
  calcularSaldoMaterial,
} from '../lib/estoque.js'
import { montarDashboardAcidentes } from '../lib/acidentesDashboard.js'
import gruposEpi from '../data/grupos-epi.json'
import {
  filterPessoas,
  extractCentrosServico,
  extractCargos,
  extractSetores,
  extractTiposExecucao,
} from '../rules/PessoasRules.js'

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUS_CANCELADO_NOME = 'CANCELADO'

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

const toDateOnlyIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const datePart = raw.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)
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
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
  const setor = trim(payload.setor ?? centroServico)
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    cargo: trim(payload.cargo),
    centroServico,
    setor,
    dataAdmissao: toLocalDateIso(payload.dataAdmissao),
    tipoExecucao: trim(payload.tipoExecucao),
  }
}

const validatePessoaPayload = (payload) => {
  if (!payload.nome) throw createError(400, 'Nome obrigatorio.')
  if (!payload.matricula) throw createError(400, 'Matricula obrigatoria.')
  if (!payload.centroServico) throw createError(400, 'Centro de servico obrigatorio.')
  if (!payload.setor) throw createError(400, 'Setor obrigatorio.')
  if (!payload.cargo) throw createError(400, 'Cargo obrigatorio.')
  if (!payload.tipoExecucao) throw createError(400, 'Tipo Execucao obrigatorio.')
}

const mapDomainOption = (valor, index) => {
  const nome = trim(valor)
  if (!nome) {
    return null
  }
  return {
    id: `local-${index}`,
    nome,
  }
}

const mapLocalPessoaRecord = (pessoa) => {
  if (!pessoa || typeof pessoa !== 'object') {
    return pessoa
  }
  const centroServico = pessoa.centroServico ?? pessoa.local ?? pessoa.setor ?? ''
  const setor = pessoa.setor ?? centroServico
  return {
    ...pessoa,
    centroServico,
    setor,
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
    usuarioResponsavel: entrada.usuarioResponsavel ?? '',
    usuarioResponsavelId:
      typeof entrada.usuarioResponsavel === 'string' && UUID_REGEX.test(entrada.usuarioResponsavel.trim())
        ? entrada.usuarioResponsavel.trim()
        : null,
    usuarioResponsavelNome: entrada.usuarioResponsavel ?? '',
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
    status: saida.status ?? 'entregue',
    statusId: saida.statusId ?? saida.status ?? '',
  }
}

const buildLocalSaidaSnapshot = (saida, state) => {
  if (!saida) {
    return null
  }
  const pessoas = Array.isArray(state?.pessoas) ? state.pessoas : []
  const materiais = Array.isArray(state?.materiais) ? state.materiais : []
  const pessoa = pessoas.find((item) => item.id === saida.pessoaId)
  const material = materiais.find((item) => item.id === saida.materialId)
  return {
    saidaId: saida.id,
    pessoaId: saida.pessoaId,
    pessoaNome: pessoa?.nome ?? '',
    pessoaMatricula: pessoa?.matricula ?? '',
    pessoaCargo: pessoa?.cargo ?? '',
    materialResumo: material?.nome ?? saida.materialId,
    quantidade: saida.quantidade,
    centroCusto: saida.centroCusto ?? '',
    centroCustoId: saida.centroCustoId ?? '',
    centroServico: saida.centroServico ?? '',
    centroServicoId: saida.centroServicoId ?? '',
    status: saida.status ?? '',
    statusId: saida.statusId ?? '',
    dataEntrega: saida.dataEntrega,
    dataTroca: saida.dataTroca,
    usuarioResponsavel: saida.usuarioResponsavel ?? '',
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

const normalizeHistoryValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) {
          return ''
        }
        if (typeof item === 'object') {
          try {
            return JSON.stringify(item)
          } catch (error) {
            console.warn('Falha ao serializar valor de histórico (local).', error)
            return ''
          }
        }
        return item.toString().trim()
      })
      .filter(Boolean)
      .join(', ')
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (error) {
      console.warn('Falha ao serializar valor de histórico (local).', error)
      return ''
    }
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return ''
  }
  return value.toString().trim()
}

const extractTextualNames = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }
  const seen = new Set()
  return lista
    .map((item) => {
      if (!item) {
        return ''
      }
      if (typeof item === 'string') {
        return item.trim()
      }
      if (typeof item === 'object') {
        const nome =
          (typeof item.nome === 'string' && item.nome.trim()) ||
          (typeof item.name === 'string' && item.name.trim()) ||
          (typeof item.label === 'string' && item.label.trim()) ||
          (typeof item.valor === 'string' && item.valor.trim()) ||
          (typeof item.value === 'string' && item.value.trim())
        return nome || ''
      }
      return String(item ?? '').trim()
    })
    .filter(Boolean)
    .filter((nome) => {
      if (seen.has(nome)) {
        return false
      }
      seen.add(nome)
      return true
    })
}

const selectMaterialHistoryFields = (material = {}) => {
  if (!material || typeof material !== 'object') {
    return {}
  }

  const caracteristicaNome =
    material.caracteristicasTexto ??
    material.caracteristicaEpi ??
    (Array.isArray(material.caracteristicas)
      ? extractTextualNames(material.caracteristicas).join('; ')
      : '')

  const corNome =
    material.coresTexto ??
    material.corMaterial ??
    (Array.isArray(material.cores) ? extractTextualNames(material.cores).join('; ') : '')

  const grupoMaterialValue =
    material.grupoMaterial ??
    material.grupoMaterialNome ??
    ''

  const grupoMaterialNomeValue =
    material.grupoMaterialNome ??
    material.grupoMaterial ??
    ''

  const numeroCalcadoValue =
    material.numeroCalcado ??
    material.numeroCalcadoId ??
    material.numeroCalcadoNome ??
    null

  const numeroVestimentaValue =
    material.numeroVestimenta ??
    material.numeroVestimentaId ??
    material.numeroVestimentaNome ??
    null

  return {
    materialItemNome:
      material.materialItemNome ??
      material.nomeItemRelacionado ??
      material.nome ??
      '',
    fabricanteNome: material.fabricanteNome ?? material.fabricante ?? '',
    validadeDias: material.validadeDias ?? null,
    ca: material.ca ?? '',
    valorUnitario: material.valorUnitario ?? null,
    estoqueMinimo: material.estoqueMinimo ?? null,
    ativo: material.ativo ?? true,
    descricao: material.descricao ?? '',
    grupoMaterial: grupoMaterialValue,
    grupoMaterialNome: grupoMaterialNomeValue,
    numeroCalcado: numeroCalcadoValue,
    numeroVestimenta: numeroVestimentaValue,
    numeroEspecifico: material.numeroEspecifico ?? '',
    caracteristicaNome,
    corNome,
  }
}

const buildHistoryChanges = (prev, next) => {
  if (!prev || !next) {
    return null
  }

  const campos = new Set([
    ...Object.keys(prev ?? {}),
    ...Object.keys(next ?? {}),
  ])
  const diff = []

  campos.forEach((campo) => {
    const valorAtual = normalizeHistoryValue(prev?.[campo])
    const valorNovo = normalizeHistoryValue(next?.[campo])
    if (valorAtual !== valorNovo) {
      diff.push({
        campo,
        de: valorAtual,
        para: valorNovo,
      })
    }
  })

  return diff.length > 0 ? diff : null
}

const mapLocalAcidenteRecord = (acidente) => {
  if (!acidente || typeof acidente !== 'object') {
    return acidente
  }
  const centroServico = acidente.centroServico ?? acidente.setor ?? ''
  const partes = Array.isArray(acidente.partesLesionadas)
    ? acidente.partesLesionadas.filter((parte) => parte && parte.trim())
    : acidente.parteLesionada
    ? [acidente.parteLesionada]
    : []
  const lesoes =
    Array.isArray(acidente.lesoes) && acidente.lesoes.length > 0
      ? acidente.lesoes.map((lesao) => (lesao && String(lesao).trim()) || '').filter(Boolean)
      : acidente.lesao
      ? [String(acidente.lesao).trim()].filter(Boolean)
      : []
  const agentesLista = splitMultiValue(acidente.agentes ?? acidente.agente ?? '')
  const tiposLista = splitMultiValue(acidente.tipos ?? acidente.tipo ?? '')
  return {
    ...acidente,
    centroServico,
    setor: acidente.setor ?? centroServico,
    local: acidente.local ?? centroServico,
    agente: agentesLista.join('; '),
    agentes: agentesLista,
    tipo: tiposLista.join('; '),
    tipos: tiposLista,
    lesoes,
    lesao: lesoes[0] ?? acidente.lesao ?? '',
    partesLesionadas: partes,
    parteLesionada: partes[0] ?? acidente.parteLesionada ?? '',
  }
}

const locaisAcidentePadrao = [
  'Sala de aula',
  'Laboratório de química',
  'Laboratório de biologia',
  'Laboratório de informática',
  'Laboratório de radiologia',
  'Clínica veterinária',
  'Curral',
  'Baias',
  'Consultório médico',
  'Centro cirúrgico',
  'Farmácia',
  'Refeitório',
  'Cozinha',
  'Corredor',
  'Escada',
  'Pátio',
  'Banheiro',
  'Biblioteca',
  'Auditório',
  'Sala administrativa',
  'Estacionamento',
  'Oficina de manutenção',
  'Almoxarifado',
  'Central de gás',
  'Depósito de materiais',
  'Praça',
  'Garagem',
  'Sala de máquinas',
  'Abrigo de gerador',
  'Poço de elevador',
  'Laboratório de análises clínicas',
]

const mapLocalMaterialResumo = (material) => {
  if (!material || typeof material !== 'object') {
    return null
  }
  return {
    id: material.id,
    nome: material.nome || material.materialItemNome || '',
    materialItemNome: material.materialItemNome || material.nome || '',
    fabricante: material.fabricanteNome || material.fabricante || '',
    fabricanteNome: material.fabricanteNome || material.fabricante || '',
    ca: material.ca || '',
    numeroEspecifico: material.numeroEspecifico || '',
    numeroCalcado: material.numeroCalcado || '',
    numeroVestimenta: material.numeroVestimenta || '',
    grupoMaterial: material.grupoMaterialNome || material.grupoMaterial || '',
    grupoMaterialNome: material.grupoMaterialNome || material.grupoMaterial || '',
    grupoMaterialId: material.grupoMaterialId || null,
    caracteristicaEpi: material.caracteristicaEpi || '',
    caracteristicas: Array.isArray(material.caracteristicas)
      ? material.caracteristicas
      : normalizeSelectionList(material.caracteristicaEpi || [], 'caracteristica'),
    cores: Array.isArray(material.cores)
      ? material.cores
      : normalizeSelectionList(material.corMaterial || [], 'cor'),
    corMaterial: material.corMaterial || '',
  }
}

const uniqueSorted = (lista) =>
  Array.from(new Set((lista || []).map((item) => (item && String(item).trim()) || '').filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  )

const mapLocalMaterialRecord = (material) => {
  if (!material || typeof material !== 'object') {
    return null
  }

  const caracteristicasLista = normalizeSelectionList(
    Array.isArray(material.caracteristicas) && material.caracteristicas.length
      ? material.caracteristicas
      : material.caracteristicaEpi,
    'caracteristica',
  )

  const coresLista = normalizeSelectionList(
    Array.isArray(material.cores) && material.cores.length ? material.cores : material.corMaterial,
    'cor',
  )

  const caracteristicasNomes = uniqueSorted(caracteristicasLista.map((item) => item?.nome))
  const coresNomes = uniqueSorted(coresLista.map((item) => item?.nome))

  const corMaterialTexto = material.corMaterial || coresNomes.join('; ')

  return {
    ...material,
    nome: material.nome ?? material.materialItemNome ?? '',
    nomeItemRelacionado: material.nomeItemRelacionado ?? material.materialItemNome ?? material.nome ?? '',
    materialItemNome: material.materialItemNome ?? material.nome ?? '',
    fabricante: material.fabricanteNome ?? material.fabricante ?? '',
    fabricanteNome: material.fabricanteNome ?? material.fabricante ?? '',
    grupoMaterial: material.grupoMaterialNome ?? material.grupoMaterial ?? '',
    grupoMaterialNome: material.grupoMaterialNome ?? material.grupoMaterial ?? '',
    grupoMaterialId:
      material.grupoMaterialId ||
      (material.grupoMaterialNome || material.grupoMaterial
        ? buildOptionId('grupo', material.grupoMaterialNome || material.grupoMaterial)
        : null),
    numeroCalcadoNome: material.numeroCalcadoNome ?? material.numeroCalcado ?? '',
    numeroVestimentaNome: material.numeroVestimentaNome ?? material.numeroVestimenta ?? '',
    caracteristicas: caracteristicasLista,
    caracteristicasIds: caracteristicasLista.map((item) => item?.id).filter(Boolean),
    caracteristicasNomes,
    caracteristicasTexto: formatCaracteristicaTexto(caracteristicasNomes),
    corMaterial: corMaterialTexto,
    cores: coresLista,
    coresIds: coresLista.map((item) => item?.id).filter(Boolean),
    coresNomes,
    coresTexto: coresNomes.join('; '),
    usuarioCadastroNome: material.usuarioCadastroNome ?? '',
    usuarioAtualizacaoNome: material.usuarioAtualizacaoNome ?? '',
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

const buildLesaoKey = (agente, nome) =>
  `${normalizeKeyPart(agente)}::${normalizeKeyPart(nome)}`

const normalizeGrupoLocal = (value) => {
  const base = normalizeKeyPart(value)
  return base.endsWith('s') ? base.slice(0, -1) : base
}

const isGrupo = (value, target) => normalizeGrupoLocal(value) === normalizeGrupoLocal(target)

const requiresTamanho = (grupoMaterial) =>
  isGrupo(grupoMaterial, 'Vestimenta') || isGrupo(grupoMaterial, 'Proteção das Mãos')

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

const normalizeCatalogoLista = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }
  return Array.from(
    new Set(
      lista
        .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

const resolveCatalogoNome = (item) => {
  if (item === null || item === undefined) {
    return ''
  }
  if (typeof item === 'string') {
    return trim(item)
  }
  const keys = [
    'nome',
    'descricao',
    'label',
    'valor',
    'value',
    'caracteristica_material',
    'caracteristicaMaterial',
    'cor',
    'cor_material',
  ]
  for (const key of keys) {
    const valor = item[key]
    if (typeof valor === 'string' && valor.trim()) {
      return valor.trim()
    }
  }
  return ''
}

const buildOptionId = (prefix, nome, index = 0) => {
  const base = normalizeKeyPart(nome)
  if (!base) {
    return `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`
  }
  return `${prefix}-${base}`
}

const buildGrupoItemId = (grupoNome, itemNome) =>
  buildOptionId('item', `${grupoNome || 'grupo'}-${itemNome || ''}`)

const normalizeCatalogoOptions = (lista, prefix) => {
  const valores = []
  const vistos = new Set()
  ;(Array.isArray(lista) ? lista : [])
    .map((item, index) => {
      if (item === null || item === undefined) {
        return null
      }
      if (typeof item === 'string') {
        const nome = trim(item)
        if (!nome) {
          return null
        }
        const id = buildOptionId(prefix, nome, index)
        return { id, nome }
      }
      const nome = resolveCatalogoNome(item)
      if (!nome) {
        return null
      }
      const idBase = item.id ?? item.uuid ?? item.value ?? item.valor ?? null
      const id = idBase ?? buildOptionId(prefix, nome, index)
      return { id, nome }
    })
    .filter(Boolean)
    .forEach((item) => {
      const chave = item.id ?? `${prefix}-${item.nome.toLowerCase()}`
      if (!vistos.has(chave)) {
        vistos.add(chave)
        valores.push(item)
      }
    })
  return valores
}

const normalizeSelectionList = (value, prefix) => {
  if (Array.isArray(value)) {
    return normalizeCatalogoOptions(value, prefix)
  }
  if (value === null || value === undefined || value === '') {
    return []
  }
  return normalizeCatalogoOptions([value], prefix)
}

const buildNumeroEspecifico = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, 'Calçado')) {
    return numeroCalcado
  }
  if (requiresTamanho(grupoMaterial)) {
    return numeroVestimenta
  }
  return ''
}

const catalogoGruposMateriais = {
  Vestimentas: [
    'Camisa manga longa',
    'Camisa manga curta',
    'Calça de brim',
    'Jaleco hospitalar',
    'Avental PVC',
    'Macacão de proteção química',
    'Capote descartável',
    'Touca descartável',
    'Avental de chumbo (radiologia)',
    'Colete refletivo',
    'Capa de chuva',
    'Colete salva-vidas',
  ],
  'Calçados': [
    'Botina de segurança bico plástico',
    'Botina de segurança bico de aço',
    'Sapato hospitalar fechado',
    'Tênis antiderrapante',
    'Bota de borracha cano longo',
    'Bota de PVC',
  ],
  'Proteção das Mãos': [
    'Luva de vaqueta',
    'Luva nitrílica',
    'Luva de látex',
    'Luva térmica',
    'Luva de raspa',
    'Luva de procedimento',
    'Luva descartável',
  ],
  'Proteção da Cabeça e Face': [
    'Capacete de segurança',
    'Protetor facial',
    'Óculos de segurança incolor',
    'Óculos de segurança fumê',
    'Máscara facial',
    'Máscara cirúrgica',
    'Máscara com filtro',
    'Escudo facial',
  ],
  'Proteção Auditiva': [
    'Protetor auricular tipo plug',
    'Protetor auricular tipo concha',
  ],
  'Proteção Respiratória': [
    'Respirador semifacial',
    'Respirador purificador de ar',
    'Máscara de carvão ativado',
  ],
  'Proteção contra Quedas': [
    'Cinto de segurança tipo paraquedista',
    'Talabarte com absorvedor de energia',
    'Trava quedas',
    'Cordas de ancoragem',
  ],
  Outros: [
    'Creme protetor solar',
    'Creme de proteção dérmica',
    'Protetor de nuca',
  ],
}

const catalogoCaracteristicasEpi = [
  'Impermeável',
  'Resistente a corte',
  'Antiestático',
  'Descartável',
  'Proteção térmica',
  'Proteção química',
  'Proteção elétrica',
]

const catalogoCores = ['AMARELA', 'AZUL', 'BRANCA', 'LARANJA', 'PRETA', 'VERDE', 'VERMELHA']

const catalogoMedidasCalcado = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44']

const catalogoMedidasVestimenta = ['PP', 'P', 'M', 'G', 'GG', 'XG']

const catalogoFabricantesPadrao = ['3M', 'Honeywell', 'MSA', 'Vulkan', 'Volk do Brasil']

const gruposEpiFonte = (() => {
  if (Array.isArray(gruposEpi)) {
    return gruposEpi
  }
  if (Array.isArray(gruposEpi?.grupos)) {
    return gruposEpi.grupos
  }
  return []
})()

const gruposEpiPadrao = Array.from(
  new Set([
    ...Object.keys(catalogoGruposMateriais),
    ...gruposEpiFonte.map((item) => (item ? String(item).trim() : '')),
  ]),
)
  .map((item) => (item ? String(item).trim() : ''))
  .filter(Boolean)

const catalogoAcidenteAgentes = {
  'Agente Quimico': [
    'Poeiras',
    'Fumos metalicos',
    'Nevoas e nevoas oleosas',
    'Vapores organicos',
    'Gases toxicos',
    'Acidos e bases fortes',
    'Produtos de limpeza agressivos',
    'Agrotoxicos e pesticidas',
    'Combustiveis e inflamaveis',
    'Resinas, colas, tintas e adesivos',
  ],
  'Agente Biologico': [
    'Bacterias',
    'Virus',
    'Fungos e esporos',
    'Parasitas',
    'Fluidos biologicos',
    'Materiais contaminados',
    'Animais e vetores',
    'Carcacas e residuos de origem animal',
  ],
  'Agente Fisico': [
    'Ruido excessivo',
    'Vibracao',
    'Temperaturas extremas',
    'Pressao anormal',
    'Radiacao ionizante',
    'Radiacao nao ionizante',
    'Iluminacao inadequada',
    'Corrente eletrica',
    'Umidade elevada ou seca excessiva',
    'Campos eletromagneticos',
  ],
  'Agente Mecanico / de Acidente': [
    'Maquinas e equipamentos com partes moveis',
    'Ferramentas manuais ou eletricas',
    'Queda de objetos ou materiais',
    'Escadas, andaimes e plataformas instaveis',
    'Pisos escorregadios, irregulares ou com obstaculos',
    'Veiculos em movimento',
    'Perfurocortantes',
    'Animais',
    'Projecao de fragmentos ou particulas',
    'Falta de protecao, sinalizacao ou guarda-corpo',
    'Explosoes, incendios e curto-circuitos',
  ],
  'Agente Ergonomico': [
    'Postura incorreta ou forcada',
    'Movimentos repetitivos',
    'Esforco fisico intenso',
    'Levantamento e transporte manual de cargas',
    'Ritmo de trabalho acelerado',
    'Monotonia e repetitividade',
    'Jornada prolongada sem pausas',
    'Mobiliario inadequado',
    'Falta de conforto termico ou visual',
    'Exigencia cognitiva excessiva',
  ],
  'Agente Psicosocial': [
    'Estresse ocupacional',
    'Assedio moral ou sexual',
    'Pressao por metas inalcancaveis',
    'Falta de reconhecimento',
    'Conflitos interpessoais ou hierarquicos',
    'Isolamento social',
    'Sobrecarga ou ambiguidade de funcao',
    'Clima organizacional negativo',
    'Trabalho noturno ou em revezamento',
    'Inseguranca quanto a estabilidade no emprego',
  ],
}

const catalogoAcidentePartes = [
  { grupo: 'Cabeca', subgrupo: '', nome: 'Couro cabeludo' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Cranio' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Face' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Testa' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Olho direito' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Olho esquerdo' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Nariz' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Boca' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Bochecha direita' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Bochecha esquerda' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Queixo' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Ouvidos' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Orelha direita' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Orelha esquerda' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Mandibula' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Maxilar' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Dentes' },
  { grupo: 'Cabeca', subgrupo: '', nome: 'Lingua' },
  { grupo: 'Pescoco', subgrupo: '', nome: 'Regiao anterior (garganta)' },
  { grupo: 'Pescoco', subgrupo: '', nome: 'Regiao posterior (nuca)' },
  { grupo: 'Pescoco', subgrupo: '', nome: 'Traqueia' },
  { grupo: 'Pescoco', subgrupo: '', nome: 'Pescoco lateral direito' },
  { grupo: 'Pescoco', subgrupo: '', nome: 'Pescoco lateral esquerdo' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Torax anterior (peito)' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Torax posterior (costas superiores)' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Mamas' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Esterno' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Costelas direitas / esquerdas' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Pulmoes (internos)' },
  { grupo: 'Tronco', subgrupo: 'Regiao Toracica', nome: 'Coracao (interno)' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Abdome superior' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Abdome inferior' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Lado direito / esquerdo' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Figado' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Estomago' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Intestinos' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Baco' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Pancreas' },
  { grupo: 'Tronco', subgrupo: 'Regiao Abdominal', nome: 'Rins direito e esquerdo' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Coluna dorsal' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Coluna lombar' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Quadril direito' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Quadril esquerdo' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Nadega direita' },
  { grupo: 'Tronco', subgrupo: 'Regiao Lombar e Dorsal', nome: 'Nadega esquerda' },
  { grupo: 'Membros Superiores', subgrupo: 'Ombros e Bracos', nome: 'Ombro direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Ombros e Bracos', nome: 'Ombro esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Ombros e Bracos', nome: 'Braco direito (superior)' },
  { grupo: 'Membros Superiores', subgrupo: 'Ombros e Bracos', nome: 'Braco esquerdo (superior)' },
  { grupo: 'Membros Superiores', subgrupo: 'Cotovelos e Antebracos', nome: 'Cotovelo direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Cotovelos e Antebracos', nome: 'Cotovelo esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Cotovelos e Antebracos', nome: 'Antebraco direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Cotovelos e Antebracos', nome: 'Antebraco esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Punho direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Punho esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao direita' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao direita - Palma' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao direita - Dorso' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Polegar direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Indicador direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Medio direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Anelar direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Minimo direito' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao esquerda' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao esquerda - Palma' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Mao esquerda - Dorso' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Polegar esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Indicador esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Medio esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Anelar esquerdo' },
  { grupo: 'Membros Superiores', subgrupo: 'Punhos e Maos', nome: 'Minimo esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Quadris e Coxas', nome: 'Quadril direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Quadris e Coxas', nome: 'Quadril esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Quadris e Coxas', nome: 'Coxa direita (anterior / posterior)' },
  { grupo: 'Membros Inferiores', subgrupo: 'Quadris e Coxas', nome: 'Coxa esquerda (anterior / posterior)' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Joelho direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Joelho esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Perna direita (anterior / posterior)' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Perna esquerda (anterior / posterior)' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Panturrilha direita' },
  { grupo: 'Membros Inferiores', subgrupo: 'Joelhos e Pernas', nome: 'Panturrilha esquerda' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Tornozelo direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Tornozelo esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe direito - Dorso' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe direito - Planta' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Halux (dedao) direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '2o dedo direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '3o dedo direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '4o dedo direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '5o dedo direito' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe esquerdo - Dorso' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Pe esquerdo - Planta' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: 'Halux (dedao) esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '2o dedo esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '3o dedo esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '4o dedo esquerdo' },
  { grupo: 'Membros Inferiores', subgrupo: 'Tornozelos e Pes', nome: '5o dedo esquerdo' },
];

const catalogoAcidenteLesoes = [
  { agente: 'Agente Quimico', nome: 'Queimadura quimica', ordem: 1 },
  { agente: 'Agente Quimico', nome: 'Irritacao cutanea', ordem: 2 },
  { agente: 'Agente Quimico', nome: 'Dermatite de contato', ordem: 3 },
  { agente: 'Agente Quimico', nome: 'Sensibilizacao alergica', ordem: 4 },
  { agente: 'Agente Quimico', nome: 'Corrosao tecidual', ordem: 5 },
  { agente: 'Agente Quimico', nome: 'Necrose', ordem: 6 },
  { agente: 'Agente Quimico', nome: 'Intoxicacao aguda', ordem: 7 },
  { agente: 'Agente Quimico', nome: 'Intoxicacao cronica', ordem: 8 },
  { agente: 'Agente Quimico', nome: 'Lesao ocular quimica', ordem: 9 },
  { agente: 'Agente Quimico', nome: 'Lesao respiratoria por vapores toxicos', ordem: 10 },
  { agente: 'Agente Quimico', nome: 'Edema pulmonar quimico', ordem: 11 },
  { agente: 'Agente Quimico', nome: 'Lesao hepatica', ordem: 12 },
  { agente: 'Agente Quimico', nome: 'Lesao renal por exposicao prolongada', ordem: 13 },
  { agente: 'Agente Biologico', nome: 'Infeccao local', ordem: 1 },
  { agente: 'Agente Biologico', nome: 'Infeccao sistemica', ordem: 2 },
  { agente: 'Agente Biologico', nome: 'Hepatite viral', ordem: 3 },
  { agente: 'Agente Biologico', nome: 'HIV / AIDS', ordem: 4 },
  { agente: 'Agente Biologico', nome: 'Leptospirose', ordem: 5 },
  { agente: 'Agente Biologico', nome: 'Raiva', ordem: 6 },
  { agente: 'Agente Biologico', nome: 'Tetano', ordem: 7 },
  { agente: 'Agente Biologico', nome: 'Micoses e dermatofitoses', ordem: 8 },
  { agente: 'Agente Biologico', nome: 'Toxoplasmose', ordem: 9 },
  { agente: 'Agente Biologico', nome: 'Brucelose', ordem: 10 },
  { agente: 'Agente Biologico', nome: 'Outras zoonoses', ordem: 11 },
  { agente: 'Agente Biologico', nome: 'Reacao alergica a agentes biologicos', ordem: 12 },
  { agente: 'Agente Fisico', nome: 'Queimadura termica', ordem: 1 },
  { agente: 'Agente Fisico', nome: 'Queimadura eletrica', ordem: 2 },
  { agente: 'Agente Fisico', nome: 'Choque eletrico', ordem: 3 },
  { agente: 'Agente Fisico', nome: 'Queimadura por radiacao', ordem: 4 },
  { agente: 'Agente Fisico', nome: 'Lesao por frio', ordem: 5 },
  { agente: 'Agente Fisico', nome: 'Lesao por calor', ordem: 6 },
  { agente: 'Agente Fisico', nome: 'Barotrauma', ordem: 7 },
  { agente: 'Agente Fisico', nome: 'Lesao por ruido', ordem: 8 },
  { agente: 'Agente Fisico', nome: 'Lesao por vibracao', ordem: 9 },
  { agente: 'Agente Fisico', nome: 'Cansaco visual', ordem: 10 },
  { agente: 'Agente Fisico', nome: 'Ofuscamento por iluminacao inadequada', ordem: 11 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Corte', ordem: 1 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Laceracao', ordem: 2 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Perfuracao', ordem: 3 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Puntura', ordem: 4 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Escoriacao', ordem: 5 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Abrasao', ordem: 6 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Contusao', ordem: 7 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Fratura', ordem: 8 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Luxacao', ordem: 9 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Entorse', ordem: 10 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Amputacao parcial ou total', ordem: 11 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Esguicho de particulas nos olhos', ordem: 12 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Lesao por esmagamento', ordem: 13 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Queda com impacto corporal', ordem: 14 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Lesao por objeto projetado ou em movimento', ordem: 15 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Perfurocortante contaminado', ordem: 16 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Lesao por animal', ordem: 17 },
  { agente: 'Agente Mecanico / de Acidente', nome: 'Politraumatismo', ordem: 18 },
  { agente: 'Agente Ergonomico', nome: 'Lombalgia', ordem: 1 },
  { agente: 'Agente Ergonomico', nome: 'Cervicalgia', ordem: 2 },
  { agente: 'Agente Ergonomico', nome: 'Tendinite', ordem: 3 },
  { agente: 'Agente Ergonomico', nome: 'Tenossinovite', ordem: 4 },
  { agente: 'Agente Ergonomico', nome: 'Bursite', ordem: 5 },
  { agente: 'Agente Ergonomico', nome: 'Sindrome do tunel do carpo', ordem: 6 },
  { agente: 'Agente Ergonomico', nome: 'Epicondilite lateral / medial', ordem: 7 },
  { agente: 'Agente Ergonomico', nome: 'Fadiga muscular', ordem: 8 },
  { agente: 'Agente Ergonomico', nome: 'Contraturas e dores miofasciais', ordem: 9 },
  { agente: 'Agente Ergonomico', nome: 'Hernia de disco', ordem: 10 },
  { agente: 'Agente Ergonomico', nome: 'Disturbios osteomusculares relacionados ao trabalho (DORT/LER)', ordem: 11 },
  { agente: 'Agente Psicosocial', nome: 'Estresse ocupacional agudo ou cronico', ordem: 1 },
  { agente: 'Agente Psicosocial', nome: 'Sindrome de Burnout', ordem: 2 },
  { agente: 'Agente Psicosocial', nome: 'Ansiedade ocupacional', ordem: 3 },
  { agente: 'Agente Psicosocial', nome: 'Depressao relacionada ao trabalho', ordem: 4 },
  { agente: 'Agente Psicosocial', nome: 'Transtorno do sono', ordem: 5 },
  { agente: 'Agente Psicosocial', nome: 'Transtorno pos-traumatico', ordem: 6 },
  { agente: 'Agente Psicosocial', nome: 'Disturbios cognitivos', ordem: 7 },
];

async function sanitizeMaterialPayload(payload = {}) {
  const grupoMaterialNome = trim(payload.grupoMaterialNome || payload.grupoMaterial)
  const grupoMaterialIdBase = trim(payload.grupoMaterialId)
  const grupoMaterialId = grupoMaterialIdBase || (grupoMaterialNome ? buildOptionId('grupo', grupoMaterialNome) : '')
  const grupoMaterial = grupoMaterialNome
  const numeroCalcado = sanitizeDigitsOnly(payload.numeroCalcado)
  const numeroVestimenta = trim(payload.numeroVestimenta)
  const materialItemNomeBase = trim(
    payload.nome || payload.materialItemNome || payload.nomeItemRelacionado || '',
  )
  const fabricanteIdBase = trim(payload.fabricante ?? payload.fabricanteId ?? '')
  const fabricanteNomeBase = trim(payload.fabricanteNome || payload.fabricante || '')
  const caracteristicasSelecionadas = normalizeSelectionList(
    payload.caracteristicas ??
      payload.caracteristicasEpi ??
      payload.caracteristicaEpi ??
      payload.caracteristicas_epi ??
      [],
    'caracteristica',
  )
  const caracteristicaEpi = formatCaracteristicaTexto(
    caracteristicasSelecionadas.length
      ? caracteristicasSelecionadas.map((item) => item.nome)
      : payload.caracteristicaEpi,
  )
  const coresSelecionadas = normalizeSelectionList(
    payload.cores ?? payload.coresIds ?? payload.corMaterial ?? [],
    'cor',
  )
  const corMaterial = coresSelecionadas.length
    ? coresSelecionadas.map((item) => item.nome).join('; ')
    : trim(payload.corMaterial)
  const numeroEspecifico = buildNumeroEspecifico({
    grupoMaterial: grupoMaterialNome,
    numeroCalcado,
    numeroVestimenta,
  })

  return {
    nome: materialItemNomeBase,
    nomeItemRelacionado: materialItemNomeBase,
    materialItemNome: materialItemNomeBase,
    fabricante: fabricanteIdBase,
    fabricanteNome: fabricanteNomeBase,
    validadeDias: payload.validadeDias !== undefined ? Number(payload.validadeDias) : null,
    ca: trim(payload.ca),
    valorUnitario: Number(payload.valorUnitario ?? 0),
    estoqueMinimo:
      payload.estoqueMinimo !== undefined && payload.estoqueMinimo !== null
        ? Number(payload.estoqueMinimo)
        : null,
    ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
    grupoMaterial,
    grupoMaterialNome,
    grupoMaterialId: grupoMaterialId || null,
    numeroCalcado: isGrupo(grupoMaterialNome, 'Calçado') ? numeroCalcado : '',
    numeroVestimenta: requiresTamanho(grupoMaterialNome) ? numeroVestimenta : '',
    numeroEspecifico,
    caracteristicaEpi,
    caracteristicas: caracteristicasSelecionadas,
    caracteristicasIds: caracteristicasSelecionadas.map((item) => item.id).filter(Boolean),
    corMaterial,
    cores: coresSelecionadas,
    coresIds: coresSelecionadas.map((item) => item.id).filter(Boolean),
    descricao: String(payload.descricao || '').trim(),
  }
}

const validateMaterialPayload = (payload) => {
  if (!payload.nome) throw createError(400, 'Nome do material obrigatorio.')
  if (/\d/.test(payload.nome)) {
    throw createError(400, 'O campo EPI não pode conter números.')
  }
  if (!payload.fabricante && !payload.fabricanteNome) {
    throw createError(400, 'Fabricante obrigatorio.')
  }
  if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
    throw createError(400, 'Validade deve ser maior que zero.')
  }
  if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
    throw createError(400, 'Valor unitario deve ser maior que zero.')
  }
  const grupoNome = payload.grupoMaterialNome || payload.grupoMaterial || ''
  if (!payload.grupoMaterialId && !grupoNome) {
    throw createError(400, 'Grupo de material obrigatorio.')
  }
  if (isGrupo(grupoNome, 'Calçado') && !payload.numeroCalcado) {
    throw createError(400, 'Informe o número do calçado.')
  }
  if (requiresTamanho(grupoNome) && !payload.numeroVestimenta) {
    throw createError(400, 'Informe o tamanho.')
  }
  if (
    payload.estoqueMinimo !== null &&
    (Number.isNaN(Number(payload.estoqueMinimo)) || Number(payload.estoqueMinimo) < 0)
  ) {
    throw createError(400, 'Estoque minimo deve ser zero ou positivo.')
  }
  if (!normalizeCaracteristicaLista(payload.caracteristicaEpi).length) {
    throw createError(400, 'Informe ao menos uma característica.')
  }
}

const sanitizeEntradaPayload = (payload = {}) => {
  const dataEntrada = toDateOnlyIso(payload.dataEntrada)
  return {
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    dataEntrada,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || 'sistema',
  }
}

const validateEntradaPayload = (payload) => {
  if (!payload.materialId) throw createError(400, 'Material obrigatorio.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createError(400, 'Centro de custo obrigatorio.')
  if (!payload.dataEntrada) throw createError(400, 'Data de entrada obrigatoria.')
}

const sanitizeSaidaPayload = (payload = {}) => {
  const dataEntrega = toIsoOrNull(payload.dataEntrega, false)
  return {
    pessoaId: trim(payload.pessoaId),
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    centroServico: trim(payload.centroServico),
    dataEntrega,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || 'sistema',
    status: trim(payload.status) || 'entregue',
  }
}

const validateSaidaPayload = (payload) => {
  if (!payload.pessoaId) throw createError(400, 'Pessoa obrigatoria para saida.')
  if (!payload.materialId) throw createError(400, 'Material obrigatorio para saida.')
  if (Number.isNaN(Number(payload.quantidade)) || Number(payload.quantidade) <= 0) {
    throw createError(400, 'Quantidade deve ser maior que zero.')
  }
  if (!payload.centroCusto) throw createError(400, 'Centro de custo obrigatorio.')
  if (!payload.dataEntrega) throw createError(400, 'Data de entrega obrigatoria.')
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
  const partes = Array.isArray(payload.partesLesionadas)
    ? payload.partesLesionadas.map((parte) => trim(parte)).filter(Boolean)
    : payload.parteLesionada
    ? [trim(payload.parteLesionada)]
    : []
  const lesoes = Array.isArray(payload.lesoes)
    ? payload.lesoes.map((lesao) => trim(lesao)).filter(Boolean)
    : payload.lesao
    ? [trim(payload.lesao)]
    : []
  const agentes = splitMultiValue(payload.agentes ?? payload.agente ?? '')
  const tipos = splitMultiValue(payload.tipos ?? payload.tipo ?? '')
  const hhtTexto = trim(payload.hht)
  const hhtValor = hhtTexto === '' ? null : Number(hhtTexto)
  return {
    matricula: trim(payload.matricula),
    nome: trim(payload.nome),
    cargo: trim(payload.cargo),
    data: toIsoOrNull(payload.data, false),
    tipo: tipos.join('; '),
    tipoPrincipal: tipos[0] ?? '',
    agente: agentes.join('; '),
    agentePrincipal: agentes[agentes.length - 1] ?? '',
    lesao: lesoes[0] ?? trim(payload.lesao),
    lesoes,
    parteLesionada: partes[0] ?? trim(payload.parteLesionada),
    partesLesionadas: partes,
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
    hht: hhtValor,
    cid: sanitizeOptional(payload.cid),
    cat: sanitizeOptional(payload.cat),
    observacao: sanitizeOptional(payload.observacao),
  }
}

const validateAcidentePayload = (payload) => {
  if (!payload.matricula) throw createError(400, 'Matricula obrigatoria.')
  if (!payload.nome) throw createError(400, 'Nome obrigatorio.')
  if (!payload.cargo) throw createError(400, 'Cargo obrigatorio.')
  const tiposValidados = splitMultiValue(payload.tipos ?? payload.tipo ?? payload.tipoPrincipal ?? '')
  if (!tiposValidados.length) throw createError(400, 'Tipo de acidente obrigatorio.')
  const agentesValidados = splitMultiValue(payload.agentes ?? payload.agente ?? payload.agentePrincipal ?? '')
  if (!agentesValidados.length) throw createError(400, 'Agente causador obrigatorio.')
  const lesoesValidadas = Array.isArray(payload.lesoes)
    ? payload.lesoes.map((lesao) => (lesao ? lesao.trim() : '')).filter(Boolean)
    : payload.lesao
    ? [payload.lesao.trim()]
    : []
  if (!lesoesValidadas.length) throw createError(400, 'Lesao obrigatoria.')
  const partesValidadas = Array.isArray(payload.partesLesionadas)
    ? payload.partesLesionadas.filter((parte) => parte && parte.trim())
    : payload.parteLesionada
    ? [payload.parteLesionada.trim()]
    : []
  if (!partesValidadas.length) throw createError(400, 'Parte lesionada obrigatoria.')
  if (!payload.centroServico) throw createError(400, 'Centro de servico obrigatorio.')
  if (!payload.data) throw createError(400, 'Data do acidente obrigatoria.')
  if (!Number.isInteger(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createError(400, 'Dias perdidos deve ser um inteiro zero ou positivo.')
  }
  if (!Number.isInteger(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createError(400, 'Dias debitados deve ser um inteiro zero ou positivo.')
  }
  if (payload.hht === undefined || payload.hht === null || String(payload.hht).trim() === '') {
    throw createError(400, 'HHT obrigatorio.')
  }
  if (!Number.isInteger(Number(payload.hht)) || Number(payload.hht) < 0) {
    throw createError(400, 'HHT deve ser um inteiro zero ou positivo.')
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

const materialMatchesLocalTerm = (material, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    material?.nome,
    material?.materialItemNome,
    material?.nomeItemRelacionado,
    material?.grupoMaterial,
    material?.grupoMaterialNome,
    material?.numeroCalcado,
    material?.numeroCalcadoNome,
    material?.numeroVestimenta,
    material?.numeroVestimentaNome,
    material?.numeroEspecifico,
    material?.fabricante,
    material?.fabricanteNome,
    material?.coresTexto,
    material?.caracteristicasTexto,
    material?.id,
  ]
  return campos
    .map((campo) => normalizeSearchTerm(campo))
    .some((campo) => campo && campo.includes(termoNormalizado))
}

const MATERIAL_SEARCH_MAX_RESULTS = 10

const localMaterialMatchesSearch = (material, termo) => {
  const alvo = normalizeSearchTerm(termo)
  if (!alvo) {
    return true
  }
  if (!material || typeof material !== 'object') {
    return false
  }
  const campos = [
    material.nome,
    material.nomeItemRelacionado,
    material.materialItemNome,
    material.grupoMaterial,
    material.grupoMaterialNome,
    material.numeroCalcado,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.fabricante,
    material.fabricanteNome,
    material.corMaterial,
    material.coresTexto,
    material.ca,
  ]
  return campos.some((campo) => normalizeSearchTerm(campo).includes(alvo))
}

const collectCentrosCustoOptions = (state) => {
  const nomes = new Set()
  const adicionar = (valor) => {
    const nome = trim(valor)
    if (nome) {
      nomes.add(nome)
    }
  }
  ;(state.pessoas || []).forEach((pessoa) => {
    adicionar(pessoa.centroCusto)
    adicionar(pessoa.centroServico)
    adicionar(pessoa.local)
  })
  ;(state.entradas || []).forEach((entrada) => adicionar(entrada.centroCusto))
  ;(state.saidas || []).forEach((saida) => adicionar(saida.centroCusto))
  return Array.from(nomes)
    .sort((a, b) => a.localeCompare(b))
    .map((nome) => ({
      id: nome,
      nome,
    }))
}

const collectCentrosServicoOptions = (state) => {
  const nomes = new Set()
  const adicionar = (valor) => {
    const nome = trim(valor)
    if (nome) {
      nomes.add(nome)
    }
  }
  ;(state.pessoas || []).forEach((pessoa) => {
    adicionar(pessoa.centroServico)
    adicionar(pessoa.setor)
    adicionar(pessoa.local)
  })
  ;(state.saidas || []).forEach((saida) => adicionar(saida.centroServico))
  return Array.from(nomes)
    .sort((a, b) => a.localeCompare(b))
    .map((nome, index) => mapDomainOption(nome, index))
    .filter(Boolean)
}

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
          setor: dados.setor,
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
        const camposAtuais = {
          nome: atual.nome ?? '',
          matricula: atual.matricula ?? '',
          centroServico: atual.centroServico ?? '',
          setor: atual.setor ?? '',
          cargo: atual.cargo ?? '',
          dataAdmissao: atual.dataAdmissao ?? null,
          tipoExecucao: atual.tipoExecucao ?? '',
        }
        const camposNovos = {
          nome: dados.nome ?? '',
          matricula: dados.matricula ?? '',
          centroServico: dados.centroServico ?? '',
          setor: dados.setor ?? '',
          cargo: dados.cargo ?? '',
          dataAdmissao: dados.dataAdmissao ?? null,
          tipoExecucao: dados.tipoExecucao ?? '',
        }
        const camposAlterados = buildHistoryChanges(camposAtuais, camposNovos)

        const historico = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
        const agora = nowIso()
        if (Array.isArray(camposAlterados) && camposAlterados.length > 0) {
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
          setor: dados.setor,
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
      return readState((state) => state.materiais.map((material) => mapLocalMaterialRecord(material)))
    },
    async listDetalhado() {
      return readState((state) => state.materiais.map((material) => mapLocalMaterialRecord(material)))
    },
    async search(params = {}) {
      const termo = params?.termo ?? params?.q ?? params?.query ?? ''
      const limiteSolicitado = Number(params?.limit)
      const limite =
        Number.isFinite(limiteSolicitado) && limiteSolicitado > 0
          ? Math.min(limiteSolicitado, 50)
          : MATERIAL_SEARCH_MAX_RESULTS
      const alvo = normalizeSearchTerm(termo)
      if (!alvo) {
        return []
      }
      return readState((state) => {
        const registros = state.materiais.map((material) => mapLocalMaterialRecord(material))
        return registros.filter((material) => localMaterialMatchesSearch(material, alvo)).slice(0, limite)
      })
    },
    async groups() {
      return readState((state) => {
        const mapa = new Map()
        const registrarGrupo = (nome) => {
          const texto = trim(nome)
          if (!texto) {
            return
          }
          const id = buildOptionId('grupo', texto)
          if (!mapa.has(id)) {
            mapa.set(id, { id, nome: texto })
          }
        }
        gruposEpiPadrao.forEach(registrarGrupo)
        state.materiais
          .map((material) => material.grupoMaterialNome || material.grupoMaterial || '')
          .filter(Boolean)
          .forEach((grupo) => registrarGrupo(grupo))
        return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      })
    },
    async items(grupoId) {
      const normalizedGrupoId = normalizeKeyPart(grupoId)
      if (!normalizedGrupoId) {
        return []
      }
      const normalizeGrupoKey = (nome) => normalizeKeyPart(buildOptionId('grupo', nome))
      const resolveNomeGrupo = () => {
        const candidatos = [...gruposEpiPadrao, ...Object.keys(catalogoGruposMateriais)]
        for (const candidato of candidatos) {
          if (normalizeGrupoKey(candidato) === normalizedGrupoId) {
            return trim(candidato)
          }
        }
        return ''
      }
      const grupoNomeReferencia = resolveNomeGrupo()
      const base =
        Object.prototype.hasOwnProperty.call(catalogoGruposMateriais, grupoNomeReferencia)
          ? catalogoGruposMateriais[grupoNomeReferencia]
          : []
      return readState((state) => {
        const extras = state.materiais
          .filter((material) =>
            normalizeKeyPart(material.grupoMaterialId || buildOptionId('grupo', material.grupoMaterialNome || material.grupoMaterial)) ===
              normalizedGrupoId,
          )
          .map((material) => {
            const nomeMaterial = trim(material.nome) || trim(material.materialItemNome) || ''
            return {
              id: buildGrupoItemId(
                grupoNomeReferencia || material.grupoMaterialNome || material.grupoMaterial,
                nomeMaterial,
              ),
              nome: nomeMaterial,
            }
          })
          .filter((item) => item.nome)
        const listaPadrao = normalizeCatalogoOptions(
          (base || []).map((nome) => ({
            id: buildGrupoItemId(grupoNomeReferencia || grupoId, nome),
            nome,
          })),
          'item',
        )
        const mapa = new Map(listaPadrao.map((item) => [normalizeKeyPart(item.id) || normalizeKeyPart(item.nome), item]))
        extras.forEach((item) => {
          const chave = normalizeKeyPart(item.id) || normalizeKeyPart(item.nome)
          if (!mapa.has(chave)) {
            mapa.set(chave, { id: item.id, nome: item.nome })
          }
        })
        return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      })
    },
    async fabricantes() {
      return readState((state) => {
        const mapa = new Map()
        const registrar = (nome, idBase) => {
          const texto = trim(nome)
          if (!texto) {
            return
          }
          const id = idBase || buildOptionId('fabricante', texto)
          if (!mapa.has(id)) {
            mapa.set(id, { id, nome: texto })
          }
        }
        catalogoFabricantesPadrao.forEach((nome) => registrar(nome))
        state.materiais.forEach((material) => {
          registrar(material.fabricanteNome || material.fabricante, material.fabricante)
        })
        return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      })
    },
    async caracteristicas() {
      return normalizeCatalogoOptions(catalogoCaracteristicasEpi.map((item, index) => ({
        id: item.id ?? buildOptionId('caracteristica', `${item.agente || ''}-${item.nome}`, index),
        nome: item.nome,
      })), 'caracteristica')
    },
    async cores() {
      return normalizeCatalogoOptions(
        catalogoCores.map((nome, index) => ({
          id: buildOptionId('cor', nome, index),
          nome,
        })),
        'cor',
      )
    },
    async medidasCalcado() {
      return normalizeCatalogoLista(catalogoMedidasCalcado)
    },
    async medidasVestimenta() {
      return normalizeCatalogoLista(catalogoMedidasVestimenta)
    },
    async create(payload) {
      const dados = await sanitizeMaterialPayload(payload)
      validateMaterialPayload(dados)
      const usuario = trim(payload.usuarioCadastro) || 'sistema'

      return writeState((state) => {
        const material = {
          id: randomId(),
          ...dados,
          usuarioCadastro: usuario,
          usuarioCadastroNome: trim(payload.usuarioCadastroNome) || usuario,
          usuarioAtualizacao: null,
          usuarioAtualizacaoNome: '',
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
          camposAlterados: [],
        })

        return mapLocalMaterialRecord(material)
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID do material obrigatorio.')
      }

      const atual = readState((state) => state.materiais.find((material) => material.id === id))
      if (!atual) {
        throw createError(404, 'Material nao encontrado.')
      }

      const dadosCompletos = await sanitizeMaterialPayload({ ...atual, ...payload })
      validateMaterialPayload(dadosCompletos)

      const usuario = trim(payload.usuarioResponsavel) || 'sistema'
      const agora = nowIso()
      const camposAlterados = buildHistoryChanges(
        selectMaterialHistoryFields(mapLocalMaterialRecord(atual)),
        selectMaterialHistoryFields(mapLocalMaterialRecord({ ...atual, ...dadosCompletos })),
      )

      return writeState((state) => {
        const index = state.materiais.findIndex((material) => material.id === id)
        if (index === -1) {
          throw createError(404, 'Material nao encontrado.')
        }

        const atualizado = {
          ...state.materiais[index],
          ...dadosCompletos,
          usuarioAtualizacao: usuario,
          usuarioAtualizacaoNome: trim(payload.usuarioAtualizacaoNome) || usuario,
          atualizadoEm: agora,
        }

        state.materiais[index] = atualizado

        if (Array.isArray(camposAlterados) && camposAlterados.length > 0) {
          state.materialPriceHistory.push({
            id: randomId(),
            materialId: id,
            valorUnitario: Number(dadosCompletos.valorUnitario),
            usuarioResponsavel: usuario,
            dataRegistro: agora,
            camposAlterados,
          })
        }

        return mapLocalMaterialRecord(atualizado)
      })
    },
    async get(id) {
      return readState((state) => {
        const material = state.materiais.find((item) => item.id === id) || null
        return mapLocalMaterialRecord(material)
      })
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
    async materialOptions() {
      return readState((state) => {
        const ids = new Set(
          (state.entradas || [])
            .map((entrada) => entrada.materialId)
            .filter((id) => Boolean(id))
        )
        if (ids.size === 0) {
          return []
        }
        const materiais = state.materiais
          .filter((material) => ids.has(material.id))
          .map((material) => mapLocalMaterialRecord(material))
        return materiais.sort((a, b) => {
          const nomeA = normalizeSearchTerm(a.materialItemNome || a.nome || a.nomeId || '')
          const nomeB = normalizeSearchTerm(b.materialItemNome || b.nome || b.nomeId || '')
          return nomeA.localeCompare(nomeB, 'pt-BR')
        })
      })
    },
    async searchMateriais(params = {}) {
      const termo = normalizeSearchTerm(params.termo || params.q || params.query)
      const limiteSeguro = Number.isFinite(Number(params.limit))
        ? Math.max(1, Math.min(Number(params.limit), 50))
        : 10
      return readState((state) => {
        const ids = new Set(
          (state.entradas || [])
            .map((entrada) => entrada.materialId)
            .filter((id) => Boolean(id))
        )
        if (ids.size === 0) {
          return []
        }
        const materiais = state.materiais
          .filter((material) => ids.has(material.id))
          .map((material) => mapLocalMaterialRecord(material))
        const candidatos = termo
          ? materiais.filter((material) => materialMatchesLocalTerm(material, termo))
          : materiais
        return candidatos.slice(0, limiteSeguro)
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
        const snapshot = mapLocalEntradaRecord(entrada)
        state.entradaHistorico = Array.isArray(state.entradaHistorico) ? state.entradaHistorico : []
        state.entradaHistorico.push({
          id: randomId(),
          entradaId: entrada.id,
          materialId: entrada.materialId,
          criadoEm: snapshot.dataEntrada || nowIso(),
          usuario: snapshot.usuarioResponsavel || 'sistema',
          snapshot: { atual: snapshot },
        })
        return snapshot
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID da entrada obrigatorio.')
      }
      const dados = sanitizeEntradaPayload(payload)
      validateEntradaPayload(dados)

      return writeState((state) => {
        const index = state.entradas.findIndex((entrada) => entrada.id === id)
        if (index === -1) {
          throw createError(404, 'Entrada nao encontrada.')
        }
        const material = state.materiais.find((item) => item.id === dados.materialId)
        if (!material) {
          throw createError(404, 'Material nao encontrado.')
        }
        const anterior = mapLocalEntradaRecord(state.entradas[index])
        const atualizada = {
          ...state.entradas[index],
          ...dados,
        }
        state.entradas[index] = atualizada
        const snapshotAtual = mapLocalEntradaRecord(atualizada)
        state.entradaHistorico = Array.isArray(state.entradaHistorico) ? state.entradaHistorico : []
        state.entradaHistorico.push({
          id: randomId(),
          entradaId: atualizada.id,
          materialId: atualizada.materialId,
          criadoEm: nowIso(),
          usuario: snapshotAtual.usuarioResponsavel || 'sistema',
          snapshot: { atual: snapshotAtual, anterior },
        })
        return snapshotAtual
      })
    },
    async history(id) {
      if (!id) {
        throw createError(400, 'ID da entrada obrigatorio.')
      }
      return readState((state) => {
        const historico = (state.entradaHistorico || []).filter((item) => item.entradaId === id)
        return sortByDateDesc(historico, 'criadoEm')
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

        const centroServico = dados.centroServico || pessoa.centroServico || pessoa.local || ''

        const estoqueAtual = calcularSaldoMaterial(material.id, state.entradas, state.saidas, null)
        if (Number(dados.quantidade) > estoqueAtual) {
          throw createError(400, 'Quantidade informada maior que estoque disponivel.')
        }

        const dataTroca = calcularDataTroca(dados.dataEntrega, material.validadeDias)

        const saida = {
          id: randomId(),
          ...dados,
          centroServico,
          dataTroca,
        }

        state.saidas.push(saida)
        state.saidaHistorico = Array.isArray(state.saidaHistorico) ? state.saidaHistorico : []
        state.saidaHistorico.push({
          id: randomId(),
          saidaId: saida.id,
          criadoEm: nowIso(),
          usuario: saida.usuarioResponsavel || 'sistema',
          snapshot: { atual: buildLocalSaidaSnapshot(saida, state) },
        })
        const saidaNormalizada = mapLocalSaidaRecord(saida)
        return {
          ...saidaNormalizada,
          estoqueAtual: estoqueAtual - Number(dados.quantidade),
        }
      })
    },
    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID da saída obrigatorio.')
      }
      const dados = sanitizeSaidaPayload(payload)
      validateSaidaPayload(dados)

      return writeState((state) => {
        const index = state.saidas.findIndex((item) => item.id === id)
        if (index === -1) {
          throw createError(404, 'Saída nao encontrada.')
        }
        const atual = state.saidas[index]
        const pessoa = state.pessoas.find((item) => item.id === dados.pessoaId)
        if (!pessoa) {
          throw createError(404, 'Pessoa nao encontrada.')
        }
        const material = state.materiais.find((item) => item.id === dados.materialId)
        if (!material) {
          throw createError(404, 'Material nao encontrado.')
        }

        const estoqueAtual = calcularSaldoMaterial(material.id, state.entradas, state.saidas, null)
        const quantidadeAnterior = Number(atual.quantidade ?? 0)
        const estoqueConsiderado =
          material.id === atual.materialId ? estoqueAtual + quantidadeAnterior : estoqueAtual
        if (Number(dados.quantidade) > estoqueConsiderado) {
          throw createError(400, 'Quantidade informada maior que estoque disponivel.')
        }

        const centroServico = dados.centroServico || pessoa.centroServico || pessoa.local || ''
        const dataTroca = calcularDataTroca(dados.dataEntrega, material.validadeDias)

        const snapshotAnterior = buildLocalSaidaSnapshot(atual, state)
        const atualizado = {
          ...atual,
          ...dados,
          centroServico,
          dataTroca,
        }
        state.saidas[index] = atualizado
        state.saidaHistorico = Array.isArray(state.saidaHistorico) ? state.saidaHistorico : []
        state.saidaHistorico.push({
          id: randomId(),
          saidaId: atualizado.id,
          criadoEm: nowIso(),
          usuario: atualizado.usuarioResponsavel || 'sistema',
          snapshot: {
            atual: buildLocalSaidaSnapshot(atualizado, state),
            anterior: snapshotAnterior,
          },
        })
        return mapLocalSaidaRecord(atualizado)
      })
    },
    async cancel(id, payload = {}) {
      if (!id) {
        throw createError(400, 'ID da saída obrigatorio.')
      }
      const motivo = trim(payload.motivo ?? '')
      return writeState((state) => {
        const index = state.saidas.findIndex((item) => item.id === id)
        if (index === -1) {
          throw createError(404, 'Saída nao encontrada.')
        }
        const atual = state.saidas[index]
        if ((atual.status || '').toString().toLowerCase() === 'cancelado') {
          throw createError(400, 'Saída já cancelada.')
        }
        const atualizado = {
          ...atual,
          status: STATUS_CANCELADO_NOME,
          statusId: STATUS_CANCELADO_NOME,
        }
        state.saidas[index] = atualizado
        state.saidaHistorico = Array.isArray(state.saidaHistorico) ? state.saidaHistorico : []
        state.saidaHistorico.push({
          id: randomId(),
          saidaId: atualizado.id,
          criadoEm: nowIso(),
          usuario: atualizado.usuarioResponsavel || 'sistema',
          snapshot: {
            atual: { ...buildLocalSaidaSnapshot(atualizado, state), motivoCancelamento: motivo },
            anterior: buildLocalSaidaSnapshot(atual, state),
          },
        })
        return mapLocalSaidaRecord(atualizado)
      })
    },
    async history(id) {
      if (!id) {
        throw createError(400, 'ID da saida obrigatorio.')
      }
      return readState((state) => {
        const historico = (state.saidaHistorico || []).filter((item) => item.saidaId === id)
        return sortByDateDesc(historico, 'criadoEm')
      })
    },
  },
  estoque: {
    async current(params = {}) {
      const periodo = parsePeriodo(params)
      return readState((state) => montarEstoqueAtual(state.materiais, state.entradas, state.saidas, periodo))
    },
    async saldo(materialId) {
      if (!materialId) {
        throw createError(400, 'Material obrigatorio.')
      }
      return readState((state) => ({
        materialId,
        saldo: calcularSaldoMaterial(materialId, state.entradas, state.saidas, null),
      }))
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
    async parts() {
      return readState((state) => {
        const mapa = new Map()
        catalogoAcidentePartes.forEach(({ nome, grupo, subgrupo }) => {
          const label = [grupo, subgrupo, nome].filter(Boolean).join(' / ')
          const chave = normalizeKeyPart(nome)
          if (!mapa.has(chave)) {
            mapa.set(chave, { nome, label: label || nome })
          }
        })
        const lista = Array.isArray(state.acidentes) ? state.acidentes : []
        lista.forEach((acidente) => {
          const partes = Array.isArray(acidente.partesLesionadas)
            ? acidente.partesLesionadas
            : acidente.parteLesionada
            ? [acidente.parteLesionada]
            : []
          partes.forEach((parte) => {
            const nome = String(parte || '').trim()
            if (!nome) {
              return
            }
            const chave = normalizeKeyPart(nome)
            if (!mapa.has(chave)) {
              mapa.set(chave, { nome, label: nome })
            }
          })
        })
        return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
      })
    },
    async lesions(agenteEntrada) {
      const filtro = trim(
        typeof agenteEntrada === 'object'
          ? agenteEntrada?.nome ?? agenteEntrada?.label ?? agenteEntrada?.value
          : agenteEntrada,
      )
      const filtroNormalizado = normalizeKeyPart(filtro)
      return readState((state) => {
        const mapa = new Map()
        const adicionar = (agente, nome, ordem = 1000) => {
          const chave = buildLesaoKey(agente, nome)
          if (mapa.has(chave)) {
            const existente = mapa.get(chave)
            const ordemAtual = existente.ordem ?? 1000
            const novaOrdem = ordem ?? 1000
            existente.ordem = Math.min(ordemAtual, novaOrdem)
            return
          }
          mapa.set(chave, {
            agente,
            nome,
            label: nome,
            ordem,
          })
        }

        catalogoAcidenteLesoes
          .filter((item) => !filtro || normalizeKeyPart(item.agente) === filtroNormalizado)
          .forEach((item) => adicionar(item.agente, item.nome, item.ordem ?? 1000))

        const lista = Array.isArray(state.acidentes) ? state.acidentes : []
        lista.forEach((acidente) => {
          const agentes = splitMultiValue(acidente.agentes ?? acidente.agente ?? '')
          if (!agentes.length) {
            return
          }
          agentes.forEach((agente) => {
            if (!agente) {
              return
            }
            if (filtro && normalizeKeyPart(agente) !== filtroNormalizado) {
              return
            }
            const origem =
              Array.isArray(acidente.lesoes) && acidente.lesoes.length
                ? acidente.lesoes
                : acidente.lesao
                ? [acidente.lesao]
                : []
            origem.forEach((nome) => {
              const valor = trim(nome)
              if (!valor) {
                return
              }
              adicionar(agente, valor, 1000)
            })
          })
        })

        return Array.from(mapa.values()).sort((a, b) => {
          if (!filtro && a.agente !== b.agente) {
            return a.agente.localeCompare(b.agente)
          }
          if ((a.ordem ?? 1000) !== (b.ordem ?? 1000)) {
            return (a.ordem ?? 1000) - (b.ordem ?? 1000)
          }
          return a.nome.localeCompare(b.nome)
        })
      })
    },
    async agents() {
      return readState((state) => {
        const mapa = new Map()
        Object.keys(catalogoAcidenteAgentes).forEach((nome) => {
          const chave = normalizeKeyPart(nome)
          if (!chave) {
            return
          }
          if (!mapa.has(chave)) {
            mapa.set(chave, { id: null, nome: nome.trim() })
          }
        })
        const lista = Array.isArray(state.acidentes) ? state.acidentes : []
        lista.forEach((acidente) => {
          const agentes = splitMultiValue(acidente.agentes ?? acidente.agente ?? '')
          agentes.forEach((valor) => {
            const nome = trim(valor)
            const chave = normalizeKeyPart(nome)
            if (!chave) {
              return
            }
            if (!mapa.has(chave)) {
              mapa.set(chave, { id: null, nome })
            }
          })
        })
        return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      })
    },
    async agentTypes(agenteEntrada) {
      const nome = trim(
        typeof agenteEntrada === 'object'
          ? agenteEntrada?.nome ?? agenteEntrada?.label ?? agenteEntrada?.value
          : agenteEntrada,
      )
      if (!nome) {
        return []
      }
      const base =
        catalogoAcidenteAgentes[nome] ??
        catalogoAcidenteAgentes[
          Object.keys(catalogoAcidenteAgentes).find(
            (chave) => normalizeKeyPart(chave) === normalizeKeyPart(nome),
          ) ?? ''
        ] ??
        []
      return readState((state) => {
        const extrasSet = new Set(base || [])
        const lista = Array.isArray(state.acidentes) ? state.acidentes : []
        lista.forEach((acidente) => {
          const agentes = splitMultiValue(acidente.agentes ?? acidente.agente ?? '')
          const possui = agentes.some(
            (valor) => normalizeKeyPart(valor) === normalizeKeyPart(nome),
          )
          if (!possui) {
            return
          }
          const tiposExtras = splitMultiValue(acidente.tipos ?? acidente.tipo ?? '')
          tiposExtras.forEach((tipo) => {
            if (tipo) {
              extrasSet.add(tipo)
            }
          })
        })
        return Array.from(extrasSet).sort((a, b) => a.localeCompare(b))
      })
    },
    async locals() {
      return readState((state) => {
        const set = new Set(locaisAcidentePadrao)
        const lista = Array.isArray(state.acidentes) ? state.acidentes : []
        lista.forEach((acidente) => {
          if (acidente && acidente.local) {
            const valor = String(acidente.local).trim()
            if (valor) {
              set.add(valor)
            }
          }
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
      })
    },
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
          tipos: splitMultiValue(dados.tipo),
          agente: dados.agente,
          agentes: splitMultiValue(dados.agente),
          lesao: dados.lesao,
          lesoes: dados.lesoes,
          parteLesionada: dados.parteLesionada,
          partesLesionadas: dados.partesLesionadas,
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

        dados.tipos = splitMultiValue(dados.tipo)
        dados.agentes = splitMultiValue(dados.agente)

        const centroServicoPessoa = pessoa?.centroServico || pessoa?.setor || pessoa?.local || ''
        const localPessoa = pessoa?.local || pessoa?.centroServico || ''
        dados.centroServico = dadosSanitizados.centroServico || centroServicoPessoa || atual.centroServico || atual.setor || ''
        dados.local = dadosSanitizados.local || localPessoa || atual.local || dados.centroServico
        dados.setor = dados.centroServico

        validateAcidentePayload(dados)

        const camposAntigos = ACIDENTE_HISTORY_FIELDS.reduce((acc, campo) => {
          if (campo === 'centroServico') {
            acc[campo] = atual.centroServico ?? atual.setor ?? ''
          } else if (campo === 'local') {
            acc[campo] = atual.local ?? atual.centroServico ?? ''
          } else {
            acc[campo] = atual[campo]
          }
          return acc
        }, {})
        const camposNovos = ACIDENTE_HISTORY_FIELDS.reduce((acc, campo) => {
          acc[campo] = dados[campo]
          return acc
        }, {})
        const camposAlterados = buildHistoryChanges(camposAntigos, camposNovos)

        const historicoBase = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
        const agora = nowIso()
        if (Array.isArray(camposAlterados) && camposAlterados.length > 0) {
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
  references: {
    async pessoas() {
      const snapshot = readState((state) => state.pessoas || [])
      const mapLista = (lista) =>
        (Array.isArray(lista) ? lista : [])
          .map((valor, index) => mapDomainOption(valor, index))
          .filter(Boolean)
      return {
        centrosServico: mapLista(extractCentrosServico(snapshot)),
        setores: mapLista(extractSetores(snapshot)),
        cargos: mapLista(extractCargos(snapshot)),
        tiposExecucao: mapLista(extractTiposExecucao(snapshot)),
      }
    },
  },
  documentos: {
    async termoEpiContext(params = {}) {
      return obterContextoTermoEpiLocal(params)
    },
  },
  centrosCusto: {
    async list() {
      return readState((state) => collectCentrosCustoOptions(state))
    },
  },
  centrosEstoque: {
    async list() {
      return readState((state) => collectCentrosCustoOptions(state))
    },
  },
  centrosServico: {
    async list() {
      return readState((state) => collectCentrosServicoOptions(state))
    },
  },
}

export { localApi }




