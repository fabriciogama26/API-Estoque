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

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateAcidenteForm(form) {
  const centroServico = form.centroServico?.trim() || form.setor?.trim() || ''
  const local = form.local?.trim() || ''
  const partesSelecionadas = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.filter((item) => item && item.trim())
    : form.parteLesionada
    ? [form.parteLesionada.trim()]
    : []

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
  if (!form.tipo.trim()) {
    return 'Informe o tipo do acidente.'
  }
  if (!form.agente.trim()) {
    return 'Informe o agente do acidente.'
  }
  if (!form.lesao.trim()) {
    return 'Informe a lesao.'
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
  const hasHht = String(form.hht ?? '').trim() !== ''
  if (hasHht) {
    const hht = integerOrNull(form.hht)
    if (hht === null) {
      return 'HHT deve ser um numero inteiro.'
    }
    if (hht < 0) {
      return 'HHT nao pode ser negativo.'
    }
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
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []

  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    hht: integerOrNull(form.hht),
    tipo: form.tipo.trim(),
    agente: form.agente.trim(),
    cid: form.cid.trim(),
    lesao: form.lesao.trim(),
    parteLesionada: partes[0] || '',
    partesLesionadas: partes,
    centroServico,
    setor: centroServico,
    local,
    cat: form.cat.trim(),
    usuarioCadastro,
  }
}

export function updateAcidentePayload(form, usuarioResponsavel) {
  const centroServico = sanitizeCentroServico(form.centroServico || form.setor)
  const local = form.local?.trim() || centroServico
  const partes = Array.isArray(form.partesLesionadas)
    ? form.partesLesionadas.map((parte) => parte && parte.trim()).filter(Boolean)
    : form.parteLesionada?.trim()
    ? [form.parteLesionada.trim()]
    : []

  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: integerOrNull(form.diasPerdidos),
    diasDebitados: integerOrNull(form.diasDebitados),
    hht: integerOrNull(form.hht),
    tipo: form.tipo.trim(),
    agente: form.agente.trim(),
    cid: form.cid.trim(),
    lesao: form.lesao.trim(),
    parteLesionada: partes[0] || '',
    partesLesionadas: partes,
    centroServico,
    setor: centroServico,
    local,
    cat: form.cat.trim(),
    usuarioResponsavel,
  }
}

export function filterAcidentes(acidentes, filters) {
  const termo = filters.termo.trim().toLowerCase()
  const centroServicoFiltro = String(filters.centroServico ?? filters.setor ?? 'todos').toLowerCase()

  return acidentes.filter((acidente) => {
    if (filters.tipo !== 'todos' && (acidente.tipo || '').toLowerCase() !== filters.tipo.toLowerCase()) {
      return false
    }

    const centroServicoAtual = (acidente.centroServico ?? acidente.setor ?? '').toLowerCase()
    if (centroServicoFiltro !== 'todos' && centroServicoAtual !== centroServicoFiltro) {
      return false
    }

    if (filters.agente !== 'todos' && (acidente.agente || '').toLowerCase() !== filters.agente.toLowerCase()) {
      return false
    }

    if (!termo) {
      return true
    }

    const alvo = [
      acidente.nome,
      acidente.matricula,
      acidente.cargo,
      acidente.tipo,
      acidente.agente,
      acidente.cid,
      acidente.lesao,
      Array.isArray(acidente.partesLesionadas) ? acidente.partesLesionadas.join(' ') : acidente.parteLesionada,
      acidente.centroServico,
      acidente.setor,
      acidente.local,
      acidente.hht,
      acidente.cat,
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
    if (!value) {
      return
    }
    values.add(value.trim())
  })
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export const extractTipos = (acidentes) => buildSortedUnique(acidentes, (item) => item.tipo)
export const extractCentrosServico = (acidentes) =>
  buildSortedUnique(acidentes, (item) => item.centroServico ?? item.setor)
export const extractAgentes = (acidentes) => buildSortedUnique(acidentes, (item) => item.agente)
