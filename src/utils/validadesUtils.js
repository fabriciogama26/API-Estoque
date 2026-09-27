import {
  CATEGORIA_OPTIONS,
  EXIGENCIA_OPTIONS,
  HISTORICO_ACAO_LABELS,
  STATUS_OPTIONS,
  TIPO_OPTIONS,
} from '../config/ValidadesConfig.js'
import { formatDate, formatDateTime } from './asoUtils.js'

// Apenas apresentacao: o status, os dias restantes e o vencimento chegam prontos do banco.

export { formatDate, formatDateTime }

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const formatNumber = (value) => numberFormatter.format(Number(value) || 0)

const buildLabelMap = (options) => new Map(options.map((item) => [item.value, item]))
const statusMap = buildLabelMap(STATUS_OPTIONS)
const categoriaMap = buildLabelMap(CATEGORIA_OPTIONS)
const tipoMap = buildLabelMap(TIPO_OPTIONS)
const exigenciaMap = buildLabelMap(EXIGENCIA_OPTIONS)

export const resolveStatusMeta = (status) =>
  statusMap.get(status) || { value: status, label: status || 'Nao informado', variant: 'pending', color: '#94a3b8' }

export const resolveCategoriaLabel = (categoria) => categoriaMap.get(categoria)?.label || categoria || '-'

export const resolveTipoLabel = (tipo) => tipoMap.get(tipo)?.label || tipo || '-'

export const resolveExigenciaLabel = (exigencia) => {
  if (exigencia === 'exigido') return 'Exigido'
  return exigenciaMap.get(exigencia)?.label || exigencia || '-'
}

export const formatValidade = ({ possui_validade: possui, validade_quantidade: quantidade, validade_unidade: unidade } = {}) => {
  if (!possui) return 'Sem validade'
  if (!quantidade || !unidade) return '-'
  const singular = Number(quantidade) === 1
  if (unidade === 'meses') return `${quantidade} ${singular ? 'mes' : 'meses'}`
  return `${quantidade} ${singular ? 'dia' : 'dias'}`
}

// Previa devolvida por rpc_validades_simular_vencimento.
export const describePreviaVencimento = (previa) => {
  if (!previa) return 'Calculando...'
  if (!previa.possui_validade) return 'Sem validade'
  return `${formatDate(previa.data_vencimento)} (validade de ${formatValidade(previa)})`
}

export const formatDiasRestantes = (dias) => {
  if (dias === null || dias === undefined || dias === '') return '-'
  const valor = Number(dias)
  if (valor < 0) return `${valor} (vencido ha ${Math.abs(valor)})`
  return String(valor)
}

export const resolveHistoricoAcaoLabel = (acao) => HISTORICO_ACAO_LABELS[acao] || acao || 'Acao'

export const describeRegistro = (registro) => {
  if (!registro) return ''
  const partes = [registro.pessoa_nome, registro.requisito_nome].filter(Boolean)
  return partes.join(' - ')
}

// Data local YYYY-MM-DD (evita deslocamento de UTC no nome do arquivo/campos de data).
export const todayLocalKey = () => {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

// Mensagem amigavel de erro vindo das RPCs (as mensagens de regra ja chegam em portugues).
export const resolveErrorMessage = (error, fallback) => {
  if (!error) return fallback
  if (error.code === '42501' && !/permissao|tenant|owner|nao encontrado|nao pertence/i.test(error.message || '')) {
    return 'Sem permissao para esta operacao.'
  }
  return error.message || fallback
}
