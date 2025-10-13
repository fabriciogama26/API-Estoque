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

const isGrupoLocal = (value, target) => normalizeKeyPart(value) === normalizeKeyPart(target)

const sanitizeDigitsLocal = (value = '') => String(value).replace(/\D/g, '')

const buildNumeroEspecificoLocal = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupoLocal(grupoMaterial, 'Calçado')) {
    return sanitizeDigitsLocal(numeroCalcado)
  }
  if (isGrupoLocal(grupoMaterial, 'Vestimenta')) {
    return String(numeroVestimenta || '').trim()
  }
  return ''
}

const buildChaveUnicaLocal = ({ grupoMaterial, nome, fabricante, numeroEspecifico }) =>
  [
    normalizeKeyPart(grupoMaterial),
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(numeroEspecifico),
  ].join('||')

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
    const numeroVestimenta = isGrupoLocal(grupoMaterial, 'Vestimenta')
      ? String(material.numeroVestimenta || '').trim()
      : ''
    const numeroEspecifico =
      material.numeroEspecifico ??
      buildNumeroEspecificoLocal({
        grupoMaterial,
        numeroCalcado,
        numeroVestimenta,
      })
    const chaveUnica =
      material.chaveUnica ??
      buildChaveUnicaLocal({
        grupoMaterial,
        nome: material.nome || '',
        fabricante: material.fabricante || '',
        numeroEspecifico,
      })
    return {
      ...material,
      grupoMaterial,
      numeroCalcado,
      numeroVestimenta,
      numeroEspecifico,
      chaveUnica,
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
    return {
      ...acidente,
      centroServico,
      setor: acidente.setor ?? centroServico,
      local: acidente.local ?? centroServico,
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
