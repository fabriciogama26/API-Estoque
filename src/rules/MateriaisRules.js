import { parseCurrencyToNumber, sanitizeDigits } from '../utils/MateriaisUtils.js'

export const GRUPO_MATERIAL_CALCADO = 'Calcado'
export const GRUPO_MATERIAL_VESTIMENTA = 'Vestimenta'
export const GRUPO_MATERIAL_PROTECAO_MAOS = 'Proteção das Mãos'

const CARACTERISTICA_SEPARATOR = ';'

const normalizeKeyPart = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const normalizeGrupoValor = (value) => {
  const base = normalizeKeyPart(value)
  return base.endsWith('s') ? base.slice(0, -1) : base
}

const isGrupo = (value, grupoReferencia) =>
  normalizeGrupoValor(value) === normalizeGrupoValor(grupoReferencia)

const sanitizeAlphanumeric = (value = '') => String(value).trim()

const sanitizeMaterialNome = (value = '') => value.replace(/\d/g, '')

const requiresTamanho = (grupo) =>
  isGrupo(grupo, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(grupo, GRUPO_MATERIAL_PROTECAO_MAOS)

const normalizeCaracteristicaLista = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAlphanumeric(item))
      .map((item) => item.normalize?.('NFC') ?? item)
      .filter(Boolean)
  }
  const texto = String(value ?? '')
  if (!texto.trim()) {
    return []
  }

  return texto
    .split(/[;|,]/)
    .map((parte) => sanitizeAlphanumeric(parte))
    .filter(Boolean)
}

const ordenarCaracteristicas = (lista) =>
  Array.from(new Set(lista.map((item) => item.trim()))).sort((a, b) => a.localeCompare(b))

const buildCaracteristicaTexto = (value) =>
  ordenarCaracteristicas(normalizeCaracteristicaLista(value)).join(`${CARACTERISTICA_SEPARATOR} `)

const buildNumeroReferencia = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO)) {
    return numeroCalcado
  }
  if (requiresTamanho(grupoMaterial)) {
    return numeroVestimenta
  }
  return ''
}

const buildChaveUnica = ({
  nome,
  fabricante,
  grupoMaterial,
  numeroCalcado,
  numeroVestimenta,
  caracteristicaEpi,
  corMaterial,
  ca,
}) => {
  const partes = [
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(grupoMaterial),
  ]

  const numeroReferencia = normalizeKeyPart(numeroCalcado || numeroVestimenta)
  if (numeroReferencia) {
    partes.push(numeroReferencia)
  }

  const caracteristicas = ordenarCaracteristicas(normalizeCaracteristicaLista(caracteristicaEpi))
  if (caracteristicas.length) {
    partes.push(caracteristicas.map((item) => normalizeKeyPart(item)).filter(Boolean).join('||'))
  }

  const cor = normalizeKeyPart(corMaterial)
  if (cor) {
    partes.push(cor)
  }

  const caNormalizado = normalizeKeyPart(sanitizeDigits(ca))
  if (caNormalizado) {
    partes.push(caNormalizado)
  }

  return partes.join('||')
}

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateMaterialForm(form) {
  const nomeSanitizado = sanitizeMaterialNome(form.nome)
  if (!nomeSanitizado.trim()) {
    return 'Informe o nome do EPI (somente letras).'
  }
  if (/\d/.test(form.nome || '')) {
    return 'O campo EPI nao pode conter numeros.'
  }
  if (!form.grupoMaterial?.trim()) {
    return 'Selecione o grupo de material.'
  }

  if (isGrupo(form.grupoMaterial, GRUPO_MATERIAL_CALCADO)) {
    const numero = sanitizeDigits(form.numeroCalcado)
    if (!numero) {
      return 'Informe o numero do calcado.'
    }
  }

  if (requiresTamanho(form.grupoMaterial)) {
    if (!String(form.numeroVestimenta || '').trim()) {
      return 'Informe o tamanho.'
    }
  }

  if (!form.fabricante?.trim()) {
    return 'Informe o fabricante.'
  }

  const caracteristicas = normalizeCaracteristicaLista(form.caracteristicaEpi)
  if (!caracteristicas.length) {
    return 'Informe ao menos uma caracteristica.'
  }

  const validade = Number(form.validadeDias)
  if (!Number.isFinite(validade) || validade <= 0) {
    return 'Validade deve ser maior que zero.'
  }

  const valor = parseCurrencyToNumber(form.valorUnitario)
  if (!Number.isFinite(valor) || valor <= 0) {
    return 'Valor unitario deve ser maior que zero.'
  }

  return null
}

const buildMaterialPayload = (form) => {
  const grupoMaterial = form.grupoMaterial.trim()
  const numeroCalcadoRaw = sanitizeDigits(form.numeroCalcado)
  const numeroVestimentaRaw = sanitizeAlphanumeric(form.numeroVestimenta)
  const numeroCalcado = numeroCalcadoRaw ? String(numeroCalcadoRaw) : ''
  const numeroVestimenta = numeroVestimentaRaw
  const caracteristicaTexto = buildCaracteristicaTexto(form.caracteristicaEpi)
  const numeroEspecifico = buildNumeroReferencia({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  })
  const chaveUnica = buildChaveUnica({
    grupoMaterial,
    nome: form.nome,
    fabricante: form.fabricante,
    numeroCalcado,
    numeroVestimenta,
    caracteristicaEpi: caracteristicaTexto,
    corMaterial: form.corMaterial,
    ca: form.ca,
  })

  return {
    nome: sanitizeMaterialNome(form.nome).trim(),
    fabricante: form.fabricante.trim(),
    validadeDias: Number(form.validadeDias) || 0,
    ca: sanitizeDigits(form.ca),
    valorUnitario: parseCurrencyToNumber(form.valorUnitario),
    grupoMaterial,
    numeroCalcado: isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO) ? numeroCalcado : '',
    numeroVestimenta: requiresTamanho(grupoMaterial) ? numeroVestimenta : '',
    numeroEspecifico,
    chaveUnica,
    caracteristicaEpi: caracteristicaTexto,
    corMaterial: sanitizeAlphanumeric(form.corMaterial),
    descricao: sanitizeAlphanumeric(form.descricao),
  }
}

export function createMaterialPayload(form, usuarioCadastro) {
  const base = buildMaterialPayload(form)
  return {
    ...base,
    usuarioCadastro,
  }
}

export function updateMaterialPayload(form, usuarioResponsavel) {
  const base = buildMaterialPayload(form)
  return {
    ...base,
    usuarioResponsavel,
  }
}

export function filterMateriais(materiais, filters) {
  const termo = filters.termo.trim().toLowerCase()

  return materiais.filter((material) => {
    if (filters.status === 'ativos' && material.ativo === false) {
      return false
    }

    if (filters.status === 'inativos' && material.ativo !== false) {
      return false
    }

    if (!termo) {
      return true
    }

    const target = [
      material.nome,
      material.fabricante,
      material.ca,
      material.grupoMaterial,
      material.numeroCalcado,
      material.numeroVestimenta,
      material.caracteristicaEpi,
      material.corMaterial,
      material.descricao,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return target.includes(termo)
  })
}

export function sortMateriaisByNome(materiais) {
  return materiais.slice().sort((a, b) => a.nome.localeCompare(b.nome))
}

export function parseCaracteristicaEpi(value) {
  return ordenarCaracteristicas(normalizeCaracteristicaLista(value))
}
