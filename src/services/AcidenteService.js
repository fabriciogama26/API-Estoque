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

  const centroServico = coalesceRequiredString(
    overrides.centroServico,
    pessoa.centroServico,
    overrides.setor,
    pessoa.setor,
    overrides.local,
    pessoa.local
  );

  const local = sanitizeOptionalString(
    overrides.local ||
      pessoa.local ||
      overrides.centroServico ||
      pessoa.centroServico ||
      overrides.setor ||
      pessoa.setor
  );

  return {
    matricula: coalesceRequiredString(pessoa.matricula, overrides.matricula, matriculaBusca),
    nome: coalesceRequiredString(pessoa.nome, overrides.nome),
    cargo: coalesceRequiredString(pessoa.cargo, overrides.cargo),
    centroServico,
    setor: centroServico,
    local,
  };
}

function sanitizeNonNegativeInteger(value, { defaultValue = 0, allowNull = false, fieldName = 'Valor' } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (allowNull) {
      return null;
    }
    return defaultValue;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    const error = new Error(`${fieldName} deve ser um numero inteiro.`);
    error.status = 400;
    throw error;
  }
  if (numeric < 0) {
    const error = new Error(`${fieldName} nao pode ser negativo.`);
    error.status = 400;
    throw error;
  }
  return numeric;
}

function sanitizeOptionalIntegerString(value, fieldName = 'Valor') {
  const sanitized = sanitizeOptionalString(value);
  if (sanitized === undefined) {
    return undefined;
  }
  if (sanitized === null) {
    return null;
  }
  if (!/^\d+$/.test(sanitized)) {
    const error = new Error(`${fieldName} deve conter apenas numeros inteiros.`);
    error.status = 400;
    throw error;
  }
  return sanitized;
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
      diasPerdidos: sanitizeNonNegativeInteger(payload.diasPerdidos, {
        defaultValue: 0,
        fieldName: 'Dias perdidos',
      }),
      diasDebitados: sanitizeNonNegativeInteger(payload.diasDebitados, {
        defaultValue: 0,
        fieldName: 'Dias debitados',
      }),
      hht: sanitizeNonNegativeInteger(payload.hht, {
        allowNull: true,
        fieldName: 'HHT',
      }),
    };

    acidenteRules.validarDadosObrigatorios(dadosObrigatorios);
    acidenteRules.validarData(dadosObrigatorios.data);
    acidenteRules.validarDias(dadosObrigatorios);
    acidenteRules.validarHht(dadosObrigatorios.hht);

    const acidente = new Acidente({
      id: uuid(),
      ...dadosObrigatorios,
      tipo: dadosObrigatorios.tipo,
      agente: dadosObrigatorios.agente,
      cid: sanitizeOptionalString(payload.cid) ?? null,
      cat: sanitizeOptionalIntegerString(payload.cat, 'CAT') ?? null,
      observacao: sanitizeOptionalString(payload.observacao) ?? null,
      registradoPor: sanitizeRequiredString(payload.usuarioCadastro || 'sistema') || 'sistema',
    });

    acidenteRules.validarCat(acidente.cat);

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

    const assignCampo = (campo, sanitizer = sanitizeUpdatableString) => {
      if (payload[campo] !== undefined) {
        updates[campo] = sanitizer(payload[campo]);
      }
    };

    ['nome', 'cargo', 'tipo', 'agente', 'lesao', 'parteLesionada'].forEach((campo) => assignCampo(campo));

    const centroServicoOverride = sanitizeUpdatableString(payload.centroServico ?? payload.setor);
    if (centroServicoOverride !== undefined) {
      updates.centroServico = centroServicoOverride;
      updates.setor = centroServicoOverride;
    }

    const localOverride = sanitizeUpdatableString(payload.local);
    if (localOverride !== undefined) {
      updates.local = localOverride;
    }

    assignCampo('data', sanitizeUpdatableString);

    if (payload.diasPerdidos !== undefined) {
      updates.diasPerdidos = sanitizeNonNegativeInteger(payload.diasPerdidos, {
        defaultValue: atual.diasPerdidos ?? 0,
        fieldName: 'Dias perdidos',
      });
    }

    if (payload.diasDebitados !== undefined) {
      updates.diasDebitados = sanitizeNonNegativeInteger(payload.diasDebitados, {
        defaultValue: atual.diasDebitados ?? 0,
        fieldName: 'Dias debitados',
      });
    }

    if (payload.hht !== undefined) {
      updates.hht = sanitizeNonNegativeInteger(payload.hht, {
        allowNull: true,
        fieldName: 'HHT',
      });
    }

    if (payload.cid !== undefined) {
      updates.cid = sanitizeOptionalString(payload.cid);
    }

    if (payload.cat !== undefined) {
      updates.cat = sanitizeOptionalIntegerString(payload.cat, 'CAT');
    }

    if (payload.observacao !== undefined) {
      updates.observacao = sanitizeOptionalString(payload.observacao);
    }

    const merged = {
      ...atual,
      ...updates,
      centroServico: updates.centroServico ?? atual.centroServico ?? atual.setor,
      setor: updates.setor ?? atual.setor ?? atual.centroServico,
      local: updates.local ?? atual.local ?? null,
      hht: updates.hht ?? atual.hht ?? null,
    };

    acidenteRules.validarDadosObrigatorios(merged);
    acidenteRules.validarData(merged.data);
    acidenteRules.validarDias(merged);
    acidenteRules.validarHht(merged.hht);
    acidenteRules.validarCat(merged.cat);

    updates.atualizadoEm = new Date().toISOString();
    updates.atualizadoPor = sanitizeRequiredString(payload.usuarioResponsavel || payload.usuarioCadastro || 'sistema') || 'sistema';

    const atualizado = repositories.acidentes.update(id, updates);
    return atualizado;
  }
}

module.exports = new AcidenteService();
