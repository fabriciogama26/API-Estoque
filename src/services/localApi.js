import { readState, writeState } from './localDataStore.js'
import {
  montarEstoqueAtual,
  montarDashboard,
  parsePeriodo,
  resolvePeriodoSaldo,
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
} from '../routes/rules/PessoasRules.js'
import { logError } from './errorLogService.js'

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

const toBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const texto = value.trim().toLowerCase()
    if (['true', '1', 'sim', 'yes', 'on'].includes(texto)) {
      return true
    }
    if (['false', '0', 'nao', 'não', 'off'].includes(texto)) {
      return false
    }
  }
  return Boolean(value)
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

const pad2 = (value) => String(value).padStart(2, '0')

const toMonthRefIso = (value) => {
  const raw = trim(value)
  if (!raw) {
    return null
  }
  const datePart = raw.split('T')[0]
  const monthPrefix = /^\d{4}-\d{2}$/.test(raw) ? raw : /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart.slice(0, 7) : null
  if (monthPrefix) {
    return `${monthPrefix}-01`
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}-${pad2(month)}-01`
}

const toEndOfDayIso = (value) => {
  const startIso = toDateOnlyIso(value)
  if (!startIso) {
    return null
  }
  const date = new Date(startIso)
  date.setUTCHours(23, 59, 59, 999)
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
  const setor = trim(payload.setor ?? centroServico)
  return {
    nome: trim(payload.nome),
    matricula: trim(payload.matricula),
    cargo: trim(payload.cargo),
    centroServico,
    setor,
    dataAdmissao: toLocalDateIso(payload.dataAdmissao),
    tipoExecucao: trim(payload.tipoExecucao),
    ativo: toBoolean(payload.ativo ?? true),
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

const BASIC_REGISTRATION_TABLE_CONFIG = {
  fabricantes: { nameColumn: 'fabricante', order: ['fabricante'] },
  cargos: { nameColumn: 'nome', order: ['nome'] },
  centros_custo: { nameColumn: 'nome', order: ['nome'] },
  centros_servico: { nameColumn: 'nome', order: ['nome'] },
  centros_estoque: { nameColumn: 'almox', order: ['almox'] },
  setores: { nameColumn: 'nome', order: ['nome'] },
}

const resolveBasicRegistrationConfig = (table) => {
  const key = trim(table).toLowerCase()
  const config = BASIC_REGISTRATION_TABLE_CONFIG[key]
  if (!config) {
    throw createError(400, 'Tabela de cadastro base invalida.')
  }
  return { key, config }
}

const mapBasicRegistrationLocalRecord = (table, record) => {
  if (!record || typeof record !== 'object') {
    return record
  }
  const { config } = resolveBasicRegistrationConfig(table)
  const nome = trim(record?.[config.nameColumn])
  const createdAt = record?.created_at ?? record?.criado_em ?? null
  const updatedAt = record?.updated_at ?? null
  return {
    id: record?.id ?? null,
    nome,
    ativo: record?.ativo !== false,
    createdAt,
    updatedAt,
    createdByUserId: record?.created_by_user_id ?? null,
    createdByUserName: trim(record?.created_by_user_name ?? ''),
    updatedByUserId: record?.updated_by_user_id ?? null,
    centroCustoId: record?.centro_custo_id ?? record?.centro_custo ?? null,
    centroServicoId: record?.centro_servico_id ?? null,
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
    ativo: pessoa.ativo !== false,
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
    status: entrada.status ?? 'registrado',
    statusId: UUID_REGEX.test(entrada.status ?? '') ? entrada.status : null,
    statusNome: entrada.status ?? 'registrado',
    atualizadoEm: entrada.atualizadoEm ?? null,
    usuarioEdicao: entrada.usuarioEdicao ?? '',
    usuarioEdicaoId: entrada.usuarioEdicaoId ?? null,
    usuarioEdicaoNome: entrada.usuarioEdicao ?? '',
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
  'dataEsocial',
  'sesmt',
  'dataSesmt',
  'tipo',
  'agente',
  'lesoes',
  'partesLesionadas',
  'centroServico',
  'local',
  'diasPerdidos',
  'diasDebitados',
  'cid',
  'cat',
  'observacao',
  'ativo',
  'cancelMotivo',
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
            logError({
              message: 'Falha ao serializar valor de historico (local).',
              page: 'local_api',
              severity: 'warn',
              context: { errorMessage: error?.message },
              stack: error?.stack,
            }).catch(() => {})
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
      logError({
        message: 'Falha ao serializar valor de historico (local).',
        page: 'local_api',
        severity: 'warn',
        context: { errorMessage: error?.message },
        stack: error?.stack,
      }).catch(() => {})
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
  const tiposIds = Array.isArray(acidente.tiposIds) && acidente.tiposIds.length ? acidente.tiposIds : tiposLista
  const lesoesIds = Array.isArray(acidente.lesoesIds) && acidente.lesoesIds.length ? acidente.lesoesIds : lesoes
  const partesIds = Array.isArray(acidente.partesIds) && acidente.partesIds.length ? acidente.partesIds : partes
  const agenteId = acidente.agenteId ?? agentesLista[agentesLista.length - 1] ?? null
  const classificacoesBase = Array.isArray(acidente.classificacoesAgentes)
    ? acidente.classificacoesAgentes.filter(Boolean)
    : []
  const classificacoesAgentes = classificacoesBase.length
    ? classificacoesBase
    : (() => {
        if (!agenteId && !agentesLista.length) {
          return []
        }
        const total = Math.max(tiposIds.length, lesoesIds.length, 1)
        const agenteNome = agentesLista[agentesLista.length - 1] ?? ''
        return Array.from({ length: total }, (_, index) => ({
          agenteId: agenteId ?? null,
          agenteNome,
          tipoId: tiposIds[index] ?? null,
          tipoNome: tiposLista[index] ?? '',
          lesaoId: lesoesIds[index] ?? null,
          lesaoNome: lesoes[index] ?? '',
        }))
      })()
  const centroServicoId = acidente.centroServicoId ?? centroServico
  const localId = acidente.localId ?? acidente.local ?? centroServico
  const pessoaId = acidente.pessoaId ?? acidente.peopleId ?? null
  return {
    ...acidente,
    ativo: acidente.ativo !== false,
    centroServico,
    setor: acidente.setor ?? centroServico,
    local: acidente.local ?? centroServico,
    agente: agentesLista.join('; '),
    agentes: agentesLista,
    agenteId,
    agentesIds: Array.isArray(acidente.agentesIds) ? acidente.agentesIds : classificacoesAgentes.map((item) => item.agenteId),
    tipo: tiposLista.join('; '),
    tipos: tiposLista,
    tiposIds,
    lesoes,
    lesoesIds,
    lesao: lesoes[0] ?? acidente.lesao ?? '',
    partesLesionadas: partes,
    partesIds,
    parteLesionada: partes[0] ?? acidente.parteLesionada ?? '',
    classificacoesAgentes,
    dataEsocial: acidente.dataEsocial ?? acidente.data_esocial ?? null,
    sesmt: Boolean(acidente.sesmt),
    dataSesmt: acidente.dataSesmt ?? acidente.data_sesmt ?? null,
    ativo: acidente.ativo !== false,
    cancelMotivo: acidente.cancelMotivo ?? acidente.cancel_motivo ?? null,
    pessoaId,
    centroServicoId,
    localId,
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
    usuarioCadastroUsername: material.usuarioCadastroUsername ?? material.usuarioCadastro ?? '',
    usuarioCadastroNome: material.usuarioCadastroNome ?? '',
    usuarioAtualizacaoUsername: material.usuarioAtualizacaoUsername ?? material.usuarioAtualizacao ?? '',
    usuarioAtualizacaoNome: material.usuarioAtualizacaoNome ?? '',
    registradoPor:
      material.usuarioCadastroUsername ??
      material.usuarioCadastroNome ??
      material.usuarioCadastro ??
      '',
  }
}

const resolveEmpresaInfoLocal = () => ({
  nome: import.meta.env.VITE_TERMO_EPI_EMPRESA_NOME || '',
  documento: import.meta.env.VITE_TERMO_EPI_EMPRESA_DOCUMENTO || '',
  endereco: import.meta.env.VITE_TERMO_EPI_EMPRESA_ENDERECO || '',
  contato: import.meta.env.VITE_TERMO_EPI_EMPRESA_CONTATO || '',
  logoUrl: trim(import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_URL) || '/logo_FAA.png',
  logoSecundarioUrl: trim(import.meta.env.VITE_TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL) || '',
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
  const dataInicioIso = toDateOnlyIso(params.dataInicio)
  const dataFimIso = toEndOfDayIso(params.dataFim)
  const inicioTimestamp = dataInicioIso ? new Date(dataInicioIso).getTime() : null
  const fimTimestamp = dataFimIso ? new Date(dataFimIso).getTime() : null

  if (params.dataInicio && !dataInicioIso) {
    throw createError(400, 'Data inicial invalida.')
  }
  if (params.dataFim && !dataFimIso) {
    throw createError(400, 'Data final invalida.')
  }
  if (inicioTimestamp !== null && fimTimestamp !== null && inicioTimestamp > fimTimestamp) {
    throw createError(400, 'Data inicial nao pode ser maior que a data final.')
  }

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

    const saidasPessoa = state.saidas
      .filter((saida) => saida.pessoaId === pessoa.id)
      .map(mapLocalSaidaRecord)
      .filter((saida) => {
        if (inicioTimestamp === null && fimTimestamp === null) {
          return true
        }
        const entregaTime = saida.dataEntrega ? new Date(saida.dataEntrega).getTime() : null
        if (entregaTime === null || Number.isNaN(entregaTime)) {
          return false
        }
        if (inicioTimestamp !== null && entregaTime < inicioTimestamp) {
          return false
        }
        if (fimTimestamp !== null && entregaTime > fimTimestamp) {
          return false
        }
        return true
      })
    if (!saidasPessoa.length) {
      const hasPeriodo = inicioTimestamp !== null || fimTimestamp !== null
      const mensagem = hasPeriodo
        ? 'Nenhuma saida registrada para o colaborador informado no periodo selecionado.'
        : 'Nenhuma saida registrada para o colaborador informado.'
      throw createError(404, mensagem)
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
  const statusRaw = payload.status
  const statusValue =
    statusRaw === undefined ? undefined : trim(statusRaw) || 'registrado'
  return {
    materialId: trim(payload.materialId),
    quantidade: Number(payload.quantidade ?? 0),
    centroCusto: trim(payload.centroCusto),
    dataEntrada,
    usuarioResponsavel: trim(payload.usuarioResponsavel) || 'sistema',
    status: statusValue,
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
  const lesoesDiretas = Array.isArray(payload.lesoes)
    ? payload.lesoes.map((lesao) => trim(lesao)).filter(Boolean)
    : payload.lesao
    ? [trim(payload.lesao)]
    : []
  const classificacoes = Array.isArray(payload.classificacoesAgentes) ? payload.classificacoesAgentes : []
  const agentesIdsClass = []
  const tiposIdsClass = []
  const lesoesIdsClass = []
  const agentesNomesClass = []
  const tiposNomesClass = []
  const lesoesNomesClass = []
  const agentesSet = new Set()
  const tiposSet = new Set()
  const lesoesSet = new Set()

  classificacoes.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }
    const agenteId = trim(item.agenteId ?? item.agente_id)
    const agenteNome = trim(item.agenteNome ?? item.agente_nome ?? item.agente ?? '')
    if (!agenteId && !agenteNome) {
      return
    }
    agentesIdsClass.push(agenteId || null)
    tiposIdsClass.push(trim(item.tipoId ?? item.tipo_id) || null)
    lesoesIdsClass.push(trim(item.lesaoId ?? item.lesao_id) || null)

    if (agenteNome) {
      const chave = agenteNome.toLowerCase()
      if (!agentesSet.has(chave)) {
        agentesSet.add(chave)
        agentesNomesClass.push(agenteNome)
      }
    }
    const tipoNome = trim(item.tipoNome ?? item.tipo_nome ?? item.tipo ?? '')
    if (tipoNome) {
      const chave = tipoNome.toLowerCase()
      if (!tiposSet.has(chave)) {
        tiposSet.add(chave)
        tiposNomesClass.push(tipoNome)
      }
    }
    const lesaoNome = trim(item.lesaoNome ?? item.lesao_nome ?? item.lesao ?? '')
    if (lesaoNome) {
      const chave = lesaoNome.toLowerCase()
      if (!lesoesSet.has(chave)) {
        lesoesSet.add(chave)
        lesoesNomesClass.push(lesaoNome)
      }
    }
  })

  const agentes = agentesNomesClass.length ? agentesNomesClass : splitMultiValue(payload.agentes ?? payload.agente ?? '')
  const tipos = tiposNomesClass.length ? tiposNomesClass : splitMultiValue(payload.tipos ?? payload.tipo ?? '')
  const lesoes = lesoesNomesClass.length ? lesoesNomesClass : lesoesDiretas

  let tiposIds = tiposIdsClass.length
    ? tiposIdsClass
    : Array.isArray(payload.tiposIds ?? payload.tipos_ids)
    ? (payload.tiposIds ?? payload.tipos_ids).map((item) => trim(item)).filter(Boolean)
    : []
  let lesoesIds = lesoesIdsClass.length
    ? lesoesIdsClass
    : Array.isArray(payload.lesoesIds ?? payload.lesoes_ids)
    ? (payload.lesoesIds ?? payload.lesoes_ids).map((item) => trim(item)).filter(Boolean)
    : []
  let partesIds = Array.isArray(payload.partesIds ?? payload.partes_ids)
    ? (payload.partesIds ?? payload.partes_ids).map((item) => trim(item)).filter(Boolean)
    : []
  if (!tiposIds.length) {
    tiposIds = tipos
  }
  if (!lesoesIds.length) {
    lesoesIds = lesoes
  }
  if (!partesIds.length) {
    partesIds = partes
  }
  const agenteId =
    trim(payload.agenteId ?? payload.agente_id) ||
    agentesIdsClass.find(Boolean) ||
    agentes[agentes.length - 1] ||
    ''
  const agentesIds = agentesIdsClass.length ? agentesIdsClass : agenteId ? [agenteId] : []
  const pessoaId = trim(payload.pessoaId ?? payload.peopleId ?? payload.pessoa_id ?? payload.people_id ?? '')
  const centroServicoId = trim(
    payload.centroServicoId ?? payload.centro_servico_id ?? payload.centroServico_id ?? centroServico
  )
  const localId = trim(payload.localId ?? payload.local_id ?? local ?? centroServico)
  return {
    pessoaId: pessoaId || null,
    agenteId: agenteId || null,
    agentesIds,
    centroServicoId: centroServicoId || null,
    localId: localId || null,
    tiposIds,
    lesoesIds,
    partesIds,
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
    cid: sanitizeOptional(payload.cid),
    cat: sanitizeOptional(payload.cat),
    observacao: sanitizeOptional(payload.observacao),
    dataEsocial: toIsoOrNull(payload.dataEsocial, false),
    sesmt: toBoolean(payload.sesmt),
    dataSesmt: toIsoOrNull(payload.dataSesmt, false),
    cancelMotivo: sanitizeOptional(payload.cancelMotivo ?? payload.motivo),
    classificacoesAgentes: classificacoes,
  }
}

const validateAcidentePayload = (payload) => {
  if (!payload.matricula) throw createError(400, 'Matricula obrigatoria.')
  if (!payload.nome) throw createError(400, 'Nome obrigatorio.')
  if (!payload.cargo) throw createError(400, 'Cargo obrigatorio.')
  const classificacoes = Array.isArray(payload.classificacoesAgentes) ? payload.classificacoesAgentes : []
  if (classificacoes.length) {
    const agentesValidos = classificacoes.filter((item) =>
      trim(item?.agenteId ?? item?.agente_id ?? item?.agente)
    )
    if (!agentesValidos.length) throw createError(400, 'Agente causador obrigatorio.')
    const temTipoOuLesao = agentesValidos.some((item) => {
      const tipo = trim(item?.tipoId ?? item?.tipo_id ?? item?.tipo)
      const lesao = trim(item?.lesaoId ?? item?.lesao_id ?? item?.lesao)
      return Boolean(tipo || lesao)
    })
    if (!temTipoOuLesao) throw createError(400, 'Tipo ou lesao obrigatorio.')
  } else {
    const tiposValidados = splitMultiValue(
      payload.tiposIds ?? payload.tipos_ids ?? payload.tipos ?? payload.tipo ?? payload.tipoPrincipal ?? ''
    )
    if (!tiposValidados.length) throw createError(400, 'Tipo de acidente obrigatorio.')
    const agentesValidados = splitMultiValue(
      payload.agenteId ?? payload.agente_id ?? payload.agentes ?? payload.agente ?? payload.agentePrincipal ?? ''
    )
    if (!agentesValidados.length) throw createError(400, 'Agente causador obrigatorio.')
    const lesoesValidadas = Array.isArray(payload.lesoesIds ?? payload.lesoes_ids)
      ? (payload.lesoesIds ?? payload.lesoes_ids).map((lesao) => (lesao ? lesao.trim() : '')).filter(Boolean)
      : Array.isArray(payload.lesoes)
      ? payload.lesoes.map((lesao) => (lesao ? lesao.trim() : '')).filter(Boolean)
      : payload.lesao
      ? [payload.lesao.trim()]
      : []
    if (!lesoesValidadas.length) throw createError(400, 'Lesao obrigatoria.')
  }
  const partesValidadas = Array.isArray(payload.partesIds ?? payload.partes_ids)
    ? (payload.partesIds ?? payload.partes_ids).map((parte) => (parte ? parte.trim() : '')).filter(Boolean)
    : Array.isArray(payload.partesLesionadas)
    ? payload.partesLesionadas.filter((parte) => parte && parte.trim())
    : payload.parteLesionada
    ? [payload.parteLesionada.trim()]
    : []
  if (!partesValidadas.length) throw createError(400, 'Parte lesionada obrigatoria.')
  if (!payload.centroServico && !payload.centroServicoId) {
    throw createError(400, 'Centro de servico obrigatorio.')
  }
  if (!payload.data) throw createError(400, 'Data do acidente obrigatoria.')
  if (!Number.isInteger(Number(payload.diasPerdidos)) || Number(payload.diasPerdidos) < 0) {
    throw createError(400, 'Dias perdidos deve ser um inteiro zero ou positivo.')
  }
  if (!Number.isInteger(Number(payload.diasDebitados)) || Number(payload.diasDebitados) < 0) {
    throw createError(400, 'Dias debitados deve ser um inteiro zero ou positivo.')
  }
  if (payload.cat && !/^\d+$/.test(String(payload.cat))) {
    throw createError(400, 'CAT deve conter apenas numeros inteiros.')
  }
}

const applyHhtToLocalAcidentes = (state, mesRef, centroServicoId, centroServicoNome, hhtValor) => {
  const valor = Number(hhtValor)
  if (!Number.isFinite(valor) || valor < 0) {
    return
  }
  const mes = toMonthRefIso(mesRef)
  if (!mes) {
    return
  }
  const centroKey = normalizeKeyPart(centroServicoId || centroServicoNome || '')
  if (!centroKey || !Array.isArray(state.acidentes)) {
    return
  }
  state.acidentes.forEach((acidente, index) => {
    const mesAcidente = toMonthRefIso(
      acidente?.data ?? acidente?.dataOcorrencia ?? acidente?.data_ocorrencia ?? '',
    )
    if (mesAcidente !== mes) {
      return
    }
    const centroAcidente = normalizeKeyPart(
      acidente?.centroServico ?? acidente?.setor ?? acidente?.local ?? acidente?.centro_servico ?? '',
    )
    if (!centroAcidente || centroAcidente !== centroKey) {
      return
    }
    const hhtAtual = Number(acidente?.hht)
    if (Number.isFinite(hhtAtual) && hhtAtual > 0) {
      return
    }
    state.acidentes[index] = { ...acidente, hht: valor }
  })
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
  const status = normalizeSearchTerm(params.status)
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

    if (status) {
      const statusEntrada = normalizeSearchTerm(entrada.status)
      if (statusEntrada !== status) {
        return false
      }
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
      entrada.materialId || '',
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
  const registradoPorRaw = trim(params.registradoPor)
  const registradoPor = normalizeSearchTerm(registradoPorRaw)
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

    if (registradoPor) {
      const usuarioId = trim(saida.usuarioResponsavelId || '')
      if (usuarioId) {
        if (usuarioId !== registradoPorRaw) {
          return false
        }
      } else {
        const usuarioNome = normalizeSearchTerm(saida.usuarioResponsavelNome ?? saida.usuarioResponsavel ?? '')
        if (!usuarioNome.includes(registradoPor)) {
          return false
        }
      }
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
      saida.materialId || '',
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
            status: params.status ?? 'todos',
            cadastradoInicio: params.cadastradoInicio ?? '',
            cadastradoFim: params.cadastradoFim ?? '',
          }
          return filterPessoas(pessoas, filters)
        })
      },
      async listByIds(ids = []) {
        const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)))
        if (!uniqueIds.length) {
          return []
        }
        return readState((state) =>
          state.pessoas
            .filter((pessoa) => uniqueIds.includes(pessoa.id))
            .map(mapLocalPessoaRecord)
        )
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
          ativo: dados.ativo !== false,
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
          ativo: atual.ativo !== false ? 'Ativo' : 'Inativo',
        }
        const camposNovos = {
          nome: dados.nome ?? '',
          matricula: dados.matricula ?? '',
          centroServico: dados.centroServico ?? '',
          setor: dados.setor ?? '',
          cargo: dados.cargo ?? '',
          dataAdmissao: dados.dataAdmissao ?? null,
          tipoExecucao: dados.tipoExecucao ?? '',
          ativo: dados.ativo !== false ? 'Ativo' : 'Inativo',
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
          ativo: dados.ativo !== false,
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
  statusEntrada: {
    async list() {
      return [
        { id: '82f86834-5b97-4bf0-9801-1372b6d1bd37', status: 'REGISTRADO', nome: 'REGISTRADO', ativo: true },
        { id: 'c5f5d4e8-8c1f-4c8d-bf52-918c0b9fbde3', status: 'CANCELADO', nome: 'CANCELADO', ativo: true },
      ]
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
        status: dados.status || 'registrado',
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
          status: dados.status ?? state.entradas[index].status ?? 'registrado',
          atualizadoEm: nowIso(),
          usuarioEdicao: dados.usuarioResponsavel || state.entradas[index].usuarioResponsavel || 'sistema',
          usuarioEdicaoId:
            typeof dados.usuarioResponsavel === 'string' && UUID_REGEX.test(dados.usuarioResponsavel.trim())
              ? dados.usuarioResponsavel.trim()
              : state.entradas[index].usuarioResponsavelId || null,
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
    async cancel(id, motivo) {
      if (!id) {
        throw createError(400, 'ID da entrada obrigatorio.')
      }
      return writeState((state) => {
        const index = state.entradas.findIndex((item) => item.id === id)
        if (index === -1) {
          throw createError(404, 'Entrada nao encontrada.')
        }
        const anterior = mapLocalEntradaRecord(state.entradas[index])
        const atualizado = {
          ...state.entradas[index],
          status: 'cancelado',
          usuarioResponsavel: anterior.usuarioResponsavel || 'sistema',
          usuarioEdicao: anterior.usuarioResponsavel || 'sistema',
          usuarioEdicaoId: anterior.usuarioResponsavelId || null,
          atualizadoEm: nowIso(),
        }
        state.entradas[index] = atualizado
        const snapshotAtual = mapLocalEntradaRecord(atualizado)
        state.entradaHistorico = Array.isArray(state.entradaHistorico) ? state.entradaHistorico : []
        state.entradaHistorico.push({
          id: randomId(),
          entradaId: atualizado.id,
          materialId: atualizado.materialId,
          criadoEm: nowIso(),
          usuario: snapshotAtual.usuarioResponsavel || 'sistema',
          snapshot: { atual: snapshotAtual, anterior },
          motivoCancelamento: trim(motivo) || null,
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
      const usarMovimentacao =
        params?.movimentacaoPeriodo === true ||
        params?.movimentacaoPeriodo === 'true' ||
        params?.modo === 'periodo'
      const periodo = usarMovimentacao ? parsePeriodo(params) : null
      return readState((state) => {
        const pessoasMap = new Map((state.pessoas ?? []).map((pessoa) => [pessoa.id, mapLocalPessoaRecord(pessoa)]))
        const saidasEnriquecidas = (state.saidas ?? []).map((saida) => {
          const pessoa = pessoasMap.get(saida.pessoaId)
          return {
            ...saida,
            pessoa,
            pessoaNome: saida.pessoaNome ?? pessoa?.nome ?? '',
            pessoaMatricula: saida.pessoaMatricula ?? pessoa?.matricula ?? '',
          }
        })
        return montarEstoqueAtual(state.materiais, state.entradas, saidasEnriquecidas, periodo, {
          includeAll: false,
        })
      })
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
    async report(params = {}) {
      const inicio = String(params.periodoInicio || '').trim()
      const fim = String(params.periodoFim || '').trim()
      if (!inicio || !fim) {
        throw createError(400, 'Periodo inicial e final sao obrigatorios.')
      }
      const [inicioAno, inicioMes] = inicio.split('-').map(Number)
      const [fimAno, fimMes] = fim.split('-').map(Number)
      const diffMeses = (fimAno - inicioAno) * 12 + (fimMes - inicioMes) + 1
      let tipo = ''
      if (diffMeses === 1) tipo = 'mensal'
      else throw createError(400, 'Periodo precisa ser mensal.')

      return { tipo, origem: 'local' }
    },
    async reportHistory() {
      return { items: [] }
    },
    async reportPdf(params = {}) {
      const reportId = String(params.reportId || params.id || '').trim()
      if (!reportId) {
        throw createError(400, 'ID do relatorio obrigatorio.')
      }
      return {
        reportId,
        html: '<!DOCTYPE html><html><body><p>Relatorio indisponivel no modo local.</p></body></html>',
      }
    },
    async forecast(params = {}) {
      const fatorInput = params?.fator_tendencia ?? params?.fatorTendencia ?? params?.fator
      return readState((state) => {
        const hoje = new Date()
        const lastMonth = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0))
        const baseFim = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 0))
        const baseInicio = new Date(Date.UTC(baseFim.getUTCFullYear(), baseFim.getUTCMonth() - 11, 1))
        const anteriorFim = new Date(Date.UTC(baseInicio.getUTCFullYear(), baseInicio.getUTCMonth(), 0))
        const anteriorInicio = new Date(Date.UTC(anteriorFim.getUTCFullYear(), anteriorFim.getUTCMonth() - 11, 1))

        const materiaisMap = new Map((state.materiais ?? []).map((material) => [material.id, material]))
        const totals = new Map()
        ;(state.saidas ?? []).forEach((saida) => {
          if (!saida?.dataEntrega) return
          const status = (saida.statusNome || saida.status || '').toString().trim().toLowerCase()
          if (status === 'cancelado') return
          const data = new Date(saida.dataEntrega)
          if (Number.isNaN(data.getTime())) return
          const key = `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
          const material = materiaisMap.get(saida.materialId) || null
          const valorUnitario = Number(material?.valorUnitario ?? 0)
          const quantidade = Number(saida.quantidade ?? 0)
          totals.set(key, (totals.get(key) || 0) + valorUnitario * quantidade)
        })

        const buildSeries = (start, end) => {
          const series = []
          let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
          const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
          while (cursor <= limit) {
            const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
            series.push({
              mes: key,
              label: `${String(cursor.getUTCMonth() + 1).padStart(2, '0')}/${cursor.getUTCFullYear()}`,
              valor: Number((totals.get(key) || 0).toFixed(2)),
            })
            cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
          }
          return series
        }

        const baseSerie = buildSeries(baseInicio, baseFim)
        const anteriorSerie = buildSeries(anteriorInicio, anteriorFim)
        const mesesComDados = baseSerie.filter((item) => item.valor > 0).length
        if (mesesComDados < 12) {
          return {
            status: 'insufficient',
            requiredMonths: 12,
            monthsAvailable: mesesComDados,
            periodo_base_inicio: baseInicio.toISOString().split('T')[0],
            periodo_base_fim: baseFim.toISOString().split('T')[0],
          }
        }

        const gastoTotalPeriodo = baseSerie.reduce((acc, item) => acc + item.valor, 0)
        const mediaMensal = gastoTotalPeriodo / 12
        const gastoAnoAnterior = anteriorSerie.reduce((acc, item) => acc + item.valor, 0)
        const variacaoPercentual =
          gastoAnoAnterior > 0 ? Number((((gastoTotalPeriodo - gastoAnoAnterior) / gastoAnoAnterior) * 100).toFixed(2)) : null

        const ultimos3 = baseSerie.slice(-3).map((item) => item.valor)
        const anteriores3 = baseSerie.slice(-6, -3).map((item) => item.valor)
        const mediaUltimos3 = ultimos3.length ? ultimos3.reduce((acc, val) => acc + val, 0) / ultimos3.length : 0
        const mediaAnteriores3 = anteriores3.length
          ? anteriores3.reduce((acc, val) => acc + val, 0) / anteriores3.length
          : 0
        const tendenciaDelta =
          mediaAnteriores3 > 0 ? (mediaUltimos3 - mediaAnteriores3) / mediaAnteriores3 : 0
        let tipoTendencia = 'estavel'
        if (tendenciaDelta > 0.05) tipoTendencia = 'subida'
        else if (tendenciaDelta < -0.05) tipoTendencia = 'queda'

        const fatorAuto = tipoTendencia === 'subida' ? 1.05 : tipoTendencia === 'queda' ? 0.95 : 1
        const fatorNumeric = Number(fatorInput)
        const fatorTendencia = Number.isFinite(fatorNumeric) && fatorNumeric > 0 ? fatorNumeric : fatorAuto

        const previsaoAnual = mediaMensal * 12 * fatorTendencia
        const previsaoInicio = new Date(Date.UTC(baseFim.getUTCFullYear(), baseFim.getUTCMonth() + 1, 1))
        const previsaoFim = new Date(Date.UTC(previsaoInicio.getUTCFullYear(), previsaoInicio.getUTCMonth() + 11, 1))
        const previsaoSerie = buildSeries(previsaoInicio, previsaoFim).map((item) => ({
          ...item,
          valor: Number((mediaMensal * fatorTendencia).toFixed(2)),
        }))

        return {
          status: 'ok',
          resumo: {
            periodo_base_inicio: baseInicio.toISOString().split('T')[0],
            periodo_base_fim: baseFim.toISOString().split('T')[0],
            qtd_meses_base: 12,
            gasto_total_periodo: Number(gastoTotalPeriodo.toFixed(2)),
            media_mensal: Number(mediaMensal.toFixed(2)),
            fator_tendencia: Number(fatorTendencia.toFixed(4)),
            tipo_tendencia: tipoTendencia,
            variacao_percentual: variacaoPercentual,
            previsao_anual: Number(previsaoAnual.toFixed(2)),
            gasto_ano_anterior: gastoAnoAnterior > 0 ? Number(gastoAnoAnterior.toFixed(2)) : null,
            metodo_previsao: fatorTendencia !== 1 ? 'ajustada' : 'media_simples',
            nivel_confianca: gastoAnoAnterior > 0 ? 'alto' : 'medio',
            created_at: nowIso(),
          },
          historico: baseSerie.map((item, index) => {
            const slice = baseSerie.slice(Math.max(0, index - 2), index + 1)
            const media = slice.reduce((acc, current) => acc + current.valor, 0) / slice.length
            return {
              ano_mes: item.mes,
              label: item.label,
              valor_saida: item.valor,
              valor_entrada: 0,
              media_movel: Number(media.toFixed(2)),
            }
          }),
          previsao: previsaoSerie.map((item) => ({
            ano_mes: item.mes,
            label: item.label,
            valor_previsto: item.valor,
            metodo: fatorTendencia !== 1 ? 'ajustada' : 'media_simples',
            cenario: 'base',
          })),
        }
      })
    },
    async forecastUpdate(params = {}) {
      return this.forecast(params)
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
            mapa.set(chave, { id: nome, nome, label: label || nome })
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
              mapa.set(chave, { id: nome, nome, label: nome })
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
            id: chave,
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
            const nomeTrim = nome.trim()
            mapa.set(chave, { id: nomeTrim || null, nome: nomeTrim, label: nomeTrim })
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
              mapa.set(chave, { id: nome || null, nome, label: nome })
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
        const extrasSet = new Set()
        ;(base || []).forEach((tipo) => {
          if (tipo) {
            extrasSet.add(tipo)
          }
        })
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
        return Array.from(extrasSet)
          .sort((a, b) => a.localeCompare(b))
          .map((tipo) => ({
            id: tipo,
            nome: tipo,
            agente: nome,
            label: tipo,
          }))
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
        return Array.from(set)
          .sort((a, b) => a.localeCompare(b))
          .map((nome) => ({ id: nome, nome, label: nome }))
      })
    },
    async list() {
      return readState((state) =>
        sortByDateDesc(
          (state.acidentes || []).map(mapLocalAcidenteRecord),
          'data'
        )
      )
    },
    async dashboard(params = {}) {
      return readState((state) =>
        montarDashboardAcidentes(
          state.acidentes.map(mapLocalAcidenteRecord),
          params,
          Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        )
      )
    },
    async create(payload) {
      const dados = sanitizeAcidentePayload(payload)
      validateAcidentePayload(dados)
      const usuario = trim(payload.usuarioResponsavel) || 'sistema'

      return writeState((state) => {
        const pessoa = dados.pessoaId
          ? state.pessoas.find((item) => item.id === dados.pessoaId)
          : state.pessoas.find(
              (item) => item.matricula && item.matricula.toLowerCase() === dados.matricula.toLowerCase()
            )
        if (!pessoa) {
          throw createError(404, 'Pessoa nao encontrada para a matricula informada.')
        }

        const pessoaId = dados.pessoaId || pessoa?.id || null
        const centroServicoBase = dados.centroServico || pessoa?.centroServico || pessoa?.setor || pessoa?.local || ''
        const localBase = dados.local || pessoa?.local || pessoa?.centroServico || ''
        const centroServicoId = dados.centroServicoId || centroServicoBase || null
        const localId = dados.localId || localBase || null
        const mesRef = toMonthRefIso(dados.data)
        if (!mesRef) {
          throw createError(400, 'Data do acidente invalida para HHT mensal.')
        }

        const hhtMensalLista = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        const centroKey = normalizeKeyPart(centroServicoBase)
        const registroHht = hhtMensalLista.find((item) => {
          if (!item || item.mesRef !== mesRef) {
            return false
          }
          const itemKey = normalizeKeyPart(item.centroServicoNome ?? item.centroServico ?? '')
          return itemKey === centroKey
        })

        const hhtValor =
          registroHht?.hhtFinal ?? registroHht?.hhtCalculado ?? registroHht?.hhtInformado ?? null

        const agora = nowIso()
        const acidente = {
          id: randomId(),
          pessoaId,
          matricula: dados.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          data: dados.data,
          tipo: dados.tipo,
          tipos: splitMultiValue(dados.tipo),
          tiposIds: Array.isArray(dados.tiposIds) ? dados.tiposIds.slice() : [],
          agente: dados.agente,
          agentes: splitMultiValue(dados.agente),
          agenteId: dados.agenteId ?? null,
          agentesIds: Array.isArray(dados.agentesIds) ? dados.agentesIds.slice() : [],
          lesao: dados.lesao,
          lesoes: dados.lesoes,
          lesoesIds: Array.isArray(dados.lesoesIds) ? dados.lesoesIds.slice() : [],
          parteLesionada: dados.parteLesionada,
          partesLesionadas: dados.partesLesionadas,
          partesIds: Array.isArray(dados.partesIds) ? dados.partesIds.slice() : [],
          classificacoesAgentes: Array.isArray(dados.classificacoesAgentes) ? dados.classificacoesAgentes.slice() : [],
          centroServico: centroServicoBase,
          centroServicoId,
          setor: centroServicoBase,
          local: localBase,
          localId,
          diasPerdidos: dados.diasPerdidos,
          diasDebitados: dados.diasDebitados,
          hht: hhtValor,
          cid: dados.cid,
          cat: dados.cat,
          observacao: dados.observacao,
          dataEsocial: dados.dataEsocial,
          sesmt: dados.sesmt,
          dataSesmt: dados.dataSesmt,
          registradoPor: usuario,
          criadoEm: agora,
          atualizadoEm: null,
          atualizadoPor: null,
          ativo: true,
          cancelMotivo: dados.cancelMotivo ?? null,
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
        const pessoa = dadosSanitizados.pessoaId
          ? state.pessoas.find((item) => item.id === dadosSanitizados.pessoaId)
          : dadosSanitizados.matricula
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
        dados.pessoaId = pessoa?.id ?? dadosSanitizados.pessoaId ?? dados.pessoaId ?? null
        dados.centroServico = dadosSanitizados.centroServico || centroServicoPessoa || atual.centroServico || atual.setor || ''
        dados.centroServicoId = dadosSanitizados.centroServicoId || dados.centroServicoId || dados.centroServico || null
        dados.local = dadosSanitizados.local || localPessoa || atual.local || dados.centroServico
        dados.localId = dadosSanitizados.localId || dados.localId || dados.local || null
        dados.setor = dados.centroServico

        validateAcidentePayload(dados)

        const mesRef = toMonthRefIso(dados.data)
        if (!mesRef) {
          throw createError(400, 'Data do acidente invalida para HHT mensal.')
        }
        const hhtMensalLista = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        const centroKey = normalizeKeyPart(dados.centroServico)
        const registroHht = hhtMensalLista.find((item) => {
          if (!item || item.mesRef !== mesRef) {
            return false
          }
          const itemKey = normalizeKeyPart(item.centroServicoNome ?? item.centroServico ?? '')
          return itemKey === centroKey
        })
        const hhtBase = Number.isFinite(dados.hht) ? dados.hht : Number.isFinite(atual.hht) ? atual.hht : 0
        const hhtValor =
          registroHht?.hhtFinal ?? registroHht?.hhtCalculado ?? registroHht?.hhtInformado ?? hhtBase

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
          hht: hhtValor,
          atualizadoEm: agora,
          atualizadoPor: usuario,
          historicoEdicao: historicoBase,
        }

        state.acidentes[index] = atualizado
        return mapLocalAcidenteRecord(atualizado)
      })
    },
    async cancel(id, payload = {}) {
      if (!id) {
        throw createError(400, 'ID do acidente obrigatorio.')
      }
      return writeState((state) => {
        const index = state.acidentes.findIndex((item) => item.id === id)
        if (index === -1) {
          throw createError(404, 'Acidente nao encontrado.')
        }
        const agora = nowIso()
        const usuario = trim(payload.usuarioResponsavel) || 'sistema'
        const atual = state.acidentes[index]
        const dadosSanitizados = sanitizeAcidentePayload({ ...atual, ...payload })
        const atualizado = {
          ...atual,
          ativo: false,
          cancelMotivo: dadosSanitizados.cancelMotivo ?? atual.cancelMotivo ?? null,
          atualizadoEm: agora,
          atualizadoPor: usuario,
        }
        const camposAlterados = [
          { campo: 'ativo', de: atual.ativo !== false, para: false },
          {
            campo: 'cancelMotivo',
            de: atual.cancelMotivo ?? '',
            para: atualizado.cancelMotivo ?? '',
          },
        ]
        const historicoBase = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []
        historicoBase.push({
          id: randomId(),
          dataEdicao: agora,
          usuarioResponsavel: usuario,
          camposAlterados,
        })
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
  hhtMensal: {
    async list(params = {}) {
      const centroServicoIdFiltro = trim(params.centroServicoId ?? params.centro_servico_id)
      const centroServicoNomeFiltro = trim(params.centroServicoNome ?? params.centro_servico_nome)
      const mesInicio = trim(params.mesInicio ?? params.mes_inicio)
      const mesFim = trim(params.mesFim ?? params.mes_fim)
      const incluirInativos = params.incluirInativos === true || params.incluir_inativos === true

      const toMonthRef = (value) => {
        const raw = trim(value)
        if (!raw) {
          return null
        }
        if (/^\d{4}-\d{2}$/.test(raw)) {
          return `${raw}-01`
        }
        const datePart = raw.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return `${datePart.slice(0, 7)}-01`
        }
        const iso = toDateOnlyIso(raw)
        if (!iso) {
          return null
        }
        return `${iso.slice(0, 7)}-01`
      }

      const parseMesNumero = (value) => {
        const ref = toMonthRef(value)
        if (!ref) {
          return null
        }
        const [year, month] = ref.split('-').map(Number)
        if (!Number.isFinite(year) || !Number.isFinite(month)) {
          return null
        }
        return year * 100 + month
      }

      const inicio = parseMesNumero(mesInicio)
      const fim = parseMesNumero(mesFim)

      return readState((state) => {
        const centros = collectCentrosServicoOptions(state)
        const centrosMap = new Map((centros ?? []).map((item) => [item.id, item.nome]))

        const lista = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        const filtrada = lista.filter((item) => {
          if (!item) {
            return false
          }
          if (centroServicoIdFiltro && trim(item.centroServicoId) !== centroServicoIdFiltro) {
            return false
          }
          if (
            centroServicoNomeFiltro &&
            normalizeKeyPart(item.centroServicoNome ?? item.centroServico ?? '') !==
              normalizeKeyPart(centroServicoNomeFiltro)
          ) {
            return false
          }
          if (inicio || fim) {
            const mesNum = parseMesNumero(item.mesRef)
            if (mesNum === null) {
              return false
            }
            if (inicio && mesNum < inicio) {
              return false
            }
            if (fim && mesNum > fim) {
              return false
            }
          }
          return true
        })

        return filtrada
          .map((item) => ({
            ...item,
            centroServicoNome: centrosMap.get(item.centroServicoId) ?? item.centroServicoNome ?? '',
          }))
          .sort((a, b) => {
            const aRef = parseMesNumero(a.mesRef) ?? 0
            const bRef = parseMesNumero(b.mesRef) ?? 0
            if (aRef !== bRef) {
              return bRef - aRef
            }
            return (a.centroServicoNome ?? '').localeCompare(b.centroServicoNome ?? '', 'pt-BR')
          })
      })
    },

    async create(payload) {
      const toNumberLocal = (value, fallback = 0) => {
        if (value === undefined || value === null || value === '') {
          return fallback
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? fallback : parsed
      }

      const toNullableNumberLocal = (value) => {
        if (value === undefined || value === null || value === '') {
          return null
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const toMonthRef = (value) => {
        const raw = trim(value)
        if (!raw) {
          return null
        }
        if (/^\d{4}-\d{2}$/.test(raw)) {
          return `${raw}-01`
        }
        const datePart = raw.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return `${datePart.slice(0, 7)}-01`
        }
        const iso = toDateOnlyIso(raw)
        if (!iso) {
          return null
        }
        return `${iso.slice(0, 7)}-01`
      }

      const modo = trim(payload.modo ?? 'simples').toLowerCase()
      const mesRef = toMonthRef(payload.mesRef ?? payload.mes_ref)
      const centroServicoId = trim(payload.centroServicoId ?? payload.centro_servico_id)

      if (!mesRef) {
        throw createError(400, 'Informe o mes de referencia.')
      }
      if (!centroServicoId) {
        throw createError(400, 'Selecione um centro de servico.')
      }

      return writeState((state) => {
        state.hhtMensal = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        state.hhtMensalHistorico = Array.isArray(state.hhtMensalHistorico) ? state.hhtMensalHistorico : []

        const statusNome = trim(payload.statusNome ?? payload.status_nome ?? 'Ativo')
        const duplicado = state.hhtMensal.some(
          (item) =>
            item?.mesRef === mesRef &&
            item?.centroServicoId === centroServicoId &&
            (item?.statusNome ?? '').toLowerCase() !== 'cancelado' &&
            statusNome.toLowerCase() !== 'cancelado',
        )
        if (duplicado) {
          throw createError(400, 'Ja existe um registro para este mes e centro de servico.')
        }

        const registroBase = {
          id: randomId(),
          mesRef,
          centroServicoId,
          centroServicoNome: trim(payload.centroServicoNome ?? ''),
          qtdPessoas: Math.max(0, Math.trunc(toNumberLocal(payload.qtdPessoas ?? payload.qtd_pessoas, 0))),
          horasMesBase: Math.max(0, toNumberLocal(payload.horasMesBase ?? payload.horas_mes_base, 0)),
          escalaFactor: Math.max(0, toNumberLocal(payload.escalaFactor ?? payload.escala_factor, 1)),
          horasAfastamento: Math.max(0, toNumberLocal(payload.horasAfastamento ?? payload.horas_afastamento, 0)),
          horasFerias: Math.max(0, toNumberLocal(payload.horasFerias ?? payload.horas_ferias, 0)),
          horasTreinamento: Math.max(
            0,
            toNumberLocal(payload.horasTreinamento ?? payload.horas_treinamento, 0),
          ),
          horasOutrosDescontos: Math.max(
            0,
            toNumberLocal(payload.horasOutrosDescontos ?? payload.horas_outros_descontos, 0),
          ),
          horasExtras: Math.max(0, toNumberLocal(payload.horasExtras ?? payload.horas_extras, 0)),
          modo: ['manual', 'simples', 'completo'].includes(modo) ? modo : 'simples',
          hhtInformado: toNullableNumberLocal(payload.hhtInformado ?? payload.hht_informado),
        }

        const descontos =
          registroBase.horasAfastamento +
          registroBase.horasFerias +
          registroBase.horasTreinamento +
          registroBase.horasOutrosDescontos
        const baseCompleto = registroBase.qtdPessoas * registroBase.horasMesBase * registroBase.escalaFactor
        const calculadoCompleto = baseCompleto - descontos + registroBase.horasExtras
        const calculadoSimples = registroBase.qtdPessoas * registroBase.horasMesBase
        const hhtCalculado =
          registroBase.modo === 'simples' ? calculadoSimples : calculadoCompleto

        if (registroBase.modo === 'manual' && registroBase.hhtInformado === null) {
          throw createError(400, 'Informe o HHT para modo manual.')
        }

        const hhtFinal = registroBase.modo === 'manual' ? registroBase.hhtInformado : hhtCalculado

        const agora = nowIso()
        const registro = {
          ...registroBase,
          statusId: trim(payload.statusHhtId ?? payload.status_hht_id) || null,
          statusNome: statusNome || '',
          hhtCalculado: Number(hhtCalculado.toFixed(2)),
          hhtFinal: Number((hhtFinal ?? 0).toFixed(2)),
          createdAt: agora,
          createdBy: null,
          updatedAt: agora,
          updatedBy: null,
        }

        if (registro.modo !== 'manual') {
          registro.hhtInformado = null
        }

        state.hhtMensal.push(registro)
        applyHhtToLocalAcidentes(state, mesRef, centroServicoId, registro.centroServicoNome, registro.hhtFinal)
        return registro
      })
    },

    async update(id, payload) {
      if (!id) {
        throw createError(400, 'ID obrigatorio.')
      }

      const toNumberLocal = (value, fallback = 0) => {
        if (value === undefined || value === null || value === '') {
          return fallback
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? fallback : parsed
      }

      const toNullableNumberLocal = (value) => {
        if (value === undefined || value === null || value === '') {
          return null
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const toMonthRef = (value) => {
        const raw = trim(value)
        if (!raw) {
          return null
        }
        if (/^\d{4}-\d{2}$/.test(raw)) {
          return `${raw}-01`
        }
        const datePart = raw.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return `${datePart.slice(0, 7)}-01`
        }
        const iso = toDateOnlyIso(raw)
        if (!iso) {
          return null
        }
        return `${iso.slice(0, 7)}-01`
      }

      return writeState((state) => {
        state.hhtMensal = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        state.hhtMensalHistorico = Array.isArray(state.hhtMensalHistorico) ? state.hhtMensalHistorico : []

        const index = state.hhtMensal.findIndex((item) => item?.id === id)
        if (index === -1) {
          throw createError(404, 'Registro nao encontrado.')
        }

          const atual = state.hhtMensal[index]
        const modo = trim(payload.modo ?? atual.modo ?? 'simples').toLowerCase()
        const mesRef = toMonthRef(payload.mesRef ?? payload.mes_ref ?? atual.mesRef)
        const centroServicoId = trim(payload.centroServicoId ?? payload.centro_servico_id ?? atual.centroServicoId)

        if (!mesRef) {
          throw createError(400, 'Informe o mes de referencia.')
        }
        if (!centroServicoId) {
          throw createError(400, 'Selecione um centro de servico.')
        }

        const duplicado = state.hhtMensal.some(
          (item) =>
            item?.id !== id &&
            item?.mesRef === mesRef &&
            item?.centroServicoId === centroServicoId &&
            item?.ativo !== false,
        )
        if (duplicado) {
          throw createError(400, 'Ja existe um registro para este mes e centro de servico.')
        }

        const atualizadoBase = {
          ...atual,
          mesRef,
          centroServicoId,
          centroServicoNome: trim(payload.centroServicoNome ?? atual.centroServicoNome ?? ''),
          ativo:
            payload.ativo !== undefined
              ? payload.ativo !== false
              : atual.ativo !== undefined
              ? atual.ativo
              : true,
          qtdPessoas:
            payload.qtdPessoas !== undefined || payload.qtd_pessoas !== undefined
              ? Math.max(0, Math.trunc(toNumberLocal(payload.qtdPessoas ?? payload.qtd_pessoas, atual.qtdPessoas ?? 0)))
              : atual.qtdPessoas ?? 0,
          horasMesBase:
            payload.horasMesBase !== undefined || payload.horas_mes_base !== undefined
              ? Math.max(0, toNumberLocal(payload.horasMesBase ?? payload.horas_mes_base, atual.horasMesBase ?? 0))
              : atual.horasMesBase ?? 0,
          escalaFactor:
            payload.escalaFactor !== undefined || payload.escala_factor !== undefined
              ? Math.max(0, toNumberLocal(payload.escalaFactor ?? payload.escala_factor, atual.escalaFactor ?? 1))
              : atual.escalaFactor ?? 1,
          horasAfastamento:
            payload.horasAfastamento !== undefined || payload.horas_afastamento !== undefined
              ? Math.max(
                  0,
                  toNumberLocal(payload.horasAfastamento ?? payload.horas_afastamento, atual.horasAfastamento ?? 0),
                )
              : atual.horasAfastamento ?? 0,
          horasFerias:
            payload.horasFerias !== undefined || payload.horas_ferias !== undefined
              ? Math.max(0, toNumberLocal(payload.horasFerias ?? payload.horas_ferias, atual.horasFerias ?? 0))
              : atual.horasFerias ?? 0,
          horasTreinamento:
            payload.horasTreinamento !== undefined || payload.horas_treinamento !== undefined
              ? Math.max(
                  0,
                  toNumberLocal(payload.horasTreinamento ?? payload.horas_treinamento, atual.horasTreinamento ?? 0),
                )
              : atual.horasTreinamento ?? 0,
          horasOutrosDescontos:
            payload.horasOutrosDescontos !== undefined || payload.horas_outros_descontos !== undefined
              ? Math.max(
                  0,
                  toNumberLocal(
                    payload.horasOutrosDescontos ?? payload.horas_outros_descontos,
                    atual.horasOutrosDescontos ?? 0,
                  ),
                )
              : atual.horasOutrosDescontos ?? 0,
          horasExtras:
            payload.horasExtras !== undefined || payload.horas_extras !== undefined
              ? Math.max(0, toNumberLocal(payload.horasExtras ?? payload.horas_extras, atual.horasExtras ?? 0))
              : atual.horasExtras ?? 0,
          modo: ['manual', 'simples', 'completo'].includes(modo) ? modo : 'simples',
          hhtInformado:
            payload.hhtInformado !== undefined || payload.hht_informado !== undefined
              ? toNullableNumberLocal(payload.hhtInformado ?? payload.hht_informado)
              : atual.hhtInformado ?? null,
        }

        if (atualizadoBase.modo !== 'manual') {
          atualizadoBase.hhtInformado = null
        } else if (atualizadoBase.hhtInformado === null) {
          throw createError(400, 'Informe o HHT para modo manual.')
        }

        const descontos =
          atualizadoBase.horasAfastamento +
          atualizadoBase.horasFerias +
          atualizadoBase.horasTreinamento +
          atualizadoBase.horasOutrosDescontos
        const baseCompleto = atualizadoBase.qtdPessoas * atualizadoBase.horasMesBase * atualizadoBase.escalaFactor
        const calculadoCompleto = baseCompleto - descontos + atualizadoBase.horasExtras
        const calculadoSimples = atualizadoBase.qtdPessoas * atualizadoBase.horasMesBase
        const hhtCalculado =
          atualizadoBase.modo === 'simples' ? calculadoSimples : calculadoCompleto
        const hhtFinal = atualizadoBase.modo === 'manual' ? atualizadoBase.hhtInformado : hhtCalculado

        const agora = nowIso()
        const atualizado = {
          ...atualizadoBase,
          statusId:
            payload.statusHhtId !== undefined || payload.status_hht_id !== undefined
              ? trim(payload.statusHhtId ?? payload.status_hht_id) || null
              : atual.statusId ?? null,
          statusNome:
            payload.statusNome !== undefined || payload.status_nome !== undefined
              ? trim(payload.statusNome ?? payload.status_nome) || atual.statusNome || ''
              : atual.statusNome || '',
          hhtCalculado: Number(hhtCalculado.toFixed(2)),
          hhtFinal: Number((hhtFinal ?? 0).toFixed(2)),
          updatedAt: agora,
          updatedBy: null,
        }

        state.hhtMensalHistorico.push({
          id: randomId(),
          hhtMensalId: id,
          acao: 'UPDATE',
          alteradoEm: agora,
          alteradoPorId: null,
          alteradoPor: 'sistema',
          antes: { ...atual },
          depois: { ...atualizado },
          motivo: null,
        })

        state.hhtMensal[index] = atualizado
        applyHhtToLocalAcidentes(state, atualizado.mesRef, atualizado.centroServicoId, atualizado.centroServicoNome, atualizado.hhtFinal)
        return atualizado
      })
    },

    async delete(id, motivo = '') {
      if (!id) {
        throw createError(400, 'ID obrigatorio.')
      }
      return writeState((state) => {
        state.hhtMensal = Array.isArray(state.hhtMensal) ? state.hhtMensal : []
        state.hhtMensalHistorico = Array.isArray(state.hhtMensalHistorico) ? state.hhtMensalHistorico : []

        const index = state.hhtMensal.findIndex((item) => item?.id === id)
        if (index === -1) {
          throw createError(404, 'Registro nao encontrado.')
        }
        const atual = state.hhtMensal[index]

        const mesRef = trim(atual.mesRef ?? '')
        const centroNome = normalizeKeyPart(atual.centroServicoNome ?? atual.centroServico ?? '')
        const toMonthRef = (value) => {
          const raw = trim(value)
          if (!raw) {
            return null
          }
          const iso = toDateOnlyIso(raw)
          if (!iso) {
            return null
          }
          return `${iso.slice(0, 7)}-01`
        }
        const temAcidente = (Array.isArray(state.acidentes) ? state.acidentes : []).some((acidente) => {
          const mesAcidente = toMonthRef(acidente.data ?? acidente.dataOcorrencia ?? acidente.data_ocorrencia)
          if (!mesAcidente || mesAcidente !== mesRef) {
            return false
          }
          const centroAcidente = normalizeKeyPart(
            acidente.centroServico ?? acidente.setor ?? acidente.local ?? acidente.centro_servico,
          )
          return centroAcidente && centroAcidente === centroNome
        })
        if (temAcidente) {
          throw createError(400, 'Nao e possivel cancelar: ha acidentes cadastrados para este centro/mes.')
        }

        const agora = nowIso()
        const atualizado = {
          ...atual,
          ativo: false,
          updatedAt: agora,
          updatedBy: null,
        }
        state.hhtMensalHistorico.push({
          id: randomId(),
          hhtMensalId: id,
          acao: 'UPDATE',
          alteradoEm: agora,
          alteradoPorId: null,
          alteradoPor: 'sistema',
          antes: { ...atual },
          depois: { ...atualizado },
          motivo: trim(motivo),
        })

        state.hhtMensal[index] = atualizado
        return atualizado
      })
    },

    async history(id) {
      if (!id) {
        throw createError(400, 'ID obrigatorio.')
      }
      return readState((state) => {
        const historico = (state.hhtMensalHistorico || []).filter((item) => item?.hhtMensalId === id)
        return sortByDateDesc(historico, 'alteradoEm')
      })
    },

    async peopleCount(params = {}) {
      const centroServicoId = trim(params.centroServicoId ?? params.centro_servico_id)
      const centroServicoNomeParam = trim(params.centroServicoNome ?? params.centro_servico_nome)
      if (!centroServicoId && !centroServicoNomeParam) {
        throw createError(400, 'Selecione um centro de servico.')
      }
      return readState((state) => {
        const centros = collectCentrosServicoOptions(state)
        const centroNome =
          centros.find((item) => String(item?.id ?? '') === centroServicoId)?.nome ||
          centroServicoNomeParam ||
          centroServicoId

        const total = (state.pessoas || []).filter((pessoa) => {
          if (!pessoa || pessoa.ativo === false) {
            return false
          }
          const nomePessoa = trim(pessoa.centroServico ?? pessoa.setor ?? pessoa.local)
          return nomePessoa === centroNome
        }).length

        return total
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
  basicRegistration: {
    async list(params = {}) {
      const { table, termo, ativo } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      const termoBase = normalizeSearchTerm(termo)
      return readState((state) => {
        const lista = Array.isArray(state.basicRegistration?.[key]) ? state.basicRegistration[key].slice() : []
        const filtrados = lista.filter((item) => {
          if (!item || typeof item !== 'object') {
            return false
          }
          if (ativo === true || ativo === false) {
            if ((item.ativo !== false) !== ativo) {
              return false
            }
          }
          if (termoBase) {
            const nomeBase = normalizeSearchTerm(item?.[config.nameColumn])
            if (!nomeBase.includes(termoBase)) {
              return false
            }
          }
          return true
        })
        filtrados.sort((a, b) => {
          const ativoA = a?.ativo !== false
          const ativoB = b?.ativo !== false
          if (ativoA !== ativoB) {
            return ativoA ? -1 : 1
          }
          for (const campo of config.order) {
            const va = a?.[campo]
            const vb = b?.[campo]
            if (va === undefined || va === null) return 1
            if (vb === undefined || vb === null) return -1
            if (va < vb) return -1
            if (va > vb) return 1
          }
          return 0
        })
        return filtrados.map((record) => mapBasicRegistrationLocalRecord(key, record))
      })
    },
    async create(params = {}) {
      const { table, data } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      const nome = trim(data?.nome)
      if (!nome) {
        throw createError(400, 'Informe o nome para cadastro.')
      }
      const agora = nowIso()
      return writeState((state) => {
        state.basicRegistration = state.basicRegistration || {}
        state.basicRegistration[key] = Array.isArray(state.basicRegistration[key]) ? state.basicRegistration[key] : []
        state.basicRegistrationHistory = Array.isArray(state.basicRegistrationHistory)
          ? state.basicRegistrationHistory
          : []
        const record = {
          id: randomId(),
          ativo: data?.ativo !== false,
          created_by_user_id: data?.usuarioId ?? null,
          updated_by_user_id: data?.usuarioId ?? null,
          created_by_user_name: trim(data?.usuarioNome ?? ''),
          account_owner_id: data?.accountOwnerId ?? null,
        }
        record[config.nameColumn] = nome
        if (key === 'centros_servico') {
          record.centro_custo_id = data?.centroCustoId ?? null
        }
        if (key === 'centros_estoque') {
          record.centro_custo = data?.centroCustoId ?? null
        }
        if (key === 'setores') {
          record.centro_servico_id = data?.centroServicoId ?? null
        }
        if (key === 'fabricantes' || key === 'centros_estoque') {
          record.created_at = agora
        } else {
          record.criado_em = agora
        }
        record.updated_at = agora
        state.basicRegistration[key].push(record)

        const history = {
          id: randomId(),
          table_name: key,
          record_id: record.id,
          record_name: record[config.nameColumn] ?? '',
          action: 'INSERT',
          changed_fields: Object.keys(record),
          before: null,
          after: { ...record },
          record_created_at: record.created_at ?? record.criado_em ?? null,
          record_updated_at: record.updated_at ?? null,
          record_created_by_user_id: record.created_by_user_id ?? null,
          record_updated_by_user_id: record.updated_by_user_id ?? null,
          changed_by_user_id: record.updated_by_user_id ?? record.created_by_user_id ?? null,
          changed_by_user_name: record.created_by_user_name ?? '',
          created_at: agora,
          account_owner_id: record.account_owner_id ?? null,
        }
        state.basicRegistrationHistory.push(history)
        return mapBasicRegistrationLocalRecord(key, record)
      })
    },
    async update(params = {}) {
      const { table, id, data } = params
      const { key, config } = resolveBasicRegistrationConfig(table)
      if (!id) {
        throw createError(400, 'ID obrigatorio para atualizar.')
      }
      return writeState((state) => {
        state.basicRegistration = state.basicRegistration || {}
        state.basicRegistration[key] = Array.isArray(state.basicRegistration[key]) ? state.basicRegistration[key] : []
        state.basicRegistrationHistory = Array.isArray(state.basicRegistrationHistory)
          ? state.basicRegistrationHistory
          : []
        const index = state.basicRegistration[key].findIndex((item) => item?.id === id)
        if (index === -1) {
          throw createError(404, 'Registro nao encontrado.')
        }
        const atual = state.basicRegistration[key][index]
        const antes = { ...atual }
        const agora = nowIso()

        if (data?.nome !== undefined) {
          const nome = trim(data.nome)
          if (!nome) {
            throw createError(400, 'Informe o nome para cadastro.')
          }
          atual[config.nameColumn] = nome
        }
        if (data?.ativo !== undefined) {
          atual.ativo = data.ativo !== false
        }
        if (key === 'centros_servico' && data?.centroCustoId !== undefined) {
          atual.centro_custo_id = data.centroCustoId || null
        }
        if (key === 'centros_estoque' && data?.centroCustoId !== undefined) {
          atual.centro_custo = data.centroCustoId || null
        }
        if (key === 'setores' && data?.centroServicoId !== undefined) {
          atual.centro_servico_id = data.centroServicoId || null
        }
        atual.updated_at = agora
        atual.updated_by_user_id = data?.usuarioId ?? atual.updated_by_user_id ?? null
        if (data?.usuarioNome) {
          atual.created_by_user_name = trim(data.usuarioNome)
        }

        const after = { ...atual }
        const changedFields = Array.from(
          new Set([...Object.keys(antes), ...Object.keys(after)])
        ).filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(after[campo]))

        if (changedFields.length) {
          state.basicRegistrationHistory.push({
            id: randomId(),
            table_name: key,
            record_id: atual.id,
            record_name: atual[config.nameColumn] ?? '',
            action: 'UPDATE',
            changed_fields: changedFields,
            before: antes,
            after,
            record_created_at: atual.created_at ?? atual.criado_em ?? null,
            record_updated_at: atual.updated_at ?? null,
            record_created_by_user_id: atual.created_by_user_id ?? null,
            record_updated_by_user_id: atual.updated_by_user_id ?? null,
            changed_by_user_id: atual.updated_by_user_id ?? atual.created_by_user_id ?? null,
            changed_by_user_name: atual.updated_by_user_name ?? atual.created_by_user_name ?? '',
            created_at: agora,
            account_owner_id: atual.account_owner_id ?? null,
          })
        }

        state.basicRegistration[key][index] = atual
        return mapBasicRegistrationLocalRecord(key, atual)
      })
    },
    async inactivate(params = {}) {
      const { table, id } = params
      return this.update({ table, id, data: { ativo: false } })
    },
    async history(params = {}) {
      const { table, recordId } = params
      const { key } = resolveBasicRegistrationConfig(table)
      if (!recordId) {
        throw createError(400, 'ID obrigatorio para historico.')
      }
      return readState((state) => {
        const lista = Array.isArray(state.basicRegistrationHistory) ? state.basicRegistrationHistory : []
        return lista
          .filter((item) => item?.table_name === key && item?.record_id === recordId)
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      })
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
