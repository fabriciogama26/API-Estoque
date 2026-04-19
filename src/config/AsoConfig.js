export const ASO_FORM_DEFAULT = {
  pessoaId: '',
  matricula: '',
  nome: '',
  tipoExameId: '',
  dataExame: '',
  proximoVencimento: '',
  observacao: '',
}

export const ASO_FILTER_DEFAULT = {
  termo: '',
  tipoExameId: '',
  status: '',
  dataInicio: '',
  dataFim: '',
  centroServico: '',
  setor: '',
  cargo: '',
}

export const ASO_HISTORY_DEFAULT = {
  open: false,
  aso: null,
  registros: [],
  isLoading: false,
  error: null,
}

export const ASO_REGISTER_EXAM_DEFAULT = {
  open: false,
  aso: null,
  proximoTipoExameId: '',
  dataRealizada: '',
  observacao: '',
  isSaving: false,
  error: null,
}

export const ASO_CONFLICT_DEFAULT = {
  open: false,
  title: '',
  message: '',
  existing: null,
  canContinue: false,
  openExistingLabel: 'Ver registro existente',
  pendingPayload: null,
}

export const ASO_PESSOA_SEARCH_MIN_CHARS = 2
export const ASO_PESSOA_SEARCH_DEBOUNCE_MS = 250
