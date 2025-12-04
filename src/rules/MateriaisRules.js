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

const normalizeSelectionKey = (value) => normalizeKeyPart(value || '')
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const normalizeSelectionItem = (item) => {
  if (item === null || item === undefined) {
    return null
  }
  if (typeof item === 'string' || typeof item === 'number') {
    const texto = sanitizeAlphanumeric(item)
    if (!texto) {
      return null
    }
    const valor = String(item).trim()
    return { id: valor, nome: texto }
  }
  if (typeof item === 'object') {
    const nomeBase = sanitizeAlphanumeric(
      item.nome ?? item.label ?? item.valor ?? item.value ?? item.texto ?? item.text ?? '',
    )
    const idBase =
      item.id ?? item.uuid ?? item.value ?? item.valor ?? item.nome ?? item.label ?? null
    const id = sanitizeAlphanumeric(idBase ?? nomeBase)
    const nome = nomeBase || id
    if (!nome) {
      return null
    }
    return { id, nome }
  }
  const texto = sanitizeAlphanumeric(String(item))
  if (!texto) {
    return null
  }
  const valor = String(item).trim()
  return { id: valor, nome: texto }
}

const mergeSelectionLists = (...sources) => {
  const itens = []
  sources.forEach((source) => {
    if (source === null || source === undefined || source === '') {
      return
    }
    if (Array.isArray(source)) {
      source.forEach((value) => {
        itens.push(value)
      })
      return
    }
    if (typeof source === 'string') {
      source
        .split(/[;|,]/)
        .map((parte) => sanitizeAlphanumeric(parte))
        .filter(Boolean)
        .forEach((parte) => itens.push(parte))
      return
    }
    itens.push(source)
  })

  const vistos = new Set()
  const normalizados = []

  itens
    .map((item) => normalizeSelectionItem(item))
    .filter(Boolean)
    .forEach((item) => {
      const chave = item.id ? `id:${item.id}` : `nome:${normalizeSelectionKey(item.nome)}`
      if (vistos.has(chave)) {
        return
      }
      vistos.add(chave)
      normalizados.push(item)
    })

  return normalizados.sort((a, b) => a.nome.localeCompare(b.nome))
}

