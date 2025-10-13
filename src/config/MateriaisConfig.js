
// Configurações e estados padrão relacionados a materiais
export const MATERIAIS_FORM_DEFAULT = {
  nome: '',
  fabricante: '',
  validadeDias: '',
  ca: '',
  valorUnitario: '',
  grupoMaterial: '',
  numeroCalcado: '',
  numeroVestimenta: '',
}

// Filtro padrão de materiais
export const MATERIAIS_FILTER_DEFAULT = {
  termo: '',
  status: 'todos',
}

// Estado padrão do modal de histórico de movimentações
export const HISTORY_MODAL_DEFAULT = {
  open: false,
  material: null,
  items: [],
  isLoading: false,
  error: null,
}
