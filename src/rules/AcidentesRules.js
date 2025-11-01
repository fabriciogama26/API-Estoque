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

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateAcidenteForm(form) {
  const centroServico = form.centroServico?.trim() || form.setor?.trim() || ''
  const local = form.local?.trim() || ''
  const lesoesSelecionadas = Array.isArray(form.lesoes)
    ? form.lesoes.filter((item) => item && item.trim())
    : form.lesao
    ? [form.lesao.trim()]
    : []
  const partesSelecionadas = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.filter((item) => item && item.trim())
    : form.parteLesionada
    ? [form.parteLesionada.trim()]
    : []
  const agentesSelecionados = collectTextList(form.agentes, form.agente)
  const tiposSelecionados = collectTextList(form.tipos, form.tipo)

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
  if (!tiposSelecionados.length) {
    return 'Informe ao menos um tipo do acidente.'
  }
  if (!agentesSelecionados.length) {
    return 'Informe ao menos um agente do acidente.'
  }
  if (lesoesSelecionadas.length === 0) {
    return 'Informe ao menos uma lesao.'
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
  const hhtTexto = String(form.hht ?? '').trim()
  if (!hhtTexto) {
    return 'Informe o HHT do acidente.'
  }
  const hht = integerOrNull(form.hht)
  if (hht === null) {
    return 'HHT deve ser um numero inteiro.'
  }
  if (hht < 0) {
    return 'HHT nao pode ser negativo.'
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

  return null
}

const sanitizeCentroServico = (value) => {
  const trimmed = value?.trim() || ''
  return trimmed
}

export function createAcidentePayload(form, usuarioCadastro) {
  const centroServico = sanitizeCentroServico(form.centroServico || form.setor)
  const local = form.local?.trim() || centroServico
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
  if (Array.isArray(form.lesoes)) {
    form.lesoes.forEach(addLesao)
  }
  addLesao(form.lesao)
  const agentesSelecionados = collectTextList(form.agentes, form.agente)
  const tiposSelecionados = collectTextList(form.tipos, form.tipo)
  const agentePrincipal = agentesSelecionados[agentesSelecionados.length - 1] ?? ''
  const tipoPrincipal = tiposSelecionados[0] ?? ''
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []
  const observacao = typeof form.observacao === 'string' ? form.observacao.trim() : ''

  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    hht: integerOrNull(form.hht),
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
    cat: form.cat.trim(),
    observacao,
    usuarioCadastro,
  }
}

export function updateAcidentePayload(form, usuarioResponsavel) {
  const centroServico = sanitizeCentroServico(form.centroServico || form.setor)
  const local = form.local?.trim() || centroServico
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
  if (Array.isArray(form.lesoes)) {
    form.lesoes.forEach(addLesao)
  }
  addLesao(form.lesao)
  const agentesSelecionados = collectTextList(form.agentes, form.agente)
  const tiposSelecionados = collectTextList(form.tipos, form.tipo)
  const agentePrincipal = agentesSelecionados[agentesSelecionados.length - 1] ?? ''
  const tipoPrincipal = tiposSelecionados[0] ?? ''
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []
  const observacao = typeof form.observacao === 'string' ? form.observacao.trim() : ''

  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    hht: integerOrNull(form.hht),
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
    cat: form.cat.trim(),
    observacao,
    usuarioResponsavel,
  }
}

export function filterAcidentes(acidentes, filters) {
  const termo = filters.termo.trim().toLowerCase()
  const centroServicoFiltro = String(filters.centroServico ?? filters.setor ?? 'todos').toLowerCase()

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
