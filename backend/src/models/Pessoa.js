class Pessoa {
  constructor({ id, nome, matricula, local, cargo, usuarioCadastro = 'sistema', criadoEm = new Date().toISOString() }) {
    this.id = id;
    this.nome = nome;
    this.matricula = matricula;
    this.local = local;
    this.cargo = cargo;
    this.usuarioCadastro = usuarioCadastro;
    this.criadoEm = criadoEm;
  }
}

module.exports = Pessoa;

