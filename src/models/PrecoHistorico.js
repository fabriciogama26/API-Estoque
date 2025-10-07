class PrecoHistorico {
  constructor({ id, materialId, valorUnitario, dataRegistro = new Date().toISOString(), usuarioResponsavel }) {
    this.id = id;
    this.materialId = materialId;
    this.valorUnitario = valorUnitario;
    this.dataRegistro = dataRegistro;
    this.usuarioResponsavel = usuarioResponsavel;
  }
}

module.exports = PrecoHistorico;



