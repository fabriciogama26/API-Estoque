// Utilitarios de validacao, normalizacao e filtros para acidentes

const integerOrNull = (value) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = String(value).trim()
  if (!trimmed) {
    return null
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const splitTextList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
      .filter(Boolean)
  }
  if (value === undefined || value === null) {
    return []
  }
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const collectTextList = (...inputs) => {
  const lista = []
  const vistos = new Set()
  inputs.forEach((input) => {
    if (input === undefined || input === null) {
      return
    }
    const valores = Array.isArray(input) ? input : splitTextList(input)
    valores.forEach((valor) => {
      const texto = (valor === undefined || valor === null ? '' : String(valor).trim())
      if (!texto) {
        return
      }
      const chave = texto.toLowerCase()
      if (vistos.has(chave)) {
        return
      }
      vistos.add(chave)
      lista.push(texto)
    })
  })
  return lista
}

const normalizeDateTimeValue = (value) => {
  if (value === undefined || value === null) {
    return null
  }
  const texto = String(value).trim()
  if (!texto) {
    return null
  }
  const date = new Date(texto)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

const normalizeBooleanValue = (value) => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const texto = value.trim().toLowerCase()
    if (['true', '1', 'sim', 'yes', 'on'].includes(texto)) {
      return true
    }
    if (['false', '0', 'nao', 'não', 'off'].includes(texto)) {
      return false
    }
  }
  return Boolean(value)
}

const normalizeTextValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const normalizeCatValue = (value) => normalizeTextValue(value).replace(/\s+/g, '')

const normalizeCidValue = (value) => normalizeTextValue(value).replace(/\s+/g, '').toUpperCase()

const normalizeDateKey = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const hasDuplicateAcidenteField = (acidentes, field, value, editingId) => {
  if (!value) {
    return false
  }
  const lista = Array.isArray(acidentes) ? acidentes : []
  return lista.some((acidente) => {
    if (!acidente || !acidente.id) {
      return false
    }
    if (editingId && acidente.id === editingId) {
      return false
    }
    const raw = acidente[field] ?? ''
    return value === raw
  })
}

export const findDuplicateAcidenteByMatriculaData = (acidentes, form, editingId) => {
  if (!form) {
    return null
  }
  const dateKey = normalizeDateKey(form.data)
  if (!dateKey) {
    return null
  }
  const pessoaId = normalizeTextValue(form.pessoaId ?? form.pessoa_id)
  const matricula = normalizeTextValue(form.matricula)
  if (!pessoaId && !matricula) {
    return null
  }
  const lista = Array.isArray(acidentes) ? acidentes : []
  return (
    lista.find((acidente) => {
      if (!acidente || !acidente.id) {
        return false
      }
      if (editingId && acidente.id === editingId) {
        return false
      }
      const acidenteDateKey = normalizeDateKey(acidente.data)
      if (!acidenteDateKey || acidenteDateKey !== dateKey) {
        return false
      }
      if (pessoaId && acidente.pessoaId) {
        return String(acidente.pessoaId) === pessoaId
      }
      if (matricula) {
        return String(acidente.matricula ?? '') === matricula
      }
      return false
    }) || null
  )
}

