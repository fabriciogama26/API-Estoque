class SaidaMaterial {
  constructor({
    id,
    materialId,
    pessoaId,
    quantidade,
    centroCusto,
    centroServico,
    dataEntrega,
    dataTroca,
    status = 'entregue',
    usuarioResponsavel,
  }) {
    this.id = id;
    this.materialId = materialId;
    this.pessoaId = pessoaId;
    this.quantidade = quantidade;
    this.centroCusto = centroCusto || '';
    this.centroServico = centroServico || '';
    this.dataEntrega = dataEntrega || new Date().toISOString();
    this.dataTroca = dataTroca || null;
    this.status = status;
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = SaidaMaterial;
