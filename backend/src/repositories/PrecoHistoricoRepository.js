const BaseRepository = require('./BaseRepository');

class PrecoHistoricoRepository extends BaseRepository {
  constructor() {
    super('PrecoHistorico');
  }

  findByMaterial(materialId) {
    return this.findAll().filter((item) => item.materialId === materialId);
  }
}

module.exports = new PrecoHistoricoRepository();



