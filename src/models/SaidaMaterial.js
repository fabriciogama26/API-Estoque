class SaidaMaterial {
  constructor({
    id,
    materialId,
    pessoaId,
    quantidade,
    dataEntrega,
    dataTroca,
    status = 'entregue',
    usuarioResponsavel
  }) {
    this.id = id;
    this.materialId = materialId;
    this.pessoaId = pessoaId;
    this.quantidade = quantidade;
    this.dataEntrega = dataEntrega || new Date().toISOString();
    this.dataTroca = dataTroca || null;
    this.status = status;
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = SaidaMaterial;



