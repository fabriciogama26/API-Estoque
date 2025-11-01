// Configuracoes e estados padrao relacionados a acidentes
export const ACIDENTES_FORM_DEFAULT = {
  matricula: '',
  nome: '',
  cargo: '',
  data: '',
  diasPerdidos: '',
  diasDebitados: '',
  hht: '',
  tipo: '',
  tipos: [],
  agente: '',
  agentes: [],
  cid: '',
  lesao: '',
  lesoes: [],
  partesLesionadas: [],
  centroServico: '',
  setor: '',
  local: '',
  cat: '',
}

export const ACIDENTES_FILTER_DEFAULT = {
  termo: '',
  tipo: 'todos',
  centroServico: 'todos',
  setor: 'todos',
  agente: 'todos',
  lesao: 'todos',
}

export const ACIDENTES_HISTORY_DEFAULT = {
  open: false,
  acidente: null,
  registros: [],
  isLoading: false,
  error: null,
}