const buildClassificacoesAgentes = (input) => {
  const lista = Array.isArray(input) ? input : []
  const agentesIds = []
  const tiposIds = []
  const lesoesIds = []
  const agentesNomes = []
  const tiposNomes = []
  const lesoesNomes = []
  const agentesSet = new Set()
  const tiposSet = new Set()
  const lesoesSet = new Set()

  lista.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }
    const agenteId = normalizeTextValue(item.agenteId ?? item.agente_id)
    const agenteNome = normalizeTextValue(item.agenteNome ?? item.agente_nome ?? item.agente)
    if (!agenteId && !agenteNome) {
      return
    }
    agentesIds.push(agenteId || null)
    tiposIds.push(normalizeTextValue(item.tipoId ?? item.tipo_id) || null)
    lesoesIds.push(normalizeTextValue(item.lesaoId ?? item.lesao_id) || null)

    if (agenteNome) {
      const chave = agenteNome.toLowerCase()
      if (!agentesSet.has(chave)) {
        agentesSet.add(chave)
        agentesNomes.push(agenteNome)
      }
    }
    const tipoNome = normalizeTextValue(item.tipoNome ?? item.tipo_nome ?? item.tipo)
    if (tipoNome) {
      const chave = tipoNome.toLowerCase()
      if (!tiposSet.has(chave)) {
        tiposSet.add(chave)
        tiposNomes.push(tipoNome)
      }
    }
    const lesaoNome = normalizeTextValue(item.lesaoNome ?? item.lesao_nome ?? item.lesao)
    if (lesaoNome) {
      const chave = lesaoNome.toLowerCase()
      if (!lesoesSet.has(chave)) {
        lesoesSet.add(chave)
        lesoesNomes.push(lesaoNome)
      }
    }
  })

  return {
    agentesIds,
    tiposIds,
    lesoesIds,
    agentesNomes,
    tiposNomes,
    lesoesNomes,
    lista,
  }
}

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateAcidenteForm(form, acidentes = [], editingId = null) {
  const centroServico = form.centroServico?.trim() || form.setor?.trim() || ''
  const local = form.local?.trim() || ''
  const classificacoes = Array.isArray(form.classificacoesAgentes) ? form.classificacoesAgentes : []
  const classificacoesValidas = classificacoes.filter((item) => {
    const agenteId = normalizeTextValue(item?.agenteId ?? item?.agente_id)
    return Boolean(agenteId)
  })
  const temTipoOuLesao = classificacoesValidas.some((item) => {
    const tipo = normalizeTextValue(item?.tipoId ?? item?.tipo_id ?? item?.tipoNome ?? item?.tipo_nome ?? item?.tipo)
    const lesao = normalizeTextValue(item?.lesaoId ?? item?.lesao_id ?? item?.lesaoNome ?? item?.lesao_nome ?? item?.lesao)
    return Boolean(tipo || lesao)
  })
  const partesSelecionadas =
    Array.isArray(form.partesIds) && form.partesIds.length
      ? form.partesIds.filter(Boolean)
      : Array.isArray(form.partesLesionadas)
      ? form.partesLesionadas.filter((item) => item && item.trim())
      : form.parteLesionada
      ? [form.parteLesionada.trim()]
      : []
  const agentesSelecionados = classificacoesValidas.length ? classificacoesValidas : []

  if (!form.nome.trim()) {
    return 'Informe o nome do colaborador.'
  }
  if (!form.matricula.trim()) {
    return 'Informe a matricula.'
  }
  if (!form.cargo.trim()) {
    return 'Informe o cargo.'
  }
  if (!form.data) {
    return 'Selecione a data do acidente.'
  }
  if (!normalizeDateTimeValue(form.data)) {
    return 'Informe uma data valida para o acidente.'
  }
  if (!agentesSelecionados.length) {
    return 'Informe ao menos um agente do acidente.'
  }
  if (!temTipoOuLesao) {
    return 'Informe ao menos um tipo ou lesao.'
  }
  if (partesSelecionadas.length === 0) {
    return 'Informe ao menos uma parte lesionada.'
  }
  if (!centroServico) {
    return 'Informe o centro de servico.'
  }
  if (!local) {
    return 'Selecione o local do acidente.'
  }

  const hasDiasPerdidos = String(form.diasPerdidos ?? '').trim() !== ''
  if (!hasDiasPerdidos) {
    return 'Informe os dias perdidos.'
  }

  const diasPerdidos = integerOrNull(form.diasPerdidos)
  if (diasPerdidos === null) {
    return 'Dias perdidos deve ser um numero inteiro.'
  }
  if (diasPerdidos !== null && diasPerdidos < 0) {
    return 'Dias perdidos nao pode ser negativo.'
  }

  const hasDiasDebitados = String(form.diasDebitados ?? '').trim() !== ''
  if (!hasDiasDebitados) {
    return 'Informe os dias debitados.'
  }

  const diasDebitados = integerOrNull(form.diasDebitados)
  if (diasDebitados === null) {
    return 'Dias debitados deve ser um numero inteiro.'
  }
  if (diasDebitados !== null && diasDebitados < 0) {
    return 'Dias debitados nao pode ser negativo.'
  }

  const cat = form.cat.trim()
  if (cat && !/^\d+$/.test(cat)) {
    return 'CAT deve conter apenas numeros inteiros.'
  }

  const catNormalizado = normalizeCatValue(form.cat)
  if (catNormalizado) {
    const catDuplicado = hasDuplicateAcidenteField(
      acidentes.map((acidente) => ({
        ...acidente,
        catNormalized: normalizeCatValue(acidente.cat ?? acidente.cat_number ?? ''),
      })),
      'catNormalized',
      catNormalizado,
      editingId,
    )
    if (catDuplicado) {
      return 'CAT ja cadastrada em outro acidente.'
    }
  }

  return null
}

