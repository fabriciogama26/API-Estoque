const { v4: uuid } = require('uuid');
const { SaidaMaterial } = require('../models');
const repositories = require('../repositories');
const { saidaRules } = require('../rules');
const EstoqueService = require('./EstoqueService');

class SaidaService {
  registrarSaida(payload) {
    const pessoa = this.obterPessoa(payload);
    const material = this.obterMaterial(payload);

    const estoqueDisponivel = EstoqueService.calcularSaldoMaterial(material.id);

    saidaRules.validarSaida({
      pessoa,
      material,
      quantidade: payload.quantidade,
      dataEntrega: payload.dataEntrega,
      centroCusto: payload.centroCusto,
      centroServico: payload.centroServico,
      estoqueDisponivel
    });

    const dataEntrega = payload.dataEntrega || new Date().toISOString();
    const dataTroca = this.calcularDataTroca(dataEntrega, material.validadeDias);

    const saida = new SaidaMaterial({
      id: uuid(),
      materialId: material.id,
      pessoaId: pessoa.id,
      quantidade: Number(payload.quantidade),
      centroCusto: payload.centroCusto || '',
      centroServico: payload.centroServico || '',
      dataEntrega,
      dataTroca,
      usuarioResponsavel: payload.usuarioResponsavel || null
    });

    repositories.saidas.create(saida);

    return this.formatarRetorno(saida, material, pessoa, estoqueDisponivel - Number(payload.quantidade));
  }

  listarSaidas() {
    return repositories.saidas.findAll();
  }

  obterPessoa(payload) {
    if (payload.pessoaId) {
      const pessoa = repositories.pessoas.findById(payload.pessoaId);
      if (!pessoa) {
        throw new Error('Pessoa nao encontrada');
      }
      return pessoa;
    }

    if (payload.pessoaNome) {
      const candidatas = repositories.pessoas.findByNome(payload.pessoaNome);
      if (candidatas.length === 0) {
        throw new Error('Pessoa nao encontrada');
      }
      if (payload.pessoaLocal) {
        const filtradas = candidatas.filter((item) => item.local.toLowerCase() === payload.pessoaLocal.toLowerCase());
        if (filtradas.length === 1) {
          return filtradas[0];
        }
        if (filtradas.length > 1) {
          throw new Error('Mais de uma pessoa encontrada, informe o ID');
        }
      }
      if (candidatas.length === 1) {
        return candidatas[0];
      }
      throw new Error('Mais de uma pessoa encontrada, informe o ID');
    }

    throw new Error('Informe pessoaId ou nome da pessoa');
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

  calcularDataTroca(dataEntrega, validadeDias) {
    const data = new Date(dataEntrega);
    if (Number.isNaN(data.getTime())) {
      throw new Error('Data de entrega invalida');
    }
    data.setDate(data.getDate() + Number(validadeDias));
    return data.toISOString();
  }

  formatarRetorno(saida, material, pessoa, estoqueAtual) {
    return {
      id: saida.id,
      materialId: material.id,
      pessoaId: pessoa.id,
      quantidade: saida.quantidade,
      centroCusto: saida.centroCusto || '',
      centroServico: saida.centroServico || '',
      dataEntrega: saida.dataEntrega,
      dataTroca: saida.dataTroca,
      status: saida.status,
      pessoa: {
        nome: pessoa.nome,
        local: pessoa.local,
        centroServico: pessoa.centroServico || pessoa.local,
        cargo: pessoa.cargo
      },
      material: {
        nome: material.nome,
        fabricante: material.fabricante,
        validadeDias: material.validadeDias,
        ca: material.ca,
        valorUnitario: material.valorUnitario
      },
      estoqueAtual
    };
  }
}

module.exports = new SaidaService();



