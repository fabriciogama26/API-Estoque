const BaseRepository = require('./BaseRepository');

class EntradaRepository extends BaseRepository {
  constructor() {
    super('EntradaMaterial');
  }

  findByMaterial(materialId) {
    return this.findAll().filter((item) => item.materialId === materialId);
  }
}

module.exports = new EntradaRepository();



