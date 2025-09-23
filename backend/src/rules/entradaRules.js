function validarEntrada({ material, quantidade, dataEntrada }) {
  if (!material) {
    throw new Error('Material obrigatorio para entrada');
  }
  if (Number.isNaN(Number(quantidade)) || Number(quantidade) <= 0) {
    throw new Error('Quantidade deve ser maior que zero');
  }
  if (dataEntrada && Number.isNaN(Date.parse(dataEntrada))) {
    throw new Error('Data de entrada invalida');
  }
}

module.exports = {
  validarEntrada
};



