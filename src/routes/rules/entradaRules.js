function validarEntrada({ material, quantidade, centroCusto, dataEntrada }) {
  if (!material) {
    throw new Error('Material obrigatorio para entrada');
  }
  if (Number.isNaN(Number(quantidade)) || Number(quantidade) <= 0) {
    throw new Error('Quantidade deve ser maior que zero');
  }
  if (!centroCusto || !String(centroCusto).trim()) {
    throw new Error('Centro de custo obrigatorio');
  }
  if (!dataEntrada || Number.isNaN(Date.parse(dataEntrada))) {
    throw new Error('Data de entrada obrigatoria e deve ser valida');
  }
}

module.exports = {
  validarEntrada
};



