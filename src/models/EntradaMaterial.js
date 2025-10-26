class EntradaMaterial {
  constructor({ id, materialId, quantidade, centroCusto, centroServico, dataEntrada, usuarioResponsavel }) {
    if (!dataEntrada) {
      throw new Error('Data de entrada obrigatoria');
    }
    const parsed = new Date(dataEntrada);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Data de entrada invalida');
    }
    this.id = id;
    this.materialId = materialId;
    this.quantidade = quantidade;
    this.centroCusto = centroCusto || '';
    this.centroServico = centroServico || '';
    this.dataEntrada = parsed.toISOString();
    this.usuarioResponsavel = usuarioResponsavel || null;
  }
}

module.exports = EntradaMaterial;
