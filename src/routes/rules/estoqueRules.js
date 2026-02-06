function verificarEstoqueMinimo(material, estoqueAtual) {
  if (!material) {
    return null;
  }
  if (material.estoqueMinimo === undefined || material.estoqueMinimo === null) {
    return null;
  }
  if (estoqueAtual <= material.estoqueMinimo) {
    return {
      materialId: material.id,
      nome: material.nome,
      fabricante: material.fabricante,
      estoqueAtual,
      estoqueMinimo: material.estoqueMinimo
    };
  }
  return null;
}

module.exports = {
  verificarEstoqueMinimo
};