const requiresTamanho = (grupo) =>
  isGrupo(grupo, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(grupo, GRUPO_MATERIAL_PROTECAO_MAOS)

const normalizeCaracteristicaLista = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) {
          return ''
        }
        if (typeof item === 'string') {
          const texto = sanitizeAlphanumeric(item)
          return texto.normalize?.('NFC') ?? texto
        }
        if (typeof item === 'object') {
          const textoBase =
            item.nome ?? item.label ?? item.valor ?? item.value ?? item.id ?? ''
          const texto = sanitizeAlphanumeric(textoBase)
          return texto.normalize?.('NFC') ?? texto
        }
        const texto = sanitizeAlphanumeric(String(item))
        return texto.normalize?.('NFC') ?? texto
      })
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

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateMaterialForm(form) {
  const nomeSanitizado = sanitizeMaterialNome(form.materialItemNome || form.nome)
  if (!nomeSanitizado.trim()) {
    return 'Informe o nome do EPI (somente letras).'
  }
  const nomeDisplay = form.materialItemNome || ''
  const isExistingEpi = UUID_REGEX.test(String(form.nome || ''))
  if (!isExistingEpi && /\d/.test(nomeDisplay)) {
    return 'O campo EPI nao pode conter numeros.'
  }
  const grupoMaterialNome = sanitizeAlphanumeric(
    form.grupoMaterialNome || form.grupoMaterial || '',
  )
  if (!form.grupoMaterialId && !grupoMaterialNome) {
    return 'Selecione o grupo de material.'
  }
  if (!form.nome) {
    return 'Selecione o EPI.'
  }

  if (isGrupo(grupoMaterialNome, GRUPO_MATERIAL_CALCADO)) {
    const numero = form.numeroCalcadoNome?.trim() || form.numeroCalcado?.trim() || ''
    if (!numero) {
      return 'Informe o numero do calcado.'
    }
  }

  if (requiresTamanho(grupoMaterialNome)) {
    const numeroVestimentaTexto =
      form.numeroVestimentaNome?.trim() || form.numeroVestimenta?.trim() || ''
    if (!numeroVestimentaTexto) {
      return 'Informe o tamanho.'
    }
  }

  const fabricanteNome = sanitizeAlphanumeric(form.fabricante || '')
  if (!form.fabricante && !fabricanteNome) {
    return 'Informe o fabricante.'
  }

  const caracteristicas = mergeSelectionLists(
    form.caracteristicaEpi,
    form.caracteristicas,
    form.caracteristicas_epi,
    form.caracteristicasIds,
  )
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
  const grupoMaterialNome = sanitizeAlphanumeric(
    form.grupoMaterialNome || form.grupoMaterial || '',
  )
  const grupoMaterialId = sanitizeAlphanumeric(form.grupoMaterialId || '')
  const grupoMaterial = grupoMaterialNome
  const numeroCalcadoId = form.numeroCalcado || ''
  const numeroCalcadoNome = sanitizeAlphanumeric(form.numeroCalcadoNome || '')
  const numeroVestimentaId = form.numeroVestimenta || ''
  const numeroVestimentaNome = sanitizeAlphanumeric(form.numeroVestimentaNome || '')
  const nomeTextoBruto = sanitizeAlphanumeric(
    form.materialItemNome || form.nomeItemRelacionado || '',
  )
  const nomeEpi = sanitizeMaterialNome(
    form.materialItemNome || form.nomeItemRelacionado || form.nome,
  ).trim()
  const nomeId = sanitizeAlphanumeric(form.nome)
  const caracteristicasSelecionadas = mergeSelectionLists(
    form.caracteristicaEpi,
    form.caracteristicas,
    form.caracteristicas_epi,
    form.caracteristicasIds,
  )
  const caracteristicaTexto = buildCaracteristicaTexto(
    caracteristicasSelecionadas.length ? caracteristicasSelecionadas : form.caracteristicaEpi,
  )
  const coresSelecionadas = mergeSelectionLists(form.cores, form.coresIds)
  const corPrincipal = coresSelecionadas[0]?.nome ?? form.corMaterial
  const fabricanteId = sanitizeAlphanumeric(form.fabricante || '')
  const fabricanteNome = sanitizeAlphanumeric(form.fabricanteNome || form.fabricante || '')
  const numeroEspecifico = buildNumeroReferencia({
    grupoMaterial: grupoMaterialNome,
    numeroCalcado: numeroCalcadoNome,
    numeroVestimenta: numeroVestimentaNome,
  })

  return {
    nome: nomeId,
    nomeItemRelacionado: nomeTextoBruto || nomeEpi,
    materialItemNome: nomeTextoBruto || nomeEpi,
    fabricante: fabricanteId || '',
    fabricanteNome: fabricanteNome.trim(),
    validadeDias: Number(form.validadeDias) || 0,
    ca: sanitizeDigits(form.ca),
    valorUnitario: parseCurrencyToNumber(form.valorUnitario),
    grupoMaterial,
    grupoMaterialNome,
    grupoMaterialId: grupoMaterialId || null,
    numeroCalcado: isGrupo(grupoMaterialNome, GRUPO_MATERIAL_CALCADO)
      ? numeroCalcadoId || null
      : null,
    numeroVestimenta: requiresTamanho(grupoMaterialNome) ? numeroVestimentaId || null : null,
    numeroEspecifico,
    caracteristicaEpi: caracteristicaTexto,
    corMaterial: sanitizeAlphanumeric(corPrincipal),
    caracteristicas: caracteristicasSelecionadas,
    caracteristicasIds: caracteristicasSelecionadas.map((item) => item.id).filter(Boolean),
    caracteristicas_epi: caracteristicasSelecionadas.map((item) => item.id).filter(Boolean),
    cores: coresSelecionadas,
    coresIds: coresSelecionadas.map((item) => item.id).filter(Boolean),
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

const normalizeSearchValue = (value) => normalizeKeyPart(value || '')

const tokenizeFilterValues = (value) => {
  if (value === null || value === undefined) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => tokenizeFilterValues(item))
  }

  if (typeof value === 'object') {
    const partes = [
      value.id,
      value.uuid,
      value.value,
      value.valor,
      value.nome,
      value.label,
      value.texto,
      value.text,
    ]
    return partes
      .map((parte) => (parte === null || parte === undefined ? '' : String(parte).trim()))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[;|,]/)
      .map((parte) => parte.trim())
      .filter(Boolean)
  }

  return [String(value)]
}

