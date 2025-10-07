const BaseRepository = require('./BaseRepository');

class PessoaRepository extends BaseRepository {
  constructor() {
    super('Pessoa');
  }

  findByNome(nome) {
    return this.findAll().filter((item) => item.nome.toLowerCase() === nome.toLowerCase());
  }

  findByMatricula(matricula) {
    if (!matricula && matricula !== 0) {
      return null;
    }

    const sanitized = String(matricula).trim().toLowerCase();
    if (!sanitized) {
      return null;
    }

    return (
      this.findAll().find((item) => String(item.matricula ?? '').trim().toLowerCase() === sanitized) || null
    );
  }
}

module.exports = new PessoaRepository();



