export const PESSOAS_FORM_DEFAULT = {
  nome: '',
  matricula: '',
  centroServico: '',
  setor: '',
  cargo: '',
  local: '',
  dataAdmissao: '',
  dataDemissao: '',
  tipoExecucao: '',
  ativo: true,
  observacao: '',
}

export const PESSOAS_FILTER_DEFAULT = {
  termo: '',
  centroServico: 'todos',
  setor: 'todos',
  cargo: 'todos',
  local: 'todos',
  tipoExecucao: 'todos',
  status: 'todos',
  cadastradoInicio: '',
  cadastradoFim: '',
}

export const PESSOAS_HISTORY_DEFAULT = {
  open: false,
  pessoa: null,
  registros: [],
  isLoading: false,
  error: null,
}
