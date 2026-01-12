import { uniqueSorted } from '../utils/pessoasUtils.js'

function sanitizeCampo(valor) {
  return valor?.trim() ?? ''
}

function sanitizeDate(value) {
  const raw = (value ?? '').trim()
  if (!raw) {
    return null
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  if (!dateOnly) {
    return null
  }
  return raw
}

export function createPessoaPayload(form, usuario) {
  const centroServico = sanitizeCampo(form.centroServico ?? form.local)
  const setor = sanitizeCampo(form.setor ?? centroServico)
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    centroServico,
    local: centroServico,
    setor,
    cargo: sanitizeCampo(form.cargo),
    dataAdmissao: sanitizeDate(form.dataAdmissao),
    dataDemissao: sanitizeDate(form.dataDemissao),
    tipoExecucao: sanitizeCampo(form.tipoExecucao),
    usuarioCadastro: usuario,
    ativo: true,
    observacao: sanitizeCampo(form.observacao),
  }
}

export function updatePessoaPayload(form, usuario) {
  const centroServico = sanitizeCampo(form.centroServico ?? form.local)
  const setor = sanitizeCampo(form.setor ?? centroServico)
  return {
    nome: sanitizeCampo(form.nome),
    matricula: sanitizeCampo(form.matricula),
    centroServico,
    local: centroServico,
    setor,
    cargo: sanitizeCampo(form.cargo),
    dataAdmissao: sanitizeDate(form.dataAdmissao),
    dataDemissao: sanitizeDate(form.dataDemissao),
    tipoExecucao: sanitizeCampo(form.tipoExecucao),
    usuarioResponsavel: usuario,
    ativo: form.ativo !== false,
    observacao: sanitizeCampo(form.observacao),
  }
}

export function filterPessoas(pessoas, filters) {
  const termo = filters.termo.trim().toLowerCase()
  const centroServicoFiltro = (filters.centroServico ?? filters.local ?? 'todos')
  const setorFiltro = (filters.setor ?? 'todos')
  const statusFiltro = (filters.status ?? 'todos').toString().toLowerCase()
  const cadastradoInicio = filters.cadastradoInicio ? new Date(`${filters.cadastradoInicio}T00:00:00`) : null
  const cadastradoFim = filters.cadastradoFim ? new Date(`${filters.cadastradoFim}T23:59:59.999`) : null

  return pessoas.filter((pessoa) => {
    const centroServicoAtual = pessoa.centroServico ?? pessoa.local ?? ''
    if (centroServicoFiltro !== 'todos' && centroServicoAtual !== centroServicoFiltro) {
      return false
    }

    if (setorFiltro !== 'todos' && (pessoa.setor ?? '') !== setorFiltro) {
      return false
    }

    if (filters.cargo !== 'todos' && pessoa.cargo !== filters.cargo) {
      return false
    }

    if (statusFiltro === 'ativo' && pessoa.ativo === false) {
      return false
    }
    if (statusFiltro === 'inativo' && pessoa.ativo !== false) {
      return false
    }

    if (cadastradoInicio instanceof Date && !Number.isNaN(cadastradoInicio)) {
      const criado = new Date(pessoa.criadoEm || pessoa.createdAt || pessoa.created_at || 0)
      if (Number.isNaN(criado)) {
        return false
      }
      if (criado < cadastradoInicio) {
        return false
      }
    }
    if (cadastradoFim instanceof Date && !Number.isNaN(cadastradoFim)) {
      const criado = new Date(pessoa.criadoEm || pessoa.createdAt || pessoa.created_at || 0)
      if (Number.isNaN(criado)) {
        return false
      }
      if (criado > cadastradoFim) {
        return false
      }
    }

    if (!termo) {
      return true
    }

    const alvo = [
      pessoa.nome || '',
      pessoa.matricula || '',
      centroServicoAtual,
      pessoa.setor || '',
      pessoa.cargo || '',
      pessoa.tipoExecucao || '',
      pessoa.usuarioCadastro || '',
      pessoa.usuarioEdicao || '',
    ]
      .join(' ')
      .toLowerCase()

    return alvo.includes(termo)
  })
}

export function sortPessoasByNome(pessoas) {
  const resolveNome = (pessoa) => (pessoa?.nome ?? '').toString()
  return pessoas
    .slice()
    .sort((a, b) =>
      resolveNome(a).localeCompare(resolveNome(b), 'pt-BR', {
        sensitivity: 'base',
        ignorePunctuation: true,
      }),
    )
}

export function extractCentrosServico(pessoas) {
  return uniqueSorted(
    pessoas.map((pessoa) => pessoa.centroServico ?? pessoa.local ?? pessoa.setor)
  )
}

export function extractCargos(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.cargo))
}

export function extractSetores(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.setor))
}

export function extractTiposExecucao(pessoas) {
  return uniqueSorted(pessoas.map((pessoa) => pessoa.tipoExecucao))
}