const sanitizeCentroServico = (value) => {
  const trimmed = value?.trim() || ''
  return trimmed
}

export function createAcidentePayload(form, usuarioCadastro) {
  const centroServico = sanitizeCentroServico(form.centroServico || form.setor)
  const local = form.local?.trim() || centroServico
  const pessoaId = form.pessoaId || null
  const centroServicoId = form.centroServicoId || null
  const localId = form.localId || null
  const classificacoesInfo = buildClassificacoesAgentes(form.classificacoesAgentes)
  const agenteId = classificacoesInfo.agentesIds.find(Boolean) || form.agenteId || null
  const agentesIds = classificacoesInfo.agentesIds.length
    ? classificacoesInfo.agentesIds
    : Array.isArray(form.agenteId)
    ? form.agenteId
    : form.agenteId
    ? [form.agenteId]
    : []
  const tiposIds = classificacoesInfo.tiposIds.length
    ? classificacoesInfo.tiposIds
    : Array.isArray(form.tiposIds)
    ? form.tiposIds.filter(Boolean)
    : []
  const lesoesIds = classificacoesInfo.lesoesIds.length
    ? classificacoesInfo.lesoesIds
    : Array.isArray(form.lesoesIds)
    ? form.lesoesIds.filter(Boolean)
    : []
  const partesIds = Array.isArray(form.partesIds) ? form.partesIds.filter(Boolean) : []
  const lesoes = []
  const addLesao = (valor) => {
    const nome = (valor ?? '').trim()
    if (!nome) {
      return
    }
    const chave = nome.toLowerCase()
    if (lesoes.some((item) => item.toLowerCase() === chave)) {
      return
    }
    lesoes.push(nome)
  }
  if (classificacoesInfo.lesoesNomes.length) {
    classificacoesInfo.lesoesNomes.forEach(addLesao)
  }
  if (Array.isArray(form.lesoes)) {
    form.lesoes.forEach(addLesao)
  }
  addLesao(form.lesao)
  const agentesSelecionados =
    classificacoesInfo.agentesNomes.length > 0
      ? classificacoesInfo.agentesNomes
      : collectTextList(form.agentes, form.agente)
  const tiposSelecionados =
    classificacoesInfo.tiposNomes.length > 0
      ? classificacoesInfo.tiposNomes
      : collectTextList(form.tipos, form.tipo)
  const agentePrincipal = agentesSelecionados[agentesSelecionados.length - 1] ?? ''
  const tipoPrincipal = tiposSelecionados[0] ?? ''
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []
  const observacao = typeof form.observacao === 'string' ? form.observacao.trim() : ''
  const dataNormalizada = normalizeDateTimeValue(form.data)
  const dataEsocial = normalizeDateTimeValue(form.dataEsocial)
  const sesmt = normalizeBooleanValue(form.sesmt)
  const dataSesmt = normalizeDateTimeValue(form.dataSesmt)

  return {
    pessoaId,
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: dataNormalizada,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    tipo: tiposSelecionados.join('; '),
    tipoPrincipal,
    agente: agentesSelecionados.join('; '),
    agentePrincipal,
    cid: form.cid.trim(),
    lesoes,
    lesao: lesoes[0] || '',
    parteLesionada: partes[0] || '',
    partesLesionadas: partes,
    centroServico,
    setor: centroServico,
    local,
    centroServicoId,
    localId,
    agenteId,
    agentesIds,
    tiposIds,
    lesoesIds,
    partesIds,
    cat: form.cat.trim(),
    observacao,
    usuarioCadastro,
    classificacoesAgentes: Array.isArray(form.classificacoesAgentes) ? form.classificacoesAgentes : [],
    dataEsocial,
    sesmt,
    dataSesmt,
  }
}

