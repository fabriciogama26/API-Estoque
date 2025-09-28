// Utilitarios de validacao, normalizacao e filtros para acidentes

const numberOrNull = (value) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = String(value).trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

export function validateAcidenteForm(form) {
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
  if (!form.parteLesionada.trim()) {
    return 'Informe a parte lesionada.'
  }
  if (!form.setor.trim()) {
    return 'Informe o setor.'
  }
  if (!form.local.trim()) {
    return 'Informe o local.'
  }

  const hasDiasPerdidos = String(form.diasPerdidos ?? '').trim() !== ''
  if (!hasDiasPerdidos) {
    return 'Informe os dias perdidos.'
  }

  const diasPerdidos = numberOrNull(form.diasPerdidos)
  if (diasPerdidos === null) {
    return 'Dias perdidos deve ser um numero valido.'
  }
  if (diasPerdidos !== null && diasPerdidos < 0) {
    return 'Dias perdidos nao pode ser negativo.'
  }

  const hasDiasDebitados = String(form.diasDebitados ?? '').trim() !== ''
  if (!hasDiasDebitados) {
    return 'Informe os dias debitados.'
  }

  const diasDebitados = numberOrNull(form.diasDebitados)
  if (diasDebitados === null) {
    return 'Dias debitados deve ser um numero valido.'
  }
  if (diasDebitados !== null && diasDebitados < 0) {
    return 'Dias debitados nao pode ser negativo.'
  }

  return null
}

export function createAcidentePayload(form, usuarioCadastro) {
  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: numberOrNull(form.diasPerdidos),
    diasDebitados: numberOrNull(form.diasDebitados),
    tipo: form.tipo.trim(),
    agente: form.agente.trim(),
    cid: form.cid.trim(),
    lesao: form.lesao.trim(),
    parteLesionada: form.parteLesionada.trim(),
    setor: form.setor.trim(),
    local: form.local.trim(),
    cat: form.cat.trim(),
    usuarioCadastro,
  }
}

export function updateAcidentePayload(form, usuarioResponsavel) {
  return {
    matricula: form.matricula.trim(),
    nome: form.nome.trim(),
    cargo: form.cargo.trim(),
    data: form.data || null,
    diasPerdidos: numberOrNull(form.diasPerdidos),
    diasDebitados: numberOrNull(form.diasDebitados),
    tipo: form.tipo.trim(),
    agente: form.agente.trim(),
    cid: form.cid.trim(),
    lesao: form.lesao.trim(),
    parteLesionada: form.parteLesionada.trim(),
    setor: form.setor.trim(),
    local: form.local.trim(),
    cat: form.cat.trim(),
    usuarioResponsavel,
  }
}

export function filterAcidentes(acidentes, filters) {
  const termo = filters.termo.trim().toLowerCase()

  return acidentes.filter((acidente) => {
    if (filters.tipo !== 'todos' && (acidente.tipo || '').toLowerCase() !== filters.tipo.toLowerCase()) {
      return false
    }

    if (filters.setor !== 'todos' && (acidente.setor || '').toLowerCase() !== filters.setor.toLowerCase()) {
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
      acidente.parteLesionada,
      acidente.setor,
      acidente.local,
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
export const extractSetores = (acidentes) => buildSortedUnique(acidentes, (item) => item.setor)
export const extractAgentes = (acidentes) => buildSortedUnique(acidentes, (item) => item.agente)
