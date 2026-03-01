const ROUTES = [
  { method: 'POST', path: '/api/auth/login', route: 'auth.login' },
  { method: 'POST', path: '/api/auth/recover', route: 'auth.recover' },
  { method: 'GET', path: '/api/auth/me', route: 'auth.me' },
  { method: 'POST', path: '/api/auth/reauth', route: 'auth.reauth' },
  { method: 'POST', path: '/api/auth/reset', route: 'auth.reset' },
  { method: 'POST', path: '/api/auth/password/change', route: 'auth.password_change' },
  { method: 'POST', path: '/api/pessoas', route: 'create.pessoa' },
  { method: 'POST', path: '/api/materiais', route: 'create.material' },
  { method: 'POST', path: '/api/acidentes', route: 'create.acidente' },
  { method: 'POST', path: '/api/entradas', route: 'create.entrada' },
  { method: 'POST', path: '/api/saidas', route: 'create.saida' },
  { method: 'GET', path: '/api/health', route: 'health.check' },
]

const normalizePath = (url) => {
  if (!url) return ''
  return String(url).split('?')[0]
}

export function resolveRoute(req) {
  const method = (req?.method || '').toUpperCase()
  const path = normalizePath(req?.url || '')
  const matched = ROUTES.find((item) => item.method === method && item.path === path)
  if (matched) {
    return matched.route
  }
  if (!method && !path) {
    return 'unknown'
  }
  return `${method || 'UNKNOWN'} ${path || 'unknown'}`
}
