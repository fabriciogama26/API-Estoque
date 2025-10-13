const { v4: uuid } = require('uuid');
const { Material, PrecoHistorico } = require('../models');
const repositories = require('../repositories');
const { materialRules } = require('../rules');

function normalizeMaterialInput(payload) {
  const nome = materialRules.sanitizeNomeEpi(payload.nome);
  const fabricante = String(payload.fabricante || '').trim();
  const validadeDias = Number(payload.validadeDias);
  const ca = materialRules.sanitizeDigits(payload.ca);
  const grupoMaterial = String(payload.grupoMaterial || '').trim();
  const numeroCalcadoRaw = materialRules.sanitizeDigits(payload.numeroCalcado);
  const numeroVestimentaRaw = String(payload.numeroVestimenta || '').trim();
  const numeroCalcado = materialRules.isGrupoCalcado(grupoMaterial) ? numeroCalcadoRaw : '';
  const numeroVestimenta = materialRules.isGrupoVestimenta(grupoMaterial) ? numeroVestimentaRaw : '';
  const numeroEspecifico = materialRules.buildNumeroEspecifico({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  });
  const chaveUnica = materialRules.buildChaveUnica({
    grupoMaterial,
    nome,
    fabricante,
    numeroEspecifico,
  });

  return {
    nome,
    fabricante,
    validadeDias,
    ca,
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
    numeroEspecifico,
    chaveUnica,
  };
}

class MaterialService {
  criarMaterial(payload) {
    materialRules.validarDadosObrigatorios(payload);
    materialRules.validarEstoqueMinimo(payload.estoqueMinimo);

    const normalized = normalizeMaterialInput(payload);
    const valorUnitario = Number(payload.valorUnitario);
    if (Number.isNaN(valorUnitario) || valorUnitario <= 0) {
      throw new Error('Valor unitario deve ser maior que zero');
    }

    const existente = repositories.materiais.findByChaveUnica(normalized.chaveUnica);
    if (existente) {
      throw new Error('Já existe um EPI com essas mesmas informações cadastrado.');
    }

    const material = new Material({
      id: uuid(),
      ...normalized,
      valorUnitario,
      usuarioCadastro: payload.usuarioCadastro || 'sistema',
      estoqueMinimo: payload.estoqueMinimo !== undefined ? Number(payload.estoqueMinimo) : 0,
      ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
    });

    repositories.materiais.create(material);
    this.registrarHistoricoPreco({
      material,
      valorUnitario: material.valorUnitario,
      usuario: material.usuarioCadastro,
    });

    return material;
  }

  atualizarMaterial(id, payload) {
    const material = repositories.materiais.findById(id);
    if (!material) {
      throw new Error('Material nao encontrado');
    }

    if (payload.estoqueMinimo !== undefined) {
      materialRules.validarEstoqueMinimo(payload.estoqueMinimo);
    }

    const merged = {
      nome: payload.nome !== undefined ? payload.nome : material.nome,
      fabricante: payload.fabricante !== undefined ? payload.fabricante : material.fabricante,
      validadeDias:
        payload.validadeDias !== undefined ? payload.validadeDias : material.validadeDias,
      ca: payload.ca !== undefined ? payload.ca : material.ca,
      grupoMaterial:
        payload.grupoMaterial !== undefined ? payload.grupoMaterial : material.grupoMaterial,
      numeroCalcado:
        payload.numeroCalcado !== undefined ? payload.numeroCalcado : material.numeroCalcado,
      numeroVestimenta:
        payload.numeroVestimenta !== undefined
          ? payload.numeroVestimenta
          : material.numeroVestimenta,
    };

    materialRules.validarDadosObrigatorios({
      ...merged,
      valorUnitario:
        payload.valorUnitario !== undefined ? payload.valorUnitario : material.valorUnitario,
      ca: merged.ca,
    });

    const normalized = normalizeMaterialInput(merged);
    const valorUnitarioAtualizado =
      payload.valorUnitario !== undefined ? Number(payload.valorUnitario) : material.valorUnitario;
    if (Number.isNaN(valorUnitarioAtualizado) || valorUnitarioAtualizado <= 0) {
      throw new Error('Valor unitario deve ser maior que zero');
    }

    const duplicado = repositories.materiais
      .findAll()
      .find((item) => item.id !== id && item.chaveUnica === normalized.chaveUnica);
    if (duplicado) {
      throw new Error('Já existe um EPI com essas mesmas informações cadastrado.');
    }

    const atualizacoes = {
      ...normalized,
      valorUnitario: valorUnitarioAtualizado,
    };

    if (payload.estoqueMinimo !== undefined) {
      atualizacoes.estoqueMinimo = Number(payload.estoqueMinimo);
    }

    if (payload.ativo !== undefined) {
      atualizacoes.ativo = Boolean(payload.ativo);
    }

    atualizacoes.usuarioAtualizacao = payload.usuarioResponsavel || 'sistema';
    atualizacoes.atualizadoEm = new Date().toISOString();

    const materialAtualizado = repositories.materiais.update(id, atualizacoes);

    if (valorUnitarioAtualizado !== material.valorUnitario) {
      this.registrarHistoricoPreco({
        material: materialAtualizado,
        valorUnitario: valorUnitarioAtualizado,
        usuario: payload.usuarioResponsavel || 'sistema',
      });
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
      usuarioResponsavel: usuario || 'sistema',
    });

    repositories.precos.create(historico);
  }
}

module.exports = new MaterialService();
