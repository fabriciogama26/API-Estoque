const BaseRepository = require('./BaseRepository');

class SaidaRepository extends BaseRepository {
  constructor() {
    super('SaidaMaterial');
  }

  findByMaterial(materialId) {
    return this.findAll().filter((item) => item.materialId === materialId);
  }

  findByPessoa(pessoaId) {
    return this.findAll().filter((item) => item.pessoaId === pessoaId);
  }
}

module.exports = new SaidaRepository();



