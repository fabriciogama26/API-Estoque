import {
  PESSOAS_FILTER_DEFAULT,
  PESSOAS_FORM_DEFAULT,
} from '../config/PessoasConfig.js'

export const formatDateInputValue = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export const buildPessoasQuery = (filters = PESSOAS_FILTER_DEFAULT) => {
  return {} // filtros aplicados apenas no frontend
}

export const mapOptionsById = (lista = []) =>
  new Map((lista || []).filter((item) => item?.id).map((item) => [item.id, item.nome ?? item.label ?? '']))

export const normalizeFormDefaults = () => ({ ...PESSOAS_FORM_DEFAULT })
export const normalizeFilterDefaults = () => ({ ...PESSOAS_FILTER_DEFAULT })

export const uniqueSorted = (lista = []) =>
  Array.from(
    new Set(
      (lista || [])
        .map((item) => (item ?? '').toString().trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

export const formatDate = (value) => {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return date.toLocaleDateString('pt-BR', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
}

export const formatDateTime = (value) => {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

export const resolveUsuarioNome = (user) => {
  if (!user) return 'sistema'
  return user.display_name || user.name || user.username || user.email || user.id || 'sistema'
}

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

const formatCsvDate = (value, dateOnly = false) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  if (dateOnly) {
    return date.toLocaleDateString('pt-BR')
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  })
}

export const buildPessoasCsv = (pessoas = []) => {
  const headers = [
    'ID',
    'Nome',
    'Matricula',
    'Centro de servico',
    'Setor',
    'Cargo',
    'Tipo de execucao',
    'Data admissao',
    'Data demissao',
    'Status',
    'Usuario cadastro',
    'Usuario edicao',
    'Criado em',
    'Atualizado em',
  ]

  const rows = (Array.isArray(pessoas) ? pessoas : []).map((pessoa) => {
    const status = pessoa?.ativo === false ? 'INATIVO' : 'ATIVO'
    const valores = [
      pessoa?.id ?? '',
      pessoa?.nome ?? '',
      pessoa?.matricula ?? '',
      pessoa?.centroServico ?? pessoa?.local ?? '',
      pessoa?.setor ?? '',
      pessoa?.cargo ?? '',
      pessoa?.tipoExecucao ?? '',
      formatCsvDate(pessoa?.dataAdmissao, true),
      formatCsvDate(pessoa?.dataDemissao, true),
      status,
      pessoa?.usuarioCadastro ?? '',
      pessoa?.usuarioEdicao ?? '',
      formatCsvDate(pessoa?.criadoEm),
      formatCsvDate(pessoa?.atualizadoEm),
    ]
    return valores.map(sanitizeCsvValue).join(';')
  })

  return [headers.join(';'), ...rows].join('\n')
}

export const downloadPessoasCsv = (pessoas = [], options = {}) => {
  const filename =
    typeof options.filename === 'string' && options.filename.trim()
      ? options.filename.trim()
      : 'pessoas.csv'
  const csvContent = buildPessoasCsv(pessoas)
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
