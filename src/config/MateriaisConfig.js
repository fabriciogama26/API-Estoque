
// Configurações e estados padrão relacionados a materiais
export const createMateriaisFormDefault = () => ({
  nome: '',
  materialItemId: '',
  fabricante: '',
  validadeDias: '',
  ca: '',
  valorUnitario: '',
  grupoMaterialId: '',
  grupoMaterial: '',
  grupoMaterialNome: '',
  numeroCalcado: '',
  numeroCalcadoNome: '',
  numeroVestimenta: '',
  numeroVestimentaNome: '',
  caracteristicaEpi: [],
  caracteristicas_epi: [],
  corMaterial: '',
  cores: [],
  coresIds: [],
  descricao: '',
})

// Filtro padrão de materiais
export const MATERIAIS_FILTER_DEFAULT = {
  termo: '',
  status: 'todos',
  grupo: '',
  tamanho: '',
  fabricante: '',
  caracteristica: '',
  cor: '',
}

// Estado padrão do modal de histórico de movimentações
export const HISTORY_MODAL_DEFAULT = {
  open: false,
  material: null,
  items: [],
  isLoading: false,
  error: null,
}