export function updateAcidentePayload(form, usuarioResponsavel) {
  const centroServico = sanitizeCentroServico(form.centroServico || form.setor)
  const local = form.local?.trim() || centroServico
  const pessoaId = form.pessoaId || null
  const centroServicoId = form.centroServicoId || null
  const localId = form.localId || null
  const classificacoesInfo = buildClassificacoesAgentes(form.classificacoesAgentes)
  const agenteId = classificacoesInfo.agentesIds.find(Boolean) || form.agenteId || null
  const agentesIds = classificacoesInfo.agentesIds.length
    ? classificacoesInfo.agentesIds
    : Array.isArray(form.agenteId)
    ? form.agenteId
    : form.agenteId
    ? [form.agenteId]
    : []
  const tiposIds = classificacoesInfo.tiposIds.length
    ? classificacoesInfo.tiposIds
    : Array.isArray(form.tiposIds)
    ? form.tiposIds.filter(Boolean)
    : []
  const lesoesIds = classificacoesInfo.lesoesIds.length
    ? classificacoesInfo.lesoesIds
    : Array.isArray(form.lesoesIds)
    ? form.lesoesIds.filter(Boolean)
    : []
  const partesIds = Array.isArray(form.partesIds) ? form.partesIds.filter(Boolean) : []
  const lesoes = []
  const addLesao = (valor) => {
    const nome = (valor ?? '').trim()
    if (!nome) {
      return
    }
    const chave = nome.toLowerCase()
    if (lesoes.some((item) => item.toLowerCase() === chave)) {
      return
    }
    lesoes.push(nome)
  }
  if (classificacoesInfo.lesoesNomes.length) {
    classificacoesInfo.lesoesNomes.forEach(addLesao)
  }
  if (Array.isArray(form.lesoes)) {
    form.lesoes.forEach(addLesao)
  }
  addLesao(form.lesao)
  const agentesSelecionados =
    classificacoesInfo.agentesNomes.length > 0
      ? classificacoesInfo.agentesNomes
      : collectTextList(form.agentes, form.agente)
  const tiposSelecionados =
    classificacoesInfo.tiposNomes.length > 0
      ? classificacoesInfo.tiposNomes
      : collectTextList(form.tipos, form.tipo)
  const agentePrincipal = agentesSelecionados[agentesSelecionados.length - 1] ?? ''
  const tipoPrincipal = tiposSelecionados[0] ?? ''
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []
  const observacao = typeof form.observacao === 'string' ? form.observacao.trim() : ''
  const dataNormalizada = normalizeDateTimeValue(form.data)
  const dataEsocial = normalizeDateTimeValue(form.dataEsocial)
  const sesmt = normalizeBooleanValue(form.sesmt)
  const dataSesmt = normalizeDateTimeValue(form.dataSesmt)

  return {
    pessoaId,
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: dataNormalizada,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    tipo: tiposSelecionados.join('; '),
    tipoPrincipal,
    agente: agentesSelecionados.join('; '),
    agentePrincipal,
    cid: form.cid.trim(),
    lesoes,
    lesao: lesoes[0] || '',
    parteLesionada: partes[0] || '',
    partesLesionadas: partes,
    centroServico,
    setor: centroServico,
    local,
    centroServicoId,
    localId,
    agenteId,
    agentesIds,
    tiposIds,
    lesoesIds,
    partesIds,
    cat: form.cat.trim(),
    observacao,
    usuarioResponsavel,
    classificacoesAgentes: Array.isArray(form.classificacoesAgentes) ? form.classificacoesAgentes : [],
    dataEsocial,
    sesmt,
    dataSesmt,
  }
}

