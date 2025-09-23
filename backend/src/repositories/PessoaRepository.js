const BaseRepository = require('./BaseRepository');

class PessoaRepository extends BaseRepository {
  constructor() {
    super('Pessoa');
  }

  findByNome(nome) {
    return this.findAll().filter((item) => item.nome.toLowerCase() === nome.toLowerCase());
  }
}

module.exports = new PessoaRepository();



