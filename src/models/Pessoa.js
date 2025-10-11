class Pessoa {
  constructor({
    id,
    nome,
    matricula,
    centroServico,
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
    const resolvedCentroServico = centroServico ?? local ?? ''
    this.centroServico = resolvedCentroServico
    this.local = resolvedCentroServico
    this.cargo = cargo
    this.usuarioCadastro = usuarioCadastro
    this.criadoEm = criadoEm
    this.atualizadoEm = atualizadoEm
    this.usuarioEdicao = usuarioEdicao
    this.historicoEdicao = historicoEdicao
  }
}

module.exports = Pessoa
