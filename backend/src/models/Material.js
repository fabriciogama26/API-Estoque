class Material {
  constructor({
    id,
    nome,
    fabricante,
    validadeDias,
    ca,
    valorUnitario,
    usuarioCadastro,
    dataCadastro = new Date().toISOString(),
    estoqueMinimo = 0,
    ativo = true
  }) {
    this.id = id;
    this.nome = nome;
    this.fabricante = fabricante;
    this.validadeDias = validadeDias;
    this.ca = ca;
    this.valorUnitario = valorUnitario;
    this.usuarioCadastro = usuarioCadastro;
    this.dataCadastro = dataCadastro;
    this.estoqueMinimo = estoqueMinimo;
    this.ativo = ativo;
  }
}

module.exports = Material;



