const { v4: uuid } = require('uuid');
const { EntradaMaterial } = require('../models');
const repositories = require('../repositories');
const { entradaRules } = require('../rules');

class EntradaService {
  registrarEntrada(payload) {
    const material = this.obterMaterial(payload);

    entradaRules.validarEntrada({
      material,
      quantidade: payload.quantidade,
      centroCusto: payload.centroCusto,
      centroServico: payload.centroServico,
      dataEntrada: payload.dataEntrada
    });

    const entrada = new EntradaMaterial({
      id: uuid(),
      materialId: material.id,
      quantidade: Number(payload.quantidade),
      centroCusto: payload.centroCusto || '',
      centroServico: payload.centroServico || '',
      dataEntrada: payload.dataEntrada || new Date().toISOString(),
      usuarioResponsavel: payload.usuarioResponsavel || null
    });

    repositories.entradas.create(entrada);

    return this.formatarRetorno(entrada, material);
  }

  listarEntradas() {
    return repositories.entradas.findAll();
  }

  obterMaterial(payload) {
    if (payload.materialId) {
      const material = repositories.materiais.findById(payload.materialId);
      if (!material) {
        throw new Error('Material nao encontrado');
      }
      return material;
    }

    if (payload.nome && payload.fabricante) {
      const material = repositories.materiais.findByNomeAndFabricante(payload.nome, payload.fabricante);
      if (!material) {
        throw new Error('Material nao encontrado para nome e fabricante informados');
      }
      return material;
    }

    throw new Error('Informe materialId ou nome e fabricante');
  }

  formatarRetorno(entrada, material) {
    return {
      id: entrada.id,
      materialId: material.id,
      quantidade: entrada.quantidade,
      centroCusto: entrada.centroCusto || '',
      centroServico: entrada.centroServico || '',
      dataEntrada: entrada.dataEntrada,
      material: {
        nome: material.nome,
        fabricante: material.fabricante,
        validadeDias: material.validadeDias,
        ca: material.ca,
        valorUnitario: material.valorUnitario
      },
      valorTotal: Number((entrada.quantidade * material.valorUnitario).toFixed(2))
    };
  }
}

module.exports = new EntradaService();



