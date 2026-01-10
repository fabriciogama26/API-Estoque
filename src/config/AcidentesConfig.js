// Configuracoes e estados padrao relacionados a acidentes
export const ACIDENTES_FORM_DEFAULT = {
  matricula: '',
  nome: '',
  cargo: '',
  data: '',
  dataEsocial: '',
  sesmt: false,
  dataSesmt: '',
  diasPerdidos: '',
  diasDebitados: '',
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
  observacao: '',
}

export const ACIDENTES_FILTER_DEFAULT = {
  termo: '',
  tipo: 'todos',
  centroServico: 'todos',
  setor: 'todos',
  agente: 'todos',
  lesao: 'todos',
  parteLesionada: 'todos',
  apenasSesmt: false,
  apenasEsocial: false,
}

export const ACIDENTES_HISTORY_DEFAULT = {
  open: false,
  acidente: null,
  registros: [],
  isLoading: false,
  error: null,
}
