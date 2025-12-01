export const CURRENT_YEAR = new Date().getFullYear()

export const initialDashboardFilters = () => ({
  ano: String(CURRENT_YEAR),
  unidade: 'todas',
  periodoInicio: `${CURRENT_YEAR}-01`,
  periodoFim: `${CURRENT_YEAR}-12`,
  centroServico: '',
  tipo: '',
  lesao: '',
  parteLesionada: '',
  agente: '',
  cargo: '',
})

export const EMPTY_DASHBOARD_STATE = {
  resumo: null,
  tendencia: [],
  tipos: [],
  partesLesionadas: [],
  lesoes: [],
  cargos: [],
  agentes: [],
}

export const EMPTY_FILTER_OPTIONS = {
  centrosServico: [],
  tipos: [],
  lesoes: [],
  partesLesionadas: [],
  agentes: [],
  cargos: [],
}

export const CHART_INFO_MESSAGES = {
  tendencia:
    'Combina o total mensal de acidentes com as taxas de frequencia/gravidade calculadas a partir do HHT informado nas fichas.',
  tipos: 'Mostra a proporcao de cada tipo de acidente registrado para o periodo filtrado.',
  partes: 'Agrupa as partes lesionadas principais selecionadas em cada acidente.',
  lesoes: 'Distribui as lesoes principais registradas nas fichas (considera multiplas lesoes).',
  cargos: 'Total de acidentes em relacao ao cargo informado na ficha do colaborador.',
  agentes: 'Distribuicao dos agentes causadores (considera multiplos agentes por acidente).',
}
