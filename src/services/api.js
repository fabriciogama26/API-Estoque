import { supabase } from './supabaseClient.js'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function getAccessToken() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }
  const token = data?.session?.access_token
  if (!token) {
    const err = new Error('Sessão expirada. Faça login novamente.')
    err.status = 401
    throw err
  }
  return token
}

async function request(path, options = {}) {
  const token = await getAccessToken()

  const config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    ...options,
  }

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE}${path}`, config)

  if (response.status === 401) {
    const error = new Error('Sessão expirada. Faça login novamente.')
    error.status = 401
    throw error
  }

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
    console.error('Falha ao interpretar JSON da API', error)
    return null
  }
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json()
    return data?.error || data?.message || response.statusText
  } catch {
    return response.statusText
  }
}

function buildQuery(params) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  )
  if (!entries.length) {
    return ''
  }
  const search = new URLSearchParams()
  entries.forEach(([key, value]) => {
    search.set(key, value)
  })
  return `?${search.toString()}`
}

export const api = {
  health: () => request('/api/health'),
  pessoas: {
    list: () => request('/api/pessoas'),
    create: (payload) => request('/api/pessoas', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/api/pessoas/${id}`, { method: 'PUT', body: payload }),
    get: (id) => request(`/api/pessoas/${id}`),
    history: (id) => request(`/api/pessoas/${id}/historico-edicoes`),
  },
  materiais: {
    list: () => request('/api/materiais'),
    create: (payload) => request('/api/materiais', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/api/materiais/${id}`, { method: 'PUT', body: payload }),
    get: (id) => request(`/api/materiais/${id}`),
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
  acidentes: {
    list: () => request('/api/acidentes'),
    create: (payload) => request('/api/acidentes', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/api/acidentes/${id}`, { method: 'PUT', body: payload }),
  },
}
