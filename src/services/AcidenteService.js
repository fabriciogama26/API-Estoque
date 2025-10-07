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

function coalesceRequiredString(...values) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    const trimmed = String(value).trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function obterDadosPessoa(matricula, overrides = {}) {
  const matriculaBusca = sanitizeRequiredString(matricula);
  if (!matriculaBusca) {
    const error = new Error('Matricula obrigatoria');
    error.status = 400;
    throw error;
  }

  const pessoa = repositories.pessoas.findByMatricula(matriculaBusca);
  if (!pessoa) {
    const error = new Error('Pessoa nao encontrada para a matricula informada');
    error.status = 404;
    throw error;
  }

  return {
    matricula: coalesceRequiredString(pessoa.matricula, overrides.matricula, matriculaBusca),
    nome: coalesceRequiredString(pessoa.nome, overrides.nome),
    cargo: coalesceRequiredString(pessoa.cargo, overrides.cargo),
    setor: coalesceRequiredString(pessoa.setor, overrides.setor, pessoa.local, overrides.local),
    local: coalesceRequiredString(pessoa.local, overrides.local, pessoa.setor, overrides.setor)
  };
}

class AcidenteService {
  criarAcidente(payload = {}) {
    const dadosPessoa = obterDadosPessoa(payload.matricula, payload);

    const dadosObrigatorios = {
      ...dadosPessoa,
      data: sanitizeRequiredString(payload.data),
      tipo: sanitizeRequiredString(payload.tipo),
      agente: sanitizeRequiredString(payload.agente),
      lesao: sanitizeRequiredString(payload.lesao),
      parteLesionada: sanitizeRequiredString(payload.parteLesionada),
      diasPerdidos: payload.diasPerdidos ?? 0,
      diasDebitados: payload.diasDebitados ?? 0
    };

    acidenteRules.validarDadosObrigatorios(dadosObrigatorios);
    acidenteRules.validarData(dadosObrigatorios.data);
    acidenteRules.validarDias(dadosObrigatorios);

    const acidente = new Acidente({
      id: uuid(),
      matricula: dadosObrigatorios.matricula,
      nome: dadosObrigatorios.nome,
      cargo: dadosObrigatorios.cargo,
      setor: dadosObrigatorios.setor,
      local: dadosObrigatorios.local,
      data: dadosObrigatorios.data,
      diasPerdidos: Number(dadosObrigatorios.diasPerdidos),
      diasDebitados: Number(dadosObrigatorios.diasDebitados),
      tipo: dadosObrigatorios.tipo,
      agente: dadosObrigatorios.agente,
      lesao: dadosObrigatorios.lesao,
      parteLesionada: dadosObrigatorios.parteLesionada,
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

    if (payload.matricula !== undefined) {
      const dadosPessoa = obterDadosPessoa(payload.matricula, payload);
      Object.assign(updates, dadosPessoa);
    }

    ['nome', 'cargo', 'setor', 'local', 'data', 'tipo', 'agente', 'lesao', 'parteLesionada'].forEach((campo) => {
      if (payload[campo] !== undefined && updates[campo] === undefined) {
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
