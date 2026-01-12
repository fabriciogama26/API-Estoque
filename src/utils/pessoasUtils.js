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
