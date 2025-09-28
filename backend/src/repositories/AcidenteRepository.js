const BaseRepository = require('./BaseRepository');

class AcidenteRepository extends BaseRepository {
  constructor() {
    super('Acidente');
  }
}

module.exports = new AcidenteRepository();
