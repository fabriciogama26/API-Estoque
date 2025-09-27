import { uniqueSorted } from '../utils/PessoasUtils.js'

function sanitizeCampo(valor) {
  return valor?.trim() ?? ''
}

export function createPessoaPayload(form, usuario) {
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    local: sanitizeCampo(form.local),
    cargo: sanitizeCampo(form.cargo),
    usuarioCadastro: usuario,
  }
}

export function updatePessoaPayload(form, usuario) {
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    local: sanitizeCampo(form.local),
    cargo: sanitizeCampo(form.cargo),
    usuarioResponsavel: usuario,
  }
}

export function filterPessoas(pessoas, filters) {
  const termo = filters.termo.trim().toLowerCase()

  return pessoas.filter((pessoa) => {
    if (filters.local !== 'todos' && pessoa.local !== filters.local) {
      return false
    }

    if (filters.cargo !== 'todos' && pessoa.cargo !== filters.cargo) {
      return false
    }

    if (!termo) {
      return true
    }

    const alvo = [
      pessoa.nome || '',
      pessoa.matricula || '',
      pessoa.local || '',
      pessoa.cargo || '',
      pessoa.usuarioCadastro || '',
      pessoa.usuarioEdicao || '',
    ]
      .join(' ')
      .toLowerCase()

    return alvo.includes(termo)
  })
}

export function sortPessoasByNome(pessoas) {
  return pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome))
}

export function extractLocais(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.local))
}

export function extractCargos(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.cargo))
}
