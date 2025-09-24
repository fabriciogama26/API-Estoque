const { v4: uuid } = require('uuid');
const { Pessoa } = require('../models');
const repositories = require('../repositories');
const { pessoaRules } = require('../rules');

class PessoaService {
  criarPessoa(payload) {
    pessoaRules.validarPessoa(payload);

    const pessoa = new Pessoa({
      id: uuid(),
      nome: payload.nome.trim(),
      matricula: payload.matricula.trim(),
      local: payload.local.trim(),
      cargo: payload.cargo.trim(),
      usuarioCadastro: payload.usuarioCadastro || 'sistema'
    });

    repositories.pessoas.create(pessoa);
    return pessoa;
  }

  listarPessoas() {
    return repositories.pessoas.findAll();
  }

  buscarPorId(id) {
    return repositories.pessoas.findById(id);
  }

  buscarPorNome(nome) {
    if (!nome) {
      return [];
    }
    return repositories.pessoas.findByNome(nome);
  }
}

module.exports = new PessoaService();



