class EntradaMaterial {
  constructor({ id, materialId, quantidade, dataEntrada, usuarioResponsavel }) {
    this.id = id;
    this.materialId = materialId;
    this.quantidade = quantidade;
    this.dataEntrada = dataEntrada || new Date().toISOString();
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = EntradaMaterial;



