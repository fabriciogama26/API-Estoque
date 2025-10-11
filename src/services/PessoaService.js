const { v4: uuid } = require('uuid');
const { Pessoa } = require('../models');
const repositories = require('../repositories');
const { pessoaRules } = require('../rules');

function sanitizePayload(payload = {}) {
  const centroServico = payload.centroServico?.trim() ?? payload.local?.trim() ?? ''
  return {
    nome: payload.nome?.trim() ?? '',
    matricula: payload.matricula?.trim() ?? '',
    centroServico,
    local: centroServico,
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
    const comparacoes = [
      { campo: 'nome' },
      { campo: 'matricula' },
      { campo: 'centroServico', atualKey: 'local' },
      { campo: 'cargo' },
    ]

    comparacoes.forEach(({ campo, atualKey }) => {
      const valorAtual = (atualKey ? atual[atualKey] : atual[campo]) || ''
      const valorNovo = campo === 'centroServico' ? dados.centroServico : dados[campo]
      if (valorAtual !== valorNovo) {
        camposAlterados.push({
          campo,
          de: valorAtual,
          para: valorNovo,
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
      local: dados.centroServico,
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
