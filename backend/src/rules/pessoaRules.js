function validarPessoa({ nome, matricula, local, cargo }) {
  if (!nome || !nome.trim()) {
    throw new Error('Nome obrigatorio');
  }
  if (!matricula || !matricula.trim()) {
    throw new Error('Matricula obrigatoria');
  }
  if (!local || !local.trim()) {
    throw new Error('Local obrigatorio');
  }
  if (!cargo || !cargo.trim()) {
    throw new Error('Cargo obrigatorio');
  }
}

module.exports = {
  validarPessoa
};
