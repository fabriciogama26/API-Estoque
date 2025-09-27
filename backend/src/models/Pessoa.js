class Pessoa {
  constructor({
    id,
    nome,
    matricula,
    local,
    cargo,
    usuarioCadastro = 'sistema',
    criadoEm = new Date().toISOString(),
    atualizadoEm = null,
    historicoEdicao = [],
    usuarioEdicao = null,
  }) {
    this.id = id
    this.nome = nome
    this.matricula = matricula
    this.local = local
    this.cargo = cargo
    this.usuarioCadastro = usuarioCadastro
    this.criadoEm = criadoEm
    this.atualizadoEm = atualizadoEm
    this.usuarioEdicao = usuarioEdicao
    this.historicoEdicao = historicoEdicao
  }
}

module.exports = Pessoa
