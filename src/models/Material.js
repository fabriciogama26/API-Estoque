class Material {
  constructor({
    id,
    nome,
    fabricante,
    validadeDias,
    ca,
    valorUnitario,
    grupoMaterial,
    numeroCalcado = '',
    numeroVestimenta = '',
    numeroEspecifico = '',
    caracteristicaEpi = '',
    corMaterial = '',
    descricao = '',
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
    this.grupoMaterial = grupoMaterial;
    this.numeroCalcado = numeroCalcado;
    this.numeroVestimenta = numeroVestimenta;
    this.numeroEspecifico = numeroEspecifico;
    this.caracteristicaEpi = caracteristicaEpi;
    this.corMaterial = corMaterial;
    this.descricao = descricao;
    this.usuarioCadastro = usuarioCadastro;
    this.dataCadastro = dataCadastro;
    this.estoqueMinimo = estoqueMinimo;
    this.ativo = ativo;
  }
}

module.exports = Material;



