import { uniqueSorted } from '../utils/PessoasUtils.js'

function sanitizeCampo(valor) {
  return valor?.trim() ?? ''
}

export function createPessoaPayload(form, usuario) {
  const centroServico = sanitizeCampo(form.centroServico ?? form.local)
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    centroServico,
    local: centroServico,
    cargo: sanitizeCampo(form.cargo),
    usuarioCadastro: usuario,
  }
}

export function updatePessoaPayload(form, usuario) {
  const centroServico = sanitizeCampo(form.centroServico ?? form.local)
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    centroServico,
    local: centroServico,
    cargo: sanitizeCampo(form.cargo),
    usuarioResponsavel: usuario,
  }
}

export function filterPessoas(pessoas, filters) {
  const termo = filters.termo.trim().toLowerCase()
  const centroServicoFiltro = (filters.centroServico ?? filters.local ?? 'todos')

  return pessoas.filter((pessoa) => {
    const centroServicoAtual = pessoa.centroServico ?? pessoa.local ?? ''
    if (centroServicoFiltro !== 'todos' && centroServicoAtual !== centroServicoFiltro) {
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
      centroServicoAtual,
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

export function extractCentrosServico(pessoas) {
  return uniqueSorted(
    pessoas.map((pessoa) => pessoa.centroServico ?? pessoa.local)
  )
}

export function extractCargos(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.cargo))
}
