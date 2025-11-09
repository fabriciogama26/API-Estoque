import seedData from '../data/local-seed.json'
import { LOCAL_DATA_STORAGE_KEY } from '../config/runtime.js'

const STATE_VERSION = 1

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.slice() : []
}

const normalizeKeyPart = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const normalizeGrupoLocal = (value) => {
  const base = normalizeKeyPart(value)
  return base.endsWith('s') ? base.slice(0, -1) : base
}

const isGrupoLocal = (value, target) => normalizeGrupoLocal(value) === normalizeGrupoLocal(target)

const sanitizeDigitsLocal = (value = '') => String(value).replace(/\D/g, '')

const requiresTamanhoLocal = (grupoMaterial) =>
  isGrupoLocal(grupoMaterial, 'Vestimenta') || isGrupoLocal(grupoMaterial, 'Proteção das Mãos')

const normalizeCaracteristicaListaLocal = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) {
          return ''
        }
        if (typeof item === 'string') {
          return item.trim()
        }
        if (typeof item === 'object') {
          return String(
            item.nome ?? item.label ?? item.valor ?? item.value ?? item.descricao ?? item.id ?? '',
          ).trim()
        }
        return String(item).trim()
      })
      .filter(Boolean)
  }
  const texto = String(value ?? '')
  if (!texto.trim()) {
    return []
  }
  return texto
    .split(/[;|,]/)
    .map((parte) => String(parte).trim())
    .filter(Boolean)
}

const formatCaracteristicaTextoLocal = (value) =>
  Array.from(new Set(normalizeCaracteristicaListaLocal(value)))
    .sort((a, b) => a.localeCompare(b))
    .join('; ')

const buildNumeroEspecificoLocal = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupoLocal(grupoMaterial, 'Calçado')) {
    return sanitizeDigitsLocal(numeroCalcado)
  }
  if (requiresTamanhoLocal(grupoMaterial)) {
    return String(numeroVestimenta || '').trim()
  }
  return ''
}

const buildLocalOptionId = (prefix, nome, index = 0) => {
  const base = normalizeKeyPart(nome)
  if (!base) {
    return `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`
  }
  return `${prefix}-${base}`
}

const normalizeOptionArrayLocal = (value, prefix) => {
  const lista = Array.isArray(value) ? value : value ? [value] : []
  const vistos = new Set()
  const resultado = []
  lista.forEach((item, index) => {
    if (item === null || item === undefined) {
      return
    }
    if (typeof item === 'string') {
      const nome = item.trim()
      if (!nome) {
        return
      }
      const id = buildLocalOptionId(prefix, nome, index)
      const chave = `${prefix}-${id}`
      if (!vistos.has(chave)) {
        vistos.add(chave)
        resultado.push({ id, nome })
      }
      return
    }
    if (typeof item === 'object') {
      const nome = String(
        item.nome ?? item.label ?? item.valor ?? item.value ?? item.cor ?? item.descricao ?? '',
      ).trim()
      if (!nome) {
        return
      }
      const idBase = item.id ?? item.uuid ?? item.value ?? item.valor ?? null
      const id = idBase ?? buildLocalOptionId(prefix, nome, index)
      const chave = `${prefix}-${id}`
      if (!vistos.has(chave)) {
        vistos.add(chave)
        resultado.push({ id, nome })
      }
    }
  })
  return resultado
}

function getDefaultState() {
  return {
    version: STATE_VERSION,
    pessoas: [],
    materiais: [],
    entradas: [],
    saidas: [],
    acidentes: [],
    materialPriceHistory: [],
  }
}

