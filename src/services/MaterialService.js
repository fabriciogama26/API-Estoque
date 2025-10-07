const { v4: uuid } = require('uuid');
const { Material, PrecoHistorico } = require('../models');
const repositories = require('../repositories');
const { materialRules } = require('../rules');

class MaterialService {
  criarMaterial(payload) {
    materialRules.validarDadosObrigatorios(payload);
    materialRules.validarEstoqueMinimo(payload.estoqueMinimo);

    const existente = repositories.materiais.findByNomeAndFabricante(payload.nome, payload.fabricante);
    if (existente) {
      throw new Error('Material ja cadastrado para este fabricante');
    }

    const material = new Material({
      id: uuid(),
      nome: payload.nome.trim(),
      fabricante: payload.fabricante.trim(),
      validadeDias: Number(payload.validadeDias),
      ca: payload.ca.trim(),
      valorUnitario: Number(payload.valorUnitario),
      usuarioCadastro: payload.usuarioCadastro || 'sistema',
      estoqueMinimo: payload.estoqueMinimo !== undefined ? Number(payload.estoqueMinimo) : 0,
      ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true
    });

    repositories.materiais.create(material);
    this.registrarHistoricoPreco({ material, valorUnitario: material.valorUnitario, usuario: material.usuarioCadastro });

    return material;
  }

  atualizarMaterial(id, payload) {
    const material = repositories.materiais.findById(id);
    if (!material) {
      throw new Error('Material nao encontrado');
    }

    const atualizacoes = {};

    if (payload.nome !== undefined) {
      if (!payload.nome.trim()) {
        throw new Error('Nome invalido');
      }
      atualizacoes.nome = payload.nome.trim();
    }

    if (payload.fabricante !== undefined) {
      if (!payload.fabricante.trim()) {
        throw new Error('Fabricante invalido');
      }
      atualizacoes.fabricante = payload.fabricante.trim();
    }

    if (payload.validadeDias !== undefined) {
      if (Number.isNaN(Number(payload.validadeDias)) || Number(payload.validadeDias) <= 0) {
        throw new Error('Validade deve ser maior que zero');
      }
      atualizacoes.validadeDias = Number(payload.validadeDias);
    }

    if (payload.ca !== undefined) {
      if (!payload.ca.trim()) {
        throw new Error('CA invalido');
      }
      atualizacoes.ca = payload.ca.trim();
    }

    if (payload.valorUnitario !== undefined) {
      if (Number.isNaN(Number(payload.valorUnitario)) || Number(payload.valorUnitario) <= 0) {
        throw new Error('Valor unitario deve ser maior que zero');
      }
      atualizacoes.valorUnitario = Number(payload.valorUnitario);
    }

    if (payload.estoqueMinimo !== undefined) {
      materialRules.validarEstoqueMinimo(payload.estoqueMinimo);
      atualizacoes.estoqueMinimo = Number(payload.estoqueMinimo);
    }

    if (payload.ativo !== undefined) {
      atualizacoes.ativo = Boolean(payload.ativo);
    }

    const materialAtualizado = repositories.materiais.update(id, atualizacoes);

    if (atualizacoes.valorUnitario !== undefined && atualizacoes.valorUnitario !== material.valorUnitario) {
      this.registrarHistoricoPreco({ material: materialAtualizado, valorUnitario: atualizacoes.valorUnitario, usuario: payload.usuarioResponsavel || 'sistema' });
    }

    return materialAtualizado;
  }

  listarMateriais() {
    return repositories.materiais.findAll();
  }

  obterMaterial(id) {
    return repositories.materiais.findById(id);
  }

  obterHistoricoPreco(materialId) {
    return repositories.precos.findByMaterial(materialId);
  }

  registrarHistoricoPreco({ material, valorUnitario, usuario }) {
    const historico = new PrecoHistorico({
      id: uuid(),
      materialId: material.id,
      valorUnitario,
      usuarioResponsavel: usuario || 'sistema'
    });

    repositories.precos.create(historico);
  }
}

module.exports = new MaterialService();



