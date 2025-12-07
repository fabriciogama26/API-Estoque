const PAGE_CATALOG = [
  { id: 'dashboard', label: 'Dashboard Estoque', paths: ['/', '/dashboard'] },
  { id: 'dashboard-acidentes', label: 'Dashboard Acidentes', paths: ['/dashboard/acidentes'] },
  { id: 'estoque', label: 'Estoque Atual', paths: ['/estoque'] },
  { id: 'entradas', label: 'Entradas', paths: ['/entradas', '/movimentacoes/entradas'] },
  { id: 'saidas', label: 'Saidas', paths: ['/saidas', '/movimentacoes/saidas'] },
  { id: 'cadastros-pessoas', label: 'Pessoas', paths: ['/cadastros/pessoas'] },
  { id: 'cadastros-materiais', label: "EPI's", paths: ['/cadastros/materiais'] },
  { id: 'acidentes-cadastro', label: 'Cadastro de Acidentes', paths: ['/acidentes/cadastro'] },
  { id: 'termo-epi', label: 'Termo de EPI', paths: ['/documentos/termo-epi', '/termos/epi'] },
  { id: 'configuracoes', label: 'Configuracoes', paths: ['/configuracoes'] },
  { id: 'no-access', label: 'Sem acesso', paths: ['/sem-acesso'] },
]

const ALL_PAGE_IDS = PAGE_CATALOG.map((page) => page.id)

const DEFAULT_CREDENTIAL_PERMISSIONS = {
  master: ALL_PAGE_IDS,
  admin: ALL_PAGE_IDS,
  estagiario: ['dashboard', 'dashboard-acidentes', 'termo-epi', 'no-access'],
  operador: [
    'dashboard',
    'dashboard-acidentes',
    'estoque',
    'entradas',
    'saidas',
    'cadastros-pessoas',
    'cadastros-materiais',
    'acidentes-cadastro',
    'termo-epi',
    'configuracoes',
    'no-access',
  ],
  visitante: ['dashboard', 'dashboard-acidentes', 'termo-epi', 'no-access'],
}

function normalizeId(value) {
  return (value || '').trim().toLowerCase()
}

export function resolvePageByPath(pathname = '') {
  const normalized = pathname.trim().toLowerCase()
  return (
    PAGE_CATALOG.find((page) => page.paths?.some((path) => normalized === path.toLowerCase())) ||
    PAGE_CATALOG.find((page) => page.paths?.some((path) => normalized.startsWith(path.toLowerCase())))
  )
}

export function resolveAllowedPageIds(credential, explicitPageIds = []) {
  const cred = normalizeId(credential) || 'admin'

  if (cred === 'master') {
    return ALL_PAGE_IDS
  }

  const normalizedIds = Array.isArray(explicitPageIds)
    ? Array.from(new Set(explicitPageIds.map(normalizeId))).filter(Boolean)
    : []

  if (cred === 'admin') {
    if (normalizedIds.length) {
      const withConfig = normalizedIds.includes('configuracoes')
        ? normalizedIds
        : normalizedIds.concat('configuracoes')
      return Array.from(new Set(withConfig))
    }
    return ALL_PAGE_IDS
  }

  if (normalizedIds.length) {
    return normalizedIds
  }

  const fallback = DEFAULT_CREDENTIAL_PERMISSIONS[cred] || DEFAULT_CREDENTIAL_PERMISSIONS.admin
  return Array.from(new Set(fallback))
}

export function canAccessPath(pathname, { credential, explicitPages } = {}) {
  const allowedIds = resolveAllowedPageIds(credential, explicitPages)
  const page = resolvePageByPath(pathname)
  if (!page) {
    return true
  }
  return allowedIds.includes(page.id)
}

export function resolveAllowedPaths({ credential, explicitPages } = {}) {
  const allowedIds = resolveAllowedPageIds(credential, explicitPages)
  const allowedPaths = PAGE_CATALOG.filter((page) => allowedIds.includes(page.id)).flatMap((page) => page.paths || [])
  return Array.from(new Set(allowedPaths))
}

export function describeCredential(value) {
  const normalized = normalizeId(value)
  if (normalized === 'estagiario') return 'Estagiario'
  if (normalized === 'master') return 'Master'
  if (normalized === 'operador') return 'Operador'
  if (normalized === 'visitante') return 'Visitante'
  return 'Administrador'
}

export const CREDENTIAL_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'estagiario', label: 'Estagiario' },
  { value: 'operador', label: 'Operador' },
  { value: 'visitante', label: 'Visitante' },
]

export { PAGE_CATALOG, DEFAULT_CREDENTIAL_PERMISSIONS }
