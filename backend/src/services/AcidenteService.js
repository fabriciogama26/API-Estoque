const { v4: uuid } = require('uuid');
const { Acidente } = require('../models');
const repositories = require('../repositories');
const { acidenteRules } = require('../rules');

function sanitizeRequiredString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeUpdatableString(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeOptionalString(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

class AcidenteService {
  criarAcidente(payload = {}) {
    const dadosObrigatorios = {
      matricula: sanitizeRequiredString(payload.matricula),
      nome: sanitizeRequiredString(payload.nome),
      cargo: sanitizeRequiredString(payload.cargo),
      data: sanitizeRequiredString(payload.data),
      tipo: sanitizeRequiredString(payload.tipo),
      agente: sanitizeRequiredString(payload.agente),
      lesao: sanitizeRequiredString(payload.lesao),
      parteLesionada: sanitizeRequiredString(payload.parteLesionada),
      setor: sanitizeRequiredString(payload.setor),
      local: sanitizeRequiredString(payload.local),
      diasPerdidos: payload.diasPerdidos,
      diasDebitados: payload.diasDebitados
    };

    acidenteRules.validarDadosObrigatorios(dadosObrigatorios);
    acidenteRules.validarData(dadosObrigatorios.data);
    acidenteRules.validarDias(dadosObrigatorios);

    const acidente = new Acidente({
      id: uuid(),
      matricula: dadosObrigatorios.matricula,
      nome: dadosObrigatorios.nome,
      cargo: dadosObrigatorios.cargo,
      data: dadosObrigatorios.data,
      diasPerdidos: Number(dadosObrigatorios.diasPerdidos),
      diasDebitados: Number(dadosObrigatorios.diasDebitados),
      tipo: dadosObrigatorios.tipo,
      agente: dadosObrigatorios.agente,
      lesao: dadosObrigatorios.lesao,
      parteLesionada: dadosObrigatorios.parteLesionada,
      setor: dadosObrigatorios.setor,
      local: dadosObrigatorios.local,
      cid: sanitizeOptionalString(payload.cid) ?? null,
      cat: sanitizeOptionalString(payload.cat) ?? null,
      observacao: sanitizeOptionalString(payload.observacao) ?? null
    });

    repositories.acidentes.create(acidente);
    return acidente;
  }

  listarAcidentes() {
    return repositories.acidentes.findAll();
  }

  atualizarAcidente(id, payload = {}) {
    const atual = repositories.acidentes.findById(id);
    if (!atual) {
      const error = new Error('Acidente nao encontrado');
      error.status = 404;
      throw error;
    }

    const updates = {};

    const camposObrigatorios = [
      'matricula',
      'nome',
      'cargo',
      'data',
      'tipo',
      'agente',
      'lesao',
      'parteLesionada',
      'setor',
      'local'
    ];

    camposObrigatorios.forEach((campo) => {
      if (payload[campo] !== undefined) {
        updates[campo] = sanitizeUpdatableString(payload[campo]);
      }
    });

    if (payload.diasPerdidos !== undefined) {
      updates.diasPerdidos = Number(payload.diasPerdidos);
    }

    if (payload.diasDebitados !== undefined) {
      updates.diasDebitados = Number(payload.diasDebitados);
    }

    if (payload.cid !== undefined) {
      updates.cid = sanitizeOptionalString(payload.cid);
    }

    if (payload.cat !== undefined) {
      updates.cat = sanitizeOptionalString(payload.cat);
    }

    if (payload.observacao !== undefined) {
      updates.observacao = sanitizeOptionalString(payload.observacao);
    }

    const merged = { ...atual, ...updates };

    acidenteRules.validarDadosObrigatorios(merged);
    acidenteRules.validarData(merged.data);
    acidenteRules.validarDias(merged);

    updates.atualizadoEm = new Date().toISOString();

    const atualizado = repositories.acidentes.update(id, updates);
    return atualizado;
  }
}

module.exports = new AcidenteService();
