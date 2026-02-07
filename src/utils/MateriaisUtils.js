import {
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_PROTECAO_MAOS,
  GRUPO_MATERIAL_VESTIMENTA,
} from '../routes/rules/MateriaisRules.js'
import { normalizeSelectionItem } from './selectionUtils.js'

export const sanitizeDigits = (value) => (value ? String(value).replace(/\D+/g, '') : '')

export const parseCurrencyToNumber = (value) => {
  const texto = String(value ?? '').replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')
  const numero = parseFloat(texto)
  return Number.isNaN(numero) ? 0 : numero
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))

export const formatCurrencyInput = (rawValue) => {
  const digits = sanitizeDigits(rawValue)
  if (!digits) return ''
  const numero = Number(digits) / 100
  if (Number.isNaN(numero)) return ''
  return formatCurrency(numero).replace('R$', '').trim()
}

export const normalizeGrupo = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

export const isGrupo = (value, target) => normalizeGrupo(value) === normalizeGrupo(target)

const normalizeLookupValue = (valor) => (valor === undefined || valor === null ? '' : String(valor).trim())

export const findOptionByValue = (options, valor) => {
  const alvo = normalizeLookupValue(valor)
  if (!alvo) {
    return null
  }
  const alvoKey = alvo.toLowerCase()
  return (options || []).find((item) => {
    const id = normalizeLookupValue(item?.id ?? item?.value ?? item?.valor ?? item?.nome ?? '')
    const nome = normalizeLookupValue(item?.nome ?? '')
    return (id && id.toLowerCase() === alvoKey) || (nome && nome.toLowerCase() === alvoKey)
  })
}

export const isValidUuid = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export const resolveGrupoFlags = (grupoNome) => ({
  isCalcado: isGrupo(grupoNome, GRUPO_MATERIAL_CALCADO),
  isVestimenta:
    isGrupo(grupoNome, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(grupoNome, GRUPO_MATERIAL_PROTECAO_MAOS),
})

export const normalizeSelectionWithCurrent = (lista = [], atual) =>
  [...lista, atual ? normalizeSelectionItem(atual) : null].filter(Boolean)

export const mapHistoryWithUsuario = (registros = [], material = {}) =>
  (registros ?? []).map((registro) => {
    const alteracoes = Array.isArray(registro?.camposAlterados) ? registro.camposAlterados : []
    const isAtualizacao = alteracoes.length > 0
    const usuarioResolved = isAtualizacao ? material.usuarioAtualizacaoNome : material.usuarioCadastroNome
    return {
      ...registro,
      usuarioResponsavel: usuarioResolved || registro.usuarioResponsavel || '-',
    }
  })