export function filterAcidentes(acidentes, filters) {
  const termo = filters.termo.trim().toLowerCase()
  const centroServicoFiltro = String(filters.centroServico ?? filters.setor ?? 'todos').toLowerCase()
  const apenasSesmt = Boolean(filters.apenasSesmt)
  const apenasEsocial = Boolean(filters.apenasEsocial)
  const parteLesionadaFiltro = (filters.parteLesionada ?? 'todos').toLowerCase()

  return acidentes.filter((acidente) => {
    const tiposRegistro = collectTextList(acidente.tipos, acidente.tipo)
    if (
      filters.tipo !== 'todos' &&
      !tiposRegistro.some((item) => item.toLowerCase() === filters.tipo.toLowerCase())
    ) {
      return false
    }

    const centroServicoAtual = (acidente.centroServico ?? acidente.setor ?? '').toLowerCase()
    if (centroServicoFiltro !== 'todos' && centroServicoAtual !== centroServicoFiltro) {
      return false
    }

    const agentesRegistro = collectTextList(acidente.agentes, acidente.agente)
    if (
      filters.agente !== 'todos' &&
      !agentesRegistro.some((item) => item.toLowerCase() === filters.agente.toLowerCase())
    ) {
      return false
    }

    if (filters.lesao && filters.lesao !== 'todos') {
      const normalizar = (texto) =>
        String(texto ?? '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const alvoLesao = normalizar(filters.lesao)
      const listaLesoes =
        Array.isArray(acidente.lesoes) && acidente.lesoes.length
          ? acidente.lesoes
          : acidente.lesao
            ? [acidente.lesao]
            : []
      const possuiLesao = listaLesoes.some((item) => normalizar(item) === alvoLesao)
      if (!possuiLesao) {
        return false
      }
    }

    if (apenasSesmt && !acidente.sesmt) {
      return false
    }

    if (apenasEsocial && !acidente.dataEsocial) {
      return false
    }

    if (parteLesionadaFiltro && parteLesionadaFiltro !== 'todos') {
      const normalizarParte = (texto) =>
        String(texto ?? '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const listaPartes =
        Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
          ? acidente.partesLesionadas
          : acidente.parteLesionada
            ? [acidente.parteLesionada]
            : []
      const possuiParte = listaPartes.some((item) => normalizarParte(item) === normalizarParte(parteLesionadaFiltro))
      if (!possuiParte) {
        return false
      }
    }

    if (!termo) {
      return true
    }

    const alvo = [
      acidente.nome,
      acidente.matricula,
      acidente.cargo,
      tiposRegistro.join(' '),
      agentesRegistro.join(' '),
      acidente.cid,
      Array.isArray(acidente.lesoes) ? acidente.lesoes.join(' ') : acidente.lesao,
      Array.isArray(acidente.partesLesionadas) ? acidente.partesLesionadas.join(' ') : acidente.parteLesionada,
      acidente.centroServico,
      acidente.setor,
      acidente.local,
      acidente.hht,
      acidente.cat,
      acidente.observacao,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return alvo.includes(termo)
  })
}

const buildSortedUnique = (items, accessor) => {
  const values = new Set()
  items.forEach((item) => {
    const value = accessor(item)
    if (Array.isArray(value)) {
      value
        .map((parte) => (parte === undefined || parte === null ? '' : String(parte).trim()))
        .filter(Boolean)
        .forEach((parte) => values.add(parte))
      return
    }
    if (!value) {
      return
    }
    values.add(value.trim())
  })
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export const extractTipos = (acidentes) =>
  buildSortedUnique(acidentes, (item) => collectTextList(item.tipos, item.tipo))
export const extractCentrosServico = (acidentes) =>
  buildSortedUnique(acidentes, (item) => item.centroServico ?? item.setor)
export const extractAgentes = (acidentes) =>
  buildSortedUnique(acidentes, (item) => collectTextList(item.agentes, item.agente))
export const extractLesoes = (acidentes) =>
  buildSortedUnique(acidentes, (item) => collectTextList(item.lesoes, item.lesao))
export const extractPartesLesionadas = (acidentes) =>
  buildSortedUnique(acidentes, (item) => collectTextList(item.partesLesionadas, item.parteLesionada))
