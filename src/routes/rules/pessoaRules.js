function validarPessoa({ nome, matricula, centroServico, cargo, tipoExecucao }) {
  if (!nome || !nome.trim()) {
    throw new Error('Nome obrigatorio');
  }
  if (!matricula || !matricula.trim()) {
    throw new Error('Matricula obrigatoria');
  }
  if (!centroServico || !centroServico.trim()) {
    throw new Error('Centro de servico obrigatorio');
  }
  if (!cargo || !cargo.trim()) {
    throw new Error('Cargo obrigatorio');
  }
  if (!tipoExecucao || !tipoExecucao.trim()) {
    throw new Error('Tipo Execucao obrigatorio');
  }
}

module.exports = {
  validarPessoa
};
