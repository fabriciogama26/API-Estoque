const { v4: uuid } = require('uuid');
const { Pessoa } = require('../models');
const repositories = require('../repositories');
const { pessoaRules } = require('../rules');

function sanitizePayload(payload = {}) {
  return {
    nome: payload.nome?.trim() ?? '',
    matricula: payload.matricula?.trim() ?? '',
    local: payload.local?.trim() ?? '',
    cargo: payload.cargo?.trim() ?? '',
  }
}

class PessoaService {
  criarPessoa(payload) {
    const dados = sanitizePayload(payload)
    pessoaRules.validarPessoa(dados)

    const pessoa = new Pessoa({
      id: uuid(),
      ...dados,
      usuarioCadastro: payload?.usuarioCadastro || 'sistema',
    })

    repositories.pessoas.create(pessoa)
    return pessoa
  }

  listarPessoas() {
    return repositories.pessoas.findAll()
  }

  buscarPorId(id) {
    return repositories.pessoas.findById(id)
  }

  buscarPorNome(nome) {
    if (!nome) {
      return []
    }
    return repositories.pessoas.findByNome(nome)
  }

  atualizarPessoa(id, payload) {
    const atual = repositories.pessoas.findById(id)
    if (!atual) {
      const error = new Error('Pessoa nao encontrada')
      error.status = 404
      throw error
    }

    const dados = sanitizePayload(payload)
    pessoaRules.validarPessoa(dados)

    const camposAlterados = []
    ;['nome', 'matricula', 'local', 'cargo'].forEach((campo) => {
      if (atual[campo] !== dados[campo]) {
        camposAlterados.push({
          campo,
          de: atual[campo] || '',
          para: dados[campo],
        })
      }
    })

    const agora = new Date().toISOString()
    const usuario = payload?.usuarioResponsavel || payload?.usuarioCadastro || 'sistema'
    const historicoAtual = Array.isArray(atual.historicoEdicao) ? atual.historicoEdicao.slice() : []

    if (camposAlterados.length > 0) {
      historicoAtual.push({
        id: uuid(),
        dataEdicao: agora,
        usuarioResponsavel: usuario,
        camposAlterados,
      })
    }

    const atualizado = repositories.pessoas.update(id, {
      ...dados,
      atualizadoEm: agora,
      historicoEdicao: historicoAtual,
      usuarioEdicao: usuario,
    })

    return atualizado
  }

  obterHistoricoEdicao(id) {
    const pessoa = repositories.pessoas.findById(id)
    if (!pessoa) {
      const error = new Error('Pessoa nao encontrada')
      error.status = 404
      throw error
    }
    return Array.isArray(pessoa.historicoEdicao) ? pessoa.historicoEdicao : []
  }
}

module.exports = new PessoaService()
