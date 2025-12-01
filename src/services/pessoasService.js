import { dataClient as api } from './dataClient.js'

// Acesso centralizado aos dados de pessoas
export const listPessoas = () => api.pessoas.list()
