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
    if (!dataEntrega) {
      throw new Error('Data de entrega obrigatoria');
    }
    const parsed = new Date(dataEntrega);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Data de entrega invalida');
    }
    this.id = id;
    this.materialId = materialId;
    this.pessoaId = pessoaId;
    this.quantidade = quantidade;
    this.centroCusto = centroCusto || '';
    this.centroServico = centroServico || '';
    this.dataEntrega = parsed.toISOString();
    this.dataTroca = dataTroca || null;
    this.status = status;
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = SaidaMaterial;
