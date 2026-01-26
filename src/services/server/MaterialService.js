const { v4: uuid } = require('uuid');
const { Material, PrecoHistorico } = require('../../models');
const repositories = require('../../repositories');
const { materialRules } = require('../../rules');

const sanitizeText = (value) => (value === undefined || value === null ? '' : String(value).trim());

const normalizeKeyPart = (value) =>
  sanitizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeSelectionItem = (item) => {
  if (item === null || item === undefined) {
    return null;
  }
  if (typeof item === 'string' || typeof item === 'number') {
    const texto = sanitizeText(item);
    if (!texto) {
      return null;
    }
    const valor = String(item).trim();
    return { id: valor, nome: texto };
  }
  if (typeof item === 'object') {
    const nomeBase = sanitizeText(
      item.nome ?? item.label ?? item.valor ?? item.value ?? item.texto ?? item.text,
    );
    const idBase =
      item.id ?? item.uuid ?? item.value ?? item.valor ?? item.nome ?? item.label ?? null;
    const id = sanitizeText(idBase ?? nomeBase);
    const nome = nomeBase || id;
    if (!nome) {
      return null;
    }
    return { id, nome };
  }
  const texto = sanitizeText(item);
  if (!texto) {
    return null;
  }
  return { id: texto, nome: texto };
};

const collectSelectionValues = (...sources) => {
  const itens = [];
  sources.forEach((source) => {
    if (source === undefined || source === null || source === '') {
      return;
    }
    if (Array.isArray(source)) {
      source.forEach((value) => itens.push(value));
      return;
    }
    if (typeof source === 'string') {
      source
        .split(/[;|,]/)
        .map((parte) => sanitizeText(parte))
        .filter(Boolean)
        .forEach((parte) => itens.push(parte));
      return;
    }
    itens.push(source);
  });
  return itens;
};

const mergeSelectionLists = (...sources) => {
  const vistos = new Set();
  const resultado = [];
  collectSelectionValues(...sources)
    .map((value) => normalizeSelectionItem(value))
    .filter(Boolean)
    .forEach((item) => {
      const chave = item.id ? `id:${item.id}` : `nome:${normalizeKeyPart(item.nome)}`;
      if (vistos.has(chave)) {
        return;
      }
      vistos.add(chave);
      resultado.push(item);
    });
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome));
};

function normalizeMaterialInput(payload) {
  const nome = materialRules.sanitizeNomeEpi(payload.nome);
  const fabricante = String(payload.fabricante || '').trim();
  const validadeDias = Number(payload.validadeDias);
  const ca = materialRules.sanitizeDigits(payload.ca);
  const grupoMaterial = String(payload.grupoMaterial || '').trim();
  const numeroCalcadoRaw = materialRules.sanitizeDigits(payload.numeroCalcado);
  const numeroVestimentaRaw = String(payload.numeroVestimenta || '').trim();
  const numeroCalcado = materialRules.isGrupoCalcado(grupoMaterial) ? numeroCalcadoRaw : '';
  const numeroVestimenta = materialRules.requiresTamanho(grupoMaterial) ? numeroVestimentaRaw : '';
  const caracteristicasLista = mergeSelectionLists(
    payload.caracteristicas,
    payload.caracteristicasSelecionadas,
    payload.caracteristicasEpi,
    payload.caracteristicaEpi,
    payload.caracteristica_epi,
    payload.caracteristicas_epi,
    payload.caracteristicasIds,
    payload.caracteristicaIds,
  );
  const caracteristicaEpiTexto = caracteristicasLista.length
    ? materialRules.formatCaracteristicaTexto(caracteristicasLista.map((item) => item.nome))
    : materialRules.formatCaracteristicaTexto(payload.caracteristicaEpi || payload.caracteristica_epi || '');
  const coresLista = mergeSelectionLists(
    payload.coresDetalhes,
    payload.coresSelecionadas,
    payload.cores,
    payload.coresIds,
    payload.corMaterial,
  );
  const corMaterial = coresLista[0]?.nome || sanitizeText(payload.corMaterial);
  const descricao = String(payload.descricao || '').trim();
  const numeroEspecifico = materialRules.buildNumeroEspecifico({
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
  });
  const caracteristicasIds = caracteristicasLista.map((item) => item.id).filter(Boolean);
  const coresIds = coresLista.map((item) => item.id).filter(Boolean);

  return {
    nome,
    fabricante,
    validadeDias,
    ca,
    grupoMaterial,
    numeroCalcado,
    numeroVestimenta,
    numeroEspecifico,
    caracteristicaEpi: caracteristicaEpiTexto,
    corMaterial,
    descricao,
    caracteristicas: caracteristicasLista,
    caracteristicasIds,
    caracteristicas_epi: caracteristicasIds,
    cores: coresLista,
    coresIds,
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

    const material = new Material({
      id: uuid(),
      ...normalized,
      valorUnitario,
      usuarioCadastro: payload.usuarioCadastro || 'sistema',
      estoqueMinimo: payload.estoqueMinimo !== undefined ? Number(payload.estoqueMinimo) : 0,
      ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : true,
    });

    material.caracteristicas = normalized.caracteristicas;
    material.caracteristicasIds = normalized.caracteristicasIds;
    material.caracteristicas_epi = normalized.caracteristicas_epi;
    material.cores = normalized.cores;
    material.coresIds = normalized.coresIds;

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
      caracteristicaEpi:
        payload.caracteristicaEpi !== undefined
          ? payload.caracteristicaEpi
          : material.caracteristicaEpi,
      corMaterial:
        payload.corMaterial !== undefined ? payload.corMaterial : material.corMaterial,
      descricao: payload.descricao !== undefined ? payload.descricao : material.descricao,
    };

    materialRules.validarDadosObrigatorios({
      ...merged,
      valorUnitario:
        payload.valorUnitario !== undefined ? payload.valorUnitario : material.valorUnitario,
    });

    const normalized = normalizeMaterialInput(merged);
    const valorUnitarioAtualizado =
      payload.valorUnitario !== undefined ? Number(payload.valorUnitario) : material.valorUnitario;
    if (Number.isNaN(valorUnitarioAtualizado) || valorUnitarioAtualizado <= 0) {
      throw new Error('Valor unitario deve ser maior que zero');
    }

    const atualizacoes = {
      ...normalized,
      valorUnitario: valorUnitarioAtualizado,
      caracteristicas: normalized.caracteristicas,
      caracteristicasIds: normalized.caracteristicasIds,
      caracteristicas_epi: normalized.caracteristicas_epi,
      cores: normalized.cores,
      coresIds: normalized.coresIds,
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
