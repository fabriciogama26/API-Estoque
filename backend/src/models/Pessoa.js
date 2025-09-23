class Pessoa {
  constructor({ id, nome, local, cargo, criadoEm = new Date().toISOString() }) {
    this.id = id;
    this.nome = nome;
    this.local = local;
    this.cargo = cargo;
    this.criadoEm = criadoEm;
  }
}

module.exports = Pessoa;



