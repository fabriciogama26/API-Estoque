/**
 * Regras de filtragem de pessoas para uso em consultas.
 * Centraliza a lógica de quais pessoas podem aparecer em diferentes contextos.
 * 
 * @module rules/pessoaFilters
 */

/**
 * Configurações padrão de filtro para diferentes contextos de uso.
 */
export const PESSOA_FILTER_DEFAULTS = {
  // Em campos de busca (dropdowns), mostrar apenas ativos
  searchDropdown: { ativo: true },
  
  // Na listagem de pessoas (página Cadastros > Pessoas), sem filtro padrão
  listPage: { ativo: null },
  
  // Em saídas e movimentações, apenas ativos
  movimentacoes: { ativo: true },

  // Em acidentes, apenas ativos (pessoa que sofreu o acidente precisa estar ativa)
  acidentes: { ativo: true },

  // Em termos EPI, apenas ativos
  termosEpi: { ativo: true },
}

/**
 * Aplica filtro de pessoa ativa a uma query do Supabase.
 * @param {object} query - Query builder do Supabase
 * @param {object} options - Opções de filtro
 * @param {boolean} [options.includeInactive=false] - Se true, não filtra por ativo
 * @returns {object} Query com filtro aplicado
 */
export function applyActivePersonFilter(query, options = {}) {
  const { includeInactive = false } = options
  if (includeInactive) {
    return query
  }
  return query.eq('ativo', true)
}

/**
 * Verifica se uma pessoa deve ser exibida com base no status ativo.
 * Usado para filtragem em memória (fallback local).
 * @param {object} pessoa - Objeto pessoa
 * @param {object} options - Opções de filtro
 * @param {boolean} [options.includeInactive=false] - Se true, inclui inativos
 * @returns {boolean} true se a pessoa deve ser exibida
 */
export function shouldShowPessoa(pessoa, options = {}) {
  const { includeInactive = false } = options
  if (includeInactive) {
    return true
  }
  // Considera ativo se o campo não existir ou for true
  return pessoa?.ativo !== false
}

/**
 * Filtra uma lista de pessoas para mostrar apenas ativas.
 * @param {Array} pessoas - Lista de pessoas
 * @param {object} options - Opções de filtro
 * @param {boolean} [options.includeInactive=false] - Se true, retorna todos
 * @returns {Array} Lista filtrada
 */
export function filterActivePessoas(pessoas, options = {}) {
  if (!Array.isArray(pessoas)) {
    return []
  }
  const { includeInactive = false } = options
  if (includeInactive) {
    return pessoas
  }
  return pessoas.filter((p) => p?.ativo !== false)
}
