class EntradaMaterial {
  constructor({ id, materialId, quantidade, centroCusto, centroServico, dataEntrada, usuarioResponsavel }) {
    this.id = id;
    this.materialId = materialId;
    this.quantidade = quantidade;
    this.centroCusto = centroCusto || '';
    this.centroServico = centroServico || '';
    this.dataEntrada = dataEntrada || new Date().toISOString();
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = EntradaMaterial;
