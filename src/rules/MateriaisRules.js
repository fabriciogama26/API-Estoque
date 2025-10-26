import { parseCurrencyToNumber, sanitizeDigits } from '../utils/MateriaisUtils.js'

export const GRUPO_MATERIAL_CALCADO = 'Calcado'
export const GRUPO_MATERIAL_VESTIMENTA = 'Vestimenta'

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

const buildNumeroEspecifico = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO)) {
    return numeroCalcado
  }
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_VESTIMENTA)) {
    return numeroVestimenta
  }
  return ''
}

const buildChaveUnica = ({ grupoMaterial, nome, fabricante, numeroEspecifico }) =>
  [
    normalizeKeyPart(grupoMaterial),
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(numeroEspecifico),
  ].join('||')

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

  if (isGrupo(form.grupoMaterial, GRUPO_MATERIAL_VESTIMENTA)) {
    if (!String(form.numeroVestimenta || '').trim()) {
      return 'Informe o numero da vestimenta.'
    }
  }

  if (!form.fabricante?.trim()) {
    return 'Informe o fabricante.'
  }

  const validade = Number(form.validadeDias)
  if (!Number.isFinite(validade) || validade <= 0) {
    return 'Validade deve ser maior que zero.'
  }

  const valor = parseCurrencyToNumber(form.valorUnitario)
  if (!Number.isFinite(valor) || valor <= 0) {
    return 'Valor unitario deve ser maior que zero.'
  }

  if (!sanitizeDigits(form.ca)) {
    return 'Informe o CA.'
  }

  return null
}

const buildMaterialPayload = (form) => {
  const grupoMaterial = form.grupoMaterial.trim()
  const numeroCalcadoRaw = sanitizeDigits(form.numeroCalcado)
  const numeroVestimentaRaw = sanitizeAlphanumeric(form.numeroVestimenta)
  const numeroCalcado = numeroCalcadoRaw ? String(numeroCalcadoRaw) : ''
  const numeroVestimenta = numeroVestimentaRaw
  const numeroEspecifico = buildNumeroEspecifico({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  })
  const chaveUnica = buildChaveUnica({
    grupoMaterial,
    nome: form.nome,
    fabricante: form.fabricante,
    numeroEspecifico,
  })

  return {
    nome: sanitizeMaterialNome(form.nome).trim(),
    fabricante: form.fabricante.trim(),
    validadeDias: Number(form.validadeDias) || 0,
    ca: sanitizeDigits(form.ca),
    valorUnitario: parseCurrencyToNumber(form.valorUnitario),
    grupoMaterial,
    numeroCalcado: isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO) ? numeroCalcado : '',
    numeroVestimenta: isGrupo(grupoMaterial, GRUPO_MATERIAL_VESTIMENTA) ? numeroVestimenta : '',
    numeroEspecifico,
    chaveUnica,
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
      material.numeroEspecifico,
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
