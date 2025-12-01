import { dataClient as api } from './dataClient.js'

export const listEstoqueAtual = (params = {}) => api.estoque.current(params)
