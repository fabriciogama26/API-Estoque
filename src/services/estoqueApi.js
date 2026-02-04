import { dataClient as api } from './dataClient.js'

export const listEstoqueAtual = (params = {}) => api.estoque.current(params)
export const fetchEstoqueForecast = (params = {}) => api.estoque.forecast(params)
export const updateEstoqueForecast = (params = {}) => api.estoque.forecastUpdate(params)
