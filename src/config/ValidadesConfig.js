// Estados iniciais e rotulos do Controle de Validades / Requisitos de Controle.
// Somente apresentacao: regras de validade, status e janela critica vem do banco.

export const VALIDADES_PAGE_SIZE = 20

export const VALIDADES_FILTER_DEFAULT = {
  termo: '',
  requisito_id: '',
  categoria: '',
  status: '',
  exigencia: 'exigido',
  cargo_id: '',
  setor_id: '',
  centro_servico_id: '',
  centro_custo_id: '',
  vencimento_de: '',
  vencimento_ate: '',
  faixa: '',
}

export const VALIDADES_REGISTRO_DEFAULT = {
  pessoaId: '',
  pessoaNome: '',
  matricula: '',
  requisitoId: '',
  dataRealizacao: '',
  numeroDocumento: '',
  entidadeEmissora: '',
  observacao: '',
}

export const REQUISITO_FORM_DEFAULT = {
  nome: '',
  codigo: '',
  categoria: 'treinamento',
  tipo: 'interno',
  descricao: '',
  possuiValidade: true,
  validadeQuantidade: '',
  validadeUnidade: 'meses',
  observacao: '',
  motivo: '',
}

export const REGRA_FORM_DEFAULT = {
  cargo_id: '',
  setor_id: '',
  centro_servico_id: '',
  centro_custo_id: '',
  pessoa_id: '',
  pessoaLabel: '',
}

export const CATEGORIA_OPTIONS = [
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'documento', label: 'Documento' },
  { value: 'capacitacao', label: 'Capacitacao' },
  { value: 'exame', label: 'Exame' },
  { value: 'outro', label: 'Outro' },
]

export const TIPO_OPTIONS = [
  { value: 'legal', label: 'Legal / normativo' },
  { value: 'interno', label: 'Interno' },
  { value: 'cliente', label: 'Exigencia de cliente' },
  { value: 'outro', label: 'Outro' },
]

export const UNIDADE_OPTIONS = [
  { value: 'meses', label: 'Meses' },
  { value: 'dias', label: 'Dias' },
]

// Ordem = gravidade (mesma ordem usada pela lista no banco). Cor sempre acompanhada do rotulo.
export const STATUS_OPTIONS = [
  { value: 'vencido', label: 'Vencido', variant: 'danger', color: '#b91c1c' },
  { value: 'vence_hoje', label: 'Vence hoje', variant: 'today', color: '#ea580c' },
  { value: 'proximo_vencimento', label: 'Proximo do vencimento', variant: 'warning', color: '#d97706' },
  { value: 'pendente', label: 'Pendente / nao realizado', variant: 'pending', color: '#4f46e5' },
  { value: 'valido', label: 'Valido', variant: 'ok', color: '#15803d' },
  { value: 'sem_validade', label: 'Sem validade', variant: 'info', color: '#0284c7' },
  { value: 'dispensado', label: 'Dispensado', variant: 'closed', color: '#7c3aed' },
]

// Graficos empilhados: 3 grupos (paleta validada para daltonismo; vermelho x laranja x amarelo nao passa).
export const GRUPOS_ATENCAO = [
  { key: 'vencidos', label: 'Vencidos', color: '#b91c1c', status: 'vencido' },
  { key: 'a_vencer', label: 'A vencer (hoje e janela critica)', color: '#d97706', status: 'vence_hoje,proximo_vencimento' },
  { key: 'pendentes', label: 'Pendentes', color: '#4f46e5', status: 'pendente' },
]

export const STATUS_FILTRO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'vencido,vence_hoje,proximo_vencimento,pendente', label: 'Atencao (vencidos, a vencer e pendentes)' },
  ...STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
  { value: 'vence_hoje,proximo_vencimento', label: 'A vencer (hoje e janela critica)' },
  { value: 'valido,sem_validade', label: 'Validos (inclui sem validade)' },
]

export const EXIGENCIA_OPTIONS = [
  { value: 'exigido', label: 'Exigidos' },
  { value: 'nao_exigido', label: 'Sem exigencia atual' },
  { value: 'dispensado', label: 'Dispensados' },
  { value: 'todos', label: 'Todos' },
]

export const FAIXA_OPTIONS = [
  { value: '0_7', label: 'Ate 7 dias' },
  { value: '8_30', label: '8 a 30 dias' },
  { value: '31_60', label: '31 a 60 dias' },
  { value: '61_90', label: '61 a 90 dias' },
]

export const HISTORICO_ACAO_LABELS = {
  criado: 'Requisito criado',
  alterado: 'Alteracao',
  validade_alterada: 'Validade alterada',
  ativado: 'Requisito ativado',
  inativado: 'Requisito inativado',
  regra_adicionada: 'Regra adicionada',
  regra_removida: 'Regra removida',
  registro: 'Realizacao registrada',
  renovacao: 'Renovacao',
  retroativo: 'Registro retroativo (historico)',
  edicao: 'Edicao',
  substituicao: 'Substituido por renovacao',
  cancelamento: 'Cancelamento',
  reativacao: 'Voltou a ser vigente',
  dispensa: 'Dispensa registrada',
  dispensa_revogada: 'Dispensa revogada',
  config_alterada: 'Configuracao alterada',
}

export const STATUS_REGISTRO_LABELS = {
  vigente: 'Vigente',
  substituido: 'Substituido',
  cancelado: 'Cancelado',
}

export const ORIGEM_REGISTRO_LABELS = {
  registro: 'Registro',
  renovacao: 'Renovacao',
  retroativo: 'Retroativo',
}
