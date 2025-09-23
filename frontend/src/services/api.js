const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function request(path, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  }

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE}${path}`, config)

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return null
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON', error)
    return null
  }
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json()
    return data?.error || data?.message || response.statusText
  } catch (error) {
    return response.statusText
  }
}

export const api = {
  auth: {
    login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  },
  health: () => request('/api/health'),
  pessoas: {
    list: () => request('/api/pessoas'),
    create: (payload) => request('/api/pessoas', { method: 'POST', body: payload }),
    get: (id) => request(`/api/pessoas/${id}`),
  },
  materiais: {
    list: () => request('/api/materiais'),
    create: (payload) => request('/api/materiais', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/api/materiais/${id}`, { method: 'PUT', body: payload }),
    priceHistory: (id) => request(`/api/materiais/${id}/historico-precos`),
  },
  entradas: {
    list: () => request('/api/entradas'),
    create: (payload) => request('/api/entradas', { method: 'POST', body: payload }),
  },
  saidas: {
    list: () => request('/api/saidas'),
    create: (payload) => request('/api/saidas', { method: 'POST', body: payload }),
  },
  estoque: {
    current: (params = {}) => {
      const query = buildQuery(params)
      return request(`/api/estoque${query}`)
    },
    dashboard: (params = {}) => {
      const query = buildQuery(params)
      return request(`/api/estoque/dashboard${query}`)
    },
  },
}

function buildQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) {
    return ''
  }
  const search = new URLSearchParams()
  entries.forEach(([key, value]) => {
    search.set(key, value)
  })
  return `?${search.toString()}`
}
