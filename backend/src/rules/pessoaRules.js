function validarPessoa({ nome, local, cargo }) {
  if (!nome || !nome.trim()) {
    throw new Error('Nome obrigatorio');
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