const matchesFilter = (filterValue, ...candidates) => {
  const alvo = normalizeSearchValue(filterValue)
  if (!alvo) {
    return true
  }

  const valores = []
  candidates.forEach((candidate) => {
    valores.push(...tokenizeFilterValues(candidate))
  })

  return valores.some((valor) => normalizeSearchValue(valor) === alvo)
}

export function filterMateriais(materiais, filters) {
  const termo = normalizeSearchValue(filters.termo)
  const minValor = Number.isFinite(Number(filters.valorMin)) ? Number(filters.valorMin) : null
  const maxValor = Number.isFinite(Number(filters.valorMax)) ? Number(filters.valorMax) : null

  return materiais.filter((material) => {
    if (filters.status === 'ativos' && material.ativo === false) {
      return false
    }

    if (filters.status === 'inativos' && material.ativo !== false) {
      return false
    }

    if (
      !matchesFilter(
        filters.grupo,
        material.grupoMaterialId,
        material.grupoMaterial,
        material.grupoMaterialNome,
      )
    ) {
      return false
    }

    if (
      !matchesFilter(
        filters.tamanho,
        material.numeroCalcado,
        material.numeroCalcadoNome,
        material.numeroVestimenta,
        material.numeroVestimentaNome,
        material.numeroEspecifico,
      )
    ) {
      return false
    }

    if (!matchesFilter(filters.fabricante, material.fabricante, material.fabricanteNome)) {
      return false
    }

    if (
      !matchesFilter(
        filters.caracteristica,
        material.caracteristicas,
        material.caracteristicasIds,
        material.caracteristicasNomes,
        material.caracteristicaEpi,
        material.caracteristicasTexto,
      )
    ) {
      return false
    }

    if (
      !matchesFilter(
        filters.cor,
        material.cores,
        material.coresIds,
        material.coresNomes,
        material.corMaterial,
        material.coresTexto,
      )
    ) {
      return false
    }

    if (minValor !== null || maxValor !== null) {
      const valor = Number(material.valorUnitario)
      const valido = !Number.isNaN(valor)
      if (minValor !== null && (!valido || valor < minValor)) {
        return false
      }
      if (maxValor !== null && (!valido || valor > maxValor)) {
        return false
      }
    }

    if (!termo) {
      return true
    }

    const target = [
      material.nome,
      material.nomeItemRelacionado,
      material.materialItemNome,
      material.fabricante,
      material.fabricanteNome,
      material.ca,
      material.grupoMaterial,
      material.grupoMaterialNome,
      material.numeroCalcado,
      material.numeroCalcadoNome,
      material.numeroVestimenta,
      material.numeroVestimentaNome,
      material.numeroEspecifico,
      material.caracteristicaEpi,
      material.caracteristicasTexto,
      ...(Array.isArray(material.caracteristicasNomes) ? material.caracteristicasNomes : []),
      material.corMaterial,
      material.coresTexto,
      ...(Array.isArray(material.coresNomes) ? material.coresNomes : []),
      material.descricao,
      material.usuarioCadastro,
      material.usuarioCadastroNome,
      material.usuarioCadastroUsername,
      material.usuarioAtualizacao,
      material.usuarioAtualizacaoNome,
      material.registradoPor,
    ]
      .filter(Boolean)
      .join(' ')

    return normalizeSearchValue(target).includes(termo)
  })
}

export function sortMateriaisByNome(materiais) {
  return materiais.slice().sort((a, b) => a.nome.localeCompare(b.nome))
}

export function parseCaracteristicaEpi(value) {
  return ordenarCaracteristicas(normalizeCaracteristicaLista(value))
}
