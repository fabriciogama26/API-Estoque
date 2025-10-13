const BaseRepository = require('./BaseRepository');
const { materialRules } = require('../rules');

class MaterialRepository extends BaseRepository {
  constructor() {
    super('Material');
  }

  findByNomeAndFabricante(nome, fabricante) {
    return this.findAll().find((item) =>
      item.nome.toLowerCase() === nome.toLowerCase() &&
      item.fabricante.toLowerCase() === fabricante.toLowerCase());
  }

  findByChaveUnica(chaveUnica) {
    const target = (chaveUnica || '').toLowerCase();
    if (!target) {
      return undefined;
    }
    return this.findAll().find((item) => {
      const existenteChave =
        item.chaveUnica ||
        materialRules.buildChaveUnica({
          grupoMaterial: item.grupoMaterial || '',
          nome: item.nome || '',
          fabricante: item.fabricante || '',
          numeroEspecifico:
            item.numeroEspecifico ||
            materialRules.buildNumeroEspecifico({
              grupoMaterial: item.grupoMaterial || '',
              numeroCalcado: item.numeroCalcado || '',
              numeroVestimenta: item.numeroVestimenta || '',
            }),
        });
      return (existenteChave || '').toLowerCase() === target;
    });
  }
}

module.exports = new MaterialRepository();



