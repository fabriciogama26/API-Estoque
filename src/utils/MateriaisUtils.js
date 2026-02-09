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

const sanitizeCsvValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : String(value)
  const clean = text.replace(/"/g, '""').replace(/\r?\n/g, ' ').trim()
  if (/[;"\n]/.test(clean)) {
    return `"${clean}"`
  }
  return clean
}

const formatCsvNumber = (value, decimals = null) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return ''
  }
  if (decimals === null) {
    return String(num)
  }
  return num.toFixed(decimals)
}

const formatCsvDate = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('pt-BR')
}

export const buildMateriaisCsv = (materiais = []) => {
  const headers = [
    'Grupo',
    'Material',
    'Descricao',
    'Valor unitario',
    'Validade (dias)',
    'Fabricante',
    'Registrado por',
    'Cadastrado em',
  ]

  const rows = (Array.isArray(materiais) ? materiais : []).map((material) => {
    const registradoPor =
      material?.usuarioCadastroUsername ||
      material?.registradoPor ||
      material?.usuarioCadastroNome ||
      material?.usuarioCadastro ||
      ''
    const cadastradoEm = material?.criadoEm || material?.created_at || material?.createdAt
    const valores = [
      material?.grupoMaterialNome || material?.grupoMaterial || '',
      material?.nomeItemRelacionado || material?.nome || '',
      material?.descricao?.trim() || '',
      formatCsvNumber(material?.valorUnitario ?? material?.valorUnitarioHistorico ?? 0, 2),
      material?.validadeDias ?? material?.validade ?? '',
      material?.fabricanteNome || material?.fabricante || '',
      registradoPor,
      formatCsvDate(cadastradoEm),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return [headers.join(';'), ...rows].join('\n')
}

export const downloadMateriaisCsv = (materiais = [], options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'materiais.csv'
  const csvContent = buildMateriaisCsv(materiais)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
