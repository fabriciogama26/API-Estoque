function validarCampoObrigatorio(valor, mensagem) {
  if (!valor || !String(valor).trim()) {
    throw new Error(mensagem);
  }
}

function validarDadosObrigatorios({
  matricula,
  nome,
  cargo,
  tipo,
  agente,
  lesao,
  parteLesionada,
  setor,
  local,
  data
}) {
  validarCampoObrigatorio(matricula, 'Matricula obrigatoria');
  validarCampoObrigatorio(nome, 'Nome obrigatorio');
  validarCampoObrigatorio(cargo, 'Cargo obrigatorio');
  validarCampoObrigatorio(tipo, 'Tipo de acidente obrigatorio');
  validarCampoObrigatorio(agente, 'Agente causador obrigatorio');
  validarCampoObrigatorio(lesao, 'Lesao obrigatoria');
  validarCampoObrigatorio(parteLesionada, 'Parte lesionada obrigatoria');
  validarCampoObrigatorio(setor, 'Setor obrigatorio');
  validarCampoObrigatorio(local, 'Local obrigatorio');
  validarCampoObrigatorio(data, 'Data do acidente obrigatoria');
}

function validarDias({ diasPerdidos, diasDebitados }) {
  const perdidos = Number(diasPerdidos);
  const debitados = Number(diasDebitados);

  if (Number.isNaN(perdidos) || perdidos < 0) {
    throw new Error('Dias perdidos deve ser zero ou positivo');
  }
  if (Number.isNaN(debitados) || debitados < 0) {
    throw new Error('Dias debitados deve ser zero ou positivo');
  }
}

function validarData(data) {
  const valor = data && String(data).trim();
  if (!valor) {
    throw new Error('Data do acidente obrigatoria');
  }
  if (Number.isNaN(Date.parse(valor))) {
    throw new Error('Data do acidente invalida');
  }
}

module.exports = {
  validarDadosObrigatorios,
  validarDias,
  validarData
};