function normalizeState(state) {
  const base = getDefaultState()
  const sanitized = { ...base, ...state }
  sanitized.version = STATE_VERSION
  sanitized.pessoas = normalizeArray(sanitized.pessoas).map((pessoa) => {
    if (!pessoa || typeof pessoa !== 'object') {
      return pessoa
    }
    const centroServico = pessoa.centroServico ?? pessoa.local ?? ''
    return {
      ...pessoa,
      centroServico,
      local: pessoa.local ?? centroServico,
    }
  })
  sanitized.materiais = normalizeArray(sanitized.materiais).map((material) => {
    if (!material || typeof material !== 'object') {
      return material
    }
    const grupoMaterial = material.grupoMaterial ?? ''
    const numeroCalcado = isGrupoLocal(grupoMaterial, 'Calçado')
      ? sanitizeDigitsLocal(material.numeroCalcado)
      : ''
    const numeroVestimenta = requiresTamanhoLocal(grupoMaterial)
      ? String(material.numeroVestimenta || '').trim()
      : ''
    const caracteristicasLista = normalizeOptionArrayLocal(
      Array.isArray(material.caracteristicas)
        ? material.caracteristicas
        : normalizeCaracteristicaListaLocal(material.caracteristicaEpi),
      'caracteristica',
    )
    const caracteristicaEpi = formatCaracteristicaTextoLocal(
      caracteristicasLista.length
        ? caracteristicasLista.map((item) => item.nome)
        : material.caracteristicaEpi,
    )
    const coresLista = normalizeOptionArrayLocal(
      Array.isArray(material.cores) ? material.cores : material.corMaterial ? [material.corMaterial] : [],
      'cor',
    )
    const corMaterial =
      coresLista.length > 0
        ? coresLista.map((item) => item.nome).join('; ')
        : String(material.corMaterial || '').trim()
    const ca = material.ca ?? ''
    const numeroEspecifico =
      material.numeroEspecifico ??
      buildNumeroEspecificoLocal({
        grupoMaterial,
        numeroCalcado,
        numeroVestimenta,
      })
    return {
      ...material,
      grupoMaterial,
      numeroCalcado,
      numeroVestimenta,
      numeroEspecifico,
      caracteristicaEpi,
      caracteristicas: caracteristicasLista,
      caracteristicasIds: caracteristicasLista.map((item) => item.id).filter(Boolean),
      corMaterial,
      cores: coresLista,
      coresIds: coresLista.map((item) => item.id).filter(Boolean),
    }
  })
  sanitized.entradas = normalizeArray(sanitized.entradas).map((entrada) => {
    if (!entrada || typeof entrada !== 'object') {
      return entrada
    }
    return {
      ...entrada,
      centroCusto: entrada.centroCusto ?? '',
      centroServico: entrada.centroServico ?? '',
    }
  })
  sanitized.saidas = normalizeArray(sanitized.saidas).map((saida) => {
    if (!saida || typeof saida !== 'object') {
      return saida
    }
    return {
      ...saida,
      centroCusto: saida.centroCusto ?? '',
      centroServico: saida.centroServico ?? '',
    }
  })
  sanitized.acidentes = normalizeArray(sanitized.acidentes).map((acidente) => {
    if (!acidente || typeof acidente !== 'object') {
      return acidente
    }
    const centroServico = acidente.centroServico ?? acidente.setor ?? ''
    const historicoEdicao = Array.isArray(acidente.historicoEdicao) ? acidente.historicoEdicao.slice() : []
    const lesoes =
      Array.isArray(acidente.lesoes) && acidente.lesoes.length > 0
        ? acidente.lesoes.map((lesao) => (lesao && String(lesao).trim()) || '').filter(Boolean)
        : acidente.lesao
        ? [String(acidente.lesao).trim()].filter(Boolean)
        : []
    const partes =
      Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length > 0
        ? acidente.partesLesionadas.map((parte) => (parte && String(parte).trim()) || '').filter(Boolean)
        : acidente.parteLesionada
        ? [String(acidente.parteLesionada).trim()].filter(Boolean)
        : []
    return {
      ...acidente,
      centroServico,
      setor: acidente.setor ?? centroServico,
      local: acidente.local ?? centroServico,
      lesoes,
      lesao: lesoes[0] ?? acidente.lesao ?? '',
      partesLesionadas: partes,
      parteLesionada: partes[0] ?? acidente.parteLesionada ?? '',
      historicoEdicao,
    }
  })
  sanitized.materialPriceHistory = normalizeArray(sanitized.materialPriceHistory)
  return sanitized
}

function readFromStorage() {
  if (!isBrowser) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    if (Number(parsed.version) !== STATE_VERSION) {
      return null
    }
    return normalizeState(parsed)
  } catch (error) {
    console.warn('Falha ao ler armazenamento local. Recriando dados.', error)
    return null
  }
}

function applySeed(base) {
  const seeded = { ...base }
  if (seedData && typeof seedData === 'object') {
    const keys = ['pessoas', 'materiais', 'entradas', 'saidas', 'acidentes', 'materialPriceHistory']
    keys.forEach((key) => {
      if (Array.isArray(seedData[key]) && seedData[key].length > 0) {
        seeded[key] = normalizeArray(seedData[key])
      }
    })
  }
  return seeded
}

function persist(state) {
  if (!isBrowser) {
    return
  }
  try {
    window.localStorage.setItem(LOCAL_DATA_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Falha ao salvar dados locais.', error)
  }
}

let cache = null

function loadInitialState() {
  const persisted = readFromStorage()
  if (persisted) {
    return persisted
  }
  const seeded = applySeed(getDefaultState())
  persist(seeded)
  return seeded
}

function getState() {
  if (!cache) {
    cache = loadInitialState()
  }
  return cache
}

export function readState(selector) {
  const snapshot = deepClone(getState())
  if (typeof selector === 'function') {
    return selector(snapshot)
  }
  return snapshot
}

export function writeState(updater) {
  const draft = deepClone(getState())
  const result = typeof updater === 'function' ? updater(draft) : null
  cache = normalizeState(draft)
  persist(cache)
  return result
}

export function resetState(nextState) {
  const base = nextState ? normalizeState(nextState) : getDefaultState()
  cache = base
  persist(cache)
  return deepClone(cache)
}
