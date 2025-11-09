const BaseRepository = require('./BaseRepository');

class MaterialRepository extends BaseRepository {
  constructor() {
    super('Material');
  }

  findByNomeAndFabricante(nome, fabricante) {
    return this.findAll().find((item) =>
      item.nome.toLowerCase() === nome.toLowerCase() &&
      item.fabricante.toLowerCase() === fabricante.toLowerCase());
  }

}

module.exports = new MaterialRepository();



