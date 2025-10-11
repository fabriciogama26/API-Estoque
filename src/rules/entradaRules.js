function validarEntrada({ material, quantidade, centroCusto, centroServico, dataEntrada }) {
  if (!material) {
    throw new Error('Material obrigatorio para entrada');
  }
  if (Number.isNaN(Number(quantidade)) || Number(quantidade) <= 0) {
    throw new Error('Quantidade deve ser maior que zero');
  }
  if (!centroCusto || !String(centroCusto).trim()) {
    throw new Error('Centro de custo obrigatorio');
  }
  if (!centroServico || !String(centroServico).trim()) {
    throw new Error('Centro de servico obrigatorio');
  }
  if (dataEntrada && Number.isNaN(Date.parse(dataEntrada))) {
    throw new Error('Data de entrada invalida');
  }
}

module.exports = {
  validarEntrada
};



