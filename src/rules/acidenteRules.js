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
  centroServico,
  data
}) {
  validarCampoObrigatorio(matricula, 'Matricula obrigatoria');
  validarCampoObrigatorio(nome, 'Nome obrigatorio');
  validarCampoObrigatorio(cargo, 'Cargo obrigatorio');
  validarCampoObrigatorio(tipo, 'Tipo de acidente obrigatorio');
  validarCampoObrigatorio(agente, 'Agente causador obrigatorio');
  validarCampoObrigatorio(lesao, 'Lesao obrigatoria');
  validarCampoObrigatorio(parteLesionada, 'Parte lesionada obrigatoria');
  validarCampoObrigatorio(centroServico, 'Centro de servico obrigatorio');
  validarCampoObrigatorio(data, 'Data do acidente obrigatoria');
}

function validarDias({ diasPerdidos, diasDebitados }) {
  const perdidos = Number(diasPerdidos);
  const debitados = Number(diasDebitados);

  if (!Number.isInteger(perdidos) || perdidos < 0) {
    throw new Error('Dias perdidos deve ser zero ou positivo');
  }
  if (!Number.isInteger(debitados) || debitados < 0) {
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

function validarHht(hht) {
  if (hht === undefined || hht === null || hht === '') {
    return;
  }
  const valor = Number(hht);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error('HHT deve ser zero ou positivo');
  }
}

function validarCat(cat) {
  const valor = cat && String(cat).trim();
  if (!valor) {
    return;
  }
  if (!/^\d+$/.test(valor)) {
    throw new Error('CAT deve conter apenas numeros inteiros');
  }
}

module.exports = {
  validarDadosObrigatorios,
  validarDias,
  validarData,
  validarHht,
  validarCat
};
