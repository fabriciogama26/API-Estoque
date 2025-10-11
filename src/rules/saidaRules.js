function validarSaida({ pessoa, material, quantidade, dataEntrega, centroCusto, centroServico, estoqueDisponivel }) {
  if (!pessoa) {
    throw new Error('Pessoa obrigatoria para saida');
  }
  if (!material) {
    throw new Error('Material obrigatorio para saida');
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
  if (estoqueDisponivel !== undefined && Number(quantidade) > estoqueDisponivel) {
    throw new Error('Quantidade informada maior que estoque disponivel');
  }
  if (dataEntrega && Number.isNaN(Date.parse(dataEntrega))) {
    throw new Error('Data de entrega invalida');
  }
}

module.exports = {
  validarSaida
};



