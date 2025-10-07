import { parseCurrencyToNumber, sanitizeDigits } from '../utils/MateriaisUtils.js'

// Resolve o nome do usuário para exibição
export function resolveUsuarioNome(user) {
  return user?.name || user?.username || user?.email || 'sistema'
}

// Formata o payload para criação de material
export function createMaterialPayload(form, usuarioCadastro) {
  return {
    nome: form.nome.trim(),
    fabricante: form.fabricante.trim(),
    validadeDias: Number(form.validadeDias) || 0,
    ca: sanitizeDigits(form.ca),
    valorUnitario: parseCurrencyToNumber(form.valorUnitario),
    usuarioCadastro,
  }
}

// Formata o payload para atualização de material
export function updateMaterialPayload(form, usuarioResponsavel) {
  return {
    nome: form.nome.trim(),
    fabricante: form.fabricante.trim(),
    validadeDias: Number(form.validadeDias) || 0,
    ca: sanitizeDigits(form.ca),
    valorUnitario: parseCurrencyToNumber(form.valorUnitario),
    usuarioResponsavel,
  }
}

// Filtro de materiais
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

    const target = [material.nome, material.fabricante, material.ca]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return target.includes(termo)
  })
}

// Ordena materiais por nome (A-Z)
export function sortMateriaisByNome(materiais) {
  return materiais.slice().sort((a, b) => a.nome.localeCompare(b.nome))
}
