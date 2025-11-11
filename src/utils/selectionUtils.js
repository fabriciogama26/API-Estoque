const normalize = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

export const normalizeSelectionKey = (value) => normalize(value)

export const normalizeSelectionItem = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const nome = value.trim()
    if (!nome) {
      return null
    }
    return { id: value, nome }
  }

  if (typeof value === 'object') {
    const nomeBase =
      value.nome ??
      value.label ??
      value.valor ??
      value.value ??
      value.descricao ??
      value.id ??
      ''
    const nome = typeof nomeBase === 'string' ? nomeBase.trim() : String(nomeBase ?? '').trim()

    if (!nome) {
      return null
    }

    const idBase = value.id ?? value.value ?? value.valor ?? value.nome ?? value.codigo
    const id = idBase !== null && idBase !== undefined ? idBase : nome

    return { id, nome }
  }

  const nome = String(value ?? '').trim()
  if (!nome) {
    return null
  }
  return { id: value, nome }
}

export const normalizeSelectionList = (lista) => {
  if (!Array.isArray(lista)) {
    return []
  }

  const normalizados = lista
    .map((item) => normalizeSelectionItem(item))
    .filter(Boolean)
    .reduce((acc, item) => {
      const exists = acc.some((existente) => {
        const sameId =
          existente.id &&
          item.id &&
          String(existente.id).trim() &&
          String(item.id).trim() &&
          existente.id === item.id
        const sameName =
          normalizeSelectionKey(existente.nome) === normalizeSelectionKey(item.nome)
        return sameId || sameName
      })
      if (!exists) {
        acc.push({ id: item.id ?? item.nome, nome: item.nome })
      }
      return acc
    }, [])

  return normalizados.sort((a, b) => a.nome.localeCompare(b.nome))
}

export const selectionToArray = (value) => {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    const texto = value.trim()
    if (!texto) {
      return []
    }
    return texto
      .split(/[;|,]/)
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((nome) => ({ id: nome, nome }))
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const nome = String(value)
    return nome ? [{ id: value, nome }] : []
  }

  if (typeof value === 'object') {
    return [value]
  }

  return []
}

export const formatSelectionValue = (value, separator = ', ') => {
  const lista = normalizeSelectionList(selectionToArray(value))
  if (!lista.length) {
    return ''
  }
  return lista.map((item) => item.nome).join(separator)
}
