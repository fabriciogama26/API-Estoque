function validarDadosObrigatorios({ nome, fabricante, validadeDias, valorUnitario }) {
  if (!nome || !nome.trim()) {
    throw new Error('Nome do EPI obrigatorio');
  }
  if (!fabricante || !fabricante.trim()) {
    throw new Error('Fabricante obrigatorio');
  }
  if (Number.isNaN(Number(validadeDias)) || Number(validadeDias) <= 0) {
    throw new Error('Validade deve ser maior que zero');
  }
  if (Number.isNaN(Number(valorUnitario)) || Number(valorUnitario) <= 0) {
    throw new Error('Valor unitario deve ser maior que zero');
  }
}

function validarEstoqueMinimo(estoqueMinimo) {
  if (estoqueMinimo === undefined || estoqueMinimo === null) {
    return;
  }
  if (Number.isNaN(Number(estoqueMinimo)) || Number(estoqueMinimo) < 0) {
    throw new Error('Estoque minimo deve ser zero ou positivo');
  }
}

module.exports = {
  validarDadosObrigatorios,
  validarEstoqueMinimo
};



