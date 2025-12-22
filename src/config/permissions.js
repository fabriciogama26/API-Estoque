const PAGE_CATALOG = [
  { id: 'dashboard', label: 'Dashboard Estoque', paths: ['/', '/dashboard'] },
  { id: 'dashboard-acidentes', label: 'Dashboard Acidentes', paths: ['/dashboard/acidentes'] },
  { id: 'estoque', label: 'Estoque Atual', paths: ['/estoque'] },
  { id: 'entradas', label: 'Entradas', paths: ['/entradas', '/movimentacoes/entradas'] },
  { id: 'saidas', label: 'Saidas', paths: ['/saidas', '/movimentacoes/saidas'] },
  { id: 'cadastros-pessoas', label: 'Pessoas', paths: ['/cadastros/pessoas'] },
  { id: 'cadastros-materiais', label: "EPI's", paths: ['/cadastros/materiais'] },
  { id: 'acidentes-cadastro', label: 'Cadastro de Acidentes', paths: ['/acidentes/cadastro'] },
  { id: 'acidentes-hht-mensal', label: 'HHT Mensal', paths: ['/acidentes/hht-mensal'] },
  { id: 'termo-epi', label: 'Termo de EPI', paths: ['/documentos/termo-epi', '/termos/epi'] },
  { id: 'configuracoes', label: 'Configuracoes', paths: ['/configuracoes'] },
  { id: 'no-access', label: 'Sem acesso', paths: ['/sem-acesso'] },
]

const ALL_PAGE_IDS = PAGE_CATALOG.map((page) => page.id)

// Mapeia cada pagina para a permission key necessária (leitura). Paginas sem mapeamento liberam por default.
const PAGE_REQUIRED_PERMISSION = {
  dashboard: 'estoque.read',
  'dashboard-acidentes': 'acidentes.read',
  estoque: 'estoque.read',
  entradas: 'estoque.read',
  saidas: 'estoque.read',
  'cadastros-pessoas': 'pessoas.read',
  'cadastros-materiais': 'estoque.read',
  'acidentes-cadastro': 'acidentes.read',
  'acidentes-hht-mensal': 'hht.read',
  'termo-epi': 'estoque.read',
  configuracoes: 'estoque.write',
}

function resolvePageByPath(pathname = '') {
  const normalized = pathname.trim().toLowerCase()
  return (
    PAGE_CATALOG.find((page) => page.paths?.some((path) => normalized === path.toLowerCase())) ||
    PAGE_CATALOG.find((page) => page.paths?.some((path) => normalized.startsWith(path.toLowerCase())))
  )
}

function canAccessPath(pathname, { permissions = [], isMaster = false } = {}) {
  const page = resolvePageByPath(pathname)
  if (!page) {
    return true
  }
  if (isMaster) {
    return true
  }
  const requiredPerm = PAGE_REQUIRED_PERMISSION[page.id]
  if (!requiredPerm) {
    return true
  }
  return Array.isArray(permissions) && permissions.includes(requiredPerm)
}

function resolveAllowedPaths({ permissions = [], isMaster = false } = {}) {
  if (isMaster) {
    return PAGE_CATALOG.flatMap((page) => page.paths || [])
  }
  const allowedPaths = PAGE_CATALOG.filter((page) => {
    const requiredPerm = PAGE_REQUIRED_PERMISSION[page.id]
    if (!requiredPerm) return true
    return permissions.includes(requiredPerm)
  }).flatMap((page) => page.paths || [])
  return Array.from(new Set(allowedPaths))
}

// Legado: usado por tela de configuracoes para preencher toggles. Mantem todos se nao houver restricao explicita.
function resolveAllowedPageIds(_credential, explicitPageIds = []) {
  if (Array.isArray(explicitPageIds) && explicitPageIds.length) {
    const norm = explicitPageIds.map((id) => (id || '').toString().trim().toLowerCase()).filter(Boolean)
    return Array.from(new Set(norm))
  }
  return ALL_PAGE_IDS
}

function describeCredential(value) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'master') return 'Master'
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'operador') return 'Operador'
  if (normalized === 'estagiario') return 'Estagiario'
  if (normalized === 'visitante') return 'Visitante'
  return normalized || 'Desconhecido'
}

const CREDENTIAL_OPTIONS = [
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Admin' },
  { value: 'operador', label: 'Operador' },
  { value: 'estagiario', label: 'Estagiario' },
  { value: 'visitante', label: 'Visitante' },
]

// Labels amigáveis para as chaves de permissão
const PERMISSION_LABELS = {
  'estoque.read': 'Estoque - Ler',
  'estoque.write': 'Estoque - Alterar',
  'estoque.dashboard': 'Dashboard Estoque',
  'acidentes.dashboard': 'Dashboard Acidentes',
  'estoque.entradas': 'Entradas',
  'estoque.saidas': 'Saidas',
  'estoque.materiais': 'Materiais',
  'estoque.termo': 'Termo de EPI',
  'pessoas.read': 'Pessoas - Ler',
  'pessoas.write': 'Pessoas - Alterar',
  'acidentes.read': 'Acidentes - Ler',
  'acidentes.write': 'Acidentes - Alterar',
  'hht.read': 'HHT - Ler historico',
  'hht.write': 'HHT - Alterar historico',
}

// Grupos de permissão (toggle único liga conjunto de chaves)
const PERMISSION_GROUPS = [
  { id: 'dashboard', label: 'Dashboard Estoque', keys: ['estoque.read', 'estoque.dashboard'] },
  { id: 'dashboard-acidentes', label: 'Dashboard Acidentes', keys: ['acidentes.read', 'acidentes.dashboard'] },
  { id: 'entradas', label: 'Entradas', keys: ['estoque.read', 'estoque.write', 'estoque.entradas'] },
  { id: 'saidas', label: 'Saidas', keys: ['estoque.read', 'estoque.write', 'estoque.saidas'] },
  { id: 'materiais', label: 'Materiais', keys: ['estoque.read', 'estoque.write', 'estoque.materiais'] },
  { id: 'termo-epi', label: 'Termo de EPI', keys: ['estoque.read', 'estoque.termo'] },
  { id: 'acidentes', label: 'Cadastro de Acidentes', keys: ['acidentes.read', 'acidentes.write'] },
  { id: 'estoque', label: 'Estoque', keys: ['estoque.read', 'estoque.write'] },
  { id: 'pessoas', label: 'Pessoas', keys: ['pessoas.read', 'pessoas.write'] },
  { id: 'hht', label: 'HHT', keys: ['hht.read', 'hht.write'] },
]

export {
  PAGE_CATALOG,
  PAGE_REQUIRED_PERMISSION,
  ALL_PAGE_IDS,
  resolvePageByPath,
  canAccessPath,
  resolveAllowedPaths,
  resolveAllowedPageIds,
  describeCredential,
  CREDENTIAL_OPTIONS,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
}
