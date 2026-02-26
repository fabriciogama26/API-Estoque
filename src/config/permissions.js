const PAGE_CATALOG = [
  { id: 'dashboard', label: 'Dashboard Estoque', paths: ['/', '/dashboard'] },
  { id: 'dashboard-analise-estoque', label: 'Analise de Estoque', paths: ['/analise-estoque'] },
  { id: 'dashboard-acidentes', label: 'Dashboard Acidentes', paths: ['/dashboard/acidentes'] },
  { id: 'estoque', label: 'Estoque Atual', paths: ['/estoque'] },
  { id: 'entradas', label: 'Entradas', paths: ['/entradas', '/movimentacoes/entradas'] },
  { id: 'saidas', label: 'Saidas', paths: ['/saidas', '/movimentacoes/saidas'] },
  { id: 'cadastros-pessoas', label: 'Pessoas', paths: ['/cadastros/pessoas'] },
  { id: 'cadastros-materiais', label: "EPI's", paths: ['/cadastros/materiais'] },
  { id: 'cadastros-base', label: 'Cadastro Base', paths: ['/cadastros/base'] },
  { id: 'acidentes-cadastro', label: 'Cadastro de Acidentes', paths: ['/acidentes/cadastro'] },
  { id: 'acidentes-hht-mensal', label: 'HHT Mensal', paths: ['/acidentes/hht-mensal'] },
  { id: 'termo-epi', label: 'Termo de EPI', paths: ['/documentos/termo-epi', '/termos/epi'] },
  { id: 'relatorio-estoque', label: 'Relatorio de Estoque', paths: ['/relatorios/estoque'] },
  { id: 'configuracoes', label: 'Configuracoes', paths: ['/configuracoes'] },
  { id: 'no-access', label: 'Sem acesso', paths: ['/sem-acesso'] },
]

const ALL_PAGE_IDS = PAGE_CATALOG.map((page) => page.id)

// Mapeia cada pagina para a permission key necessária (leitura). Paginas sem mapeamento liberam por default.
const PAGE_REQUIRED_PERMISSION = {
  dashboard: 'estoque.dashboard',
  'dashboard-analise-estoque': 'dashboard_analise_estoque',
  'dashboard-acidentes': 'acidentes.dashboard',
  estoque: 'estoque.atual',
  entradas: 'estoque.entradas',
  saidas: 'estoque.saidas',
  'cadastros-pessoas': 'pessoas.write',
  'cadastros-materiais': 'estoque.materiais',
  'cadastros-base': 'basic_registration.write',
  'acidentes-cadastro': 'acidentes.write',
  'acidentes-hht-mensal': 'hht.write',
  'termo-epi': 'estoque.termo',
  'relatorio-estoque': 'estoque.relatorio',
  configuracoes: 'rbac.manage',
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
  'estoque.atual': 'Estoque Atual',
  'dashboard_analise_estoque': 'Dashboard Analise de Estoque',
  'acidentes.dashboard': 'Dashboard Acidentes',
  'estoque.entradas': 'Entradas',
  'estoque.saidas': 'Saidas',
  'estoque.materiais': 'Materiais',
  'estoque.termo': 'Termo de EPI',
  'estoque.relatorio': 'Relatorio de Estoque',
  'estoque.reprocessar': 'Estoque - Reprocessar previsao',
  'pessoas.read': 'Pessoas - Ler',
  'pessoas.write': 'Pessoas - Alterar',
  'acidentes.read': 'Acidentes - Ler',
  'acidentes.write': 'Acidentes - Alterar',
  'hht.read': 'HHT - Ler historico',
  'hht.write': 'HHT - Alterar historico',
  'basic_registration.read': 'Cadastro base - Ler',
  'basic_registration.write': 'Cadastro base - Alterar',
}

// Grupos de permissão (toggle único liga conjunto de chaves)
const PERMISSION_GROUPS = [
  { id: 'dashboard', label: 'Dashboard Estoque', keys: ['estoque.dashboard'] },
  { id: 'dashboard-analise-estoque', label: 'Analise de Estoque', keys: ['dashboard_analise_estoque'] },
  { id: 'dashboard-acidentes', label: 'Dashboard Acidentes', keys: ['acidentes.dashboard'] },
  { id: 'estoque', label: 'Estoque Atual', keys: ['estoque.atual'] },
  { id: 'entradas', label: 'Entradas', keys: ['estoque.entradas'] },
  { id: 'saidas', label: 'Saidas', keys: ['estoque.saidas'] },
  { id: 'materiais', label: 'Materiais', keys: ['estoque.materiais'] },
  { id: 'termo-epi', label: 'Termo de EPI', keys: ['estoque.termo'] },
  { id: 'relatorio-estoque', label: 'Relatorio de Estoque', keys: ['estoque.relatorio'] },
  { id: 'estoque-reprocessar', label: 'Reprocessar previsao', keys: ['estoque.reprocessar'] },
  { id: 'acidentes', label: 'Cadastro de Acidentes', keys: ['acidentes.read', 'acidentes.write'] },
  { id: 'hht', label: 'HHT Mensal', keys: ['hht.read', 'hht.write'] },
  { id: 'pessoas', label: 'Pessoas', keys: ['pessoas.read', 'pessoas.write'] },
  { id: 'cadastro-base', label: 'Cadastro Base', keys: ['basic_registration.read', 'basic_registration.write'] },
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
