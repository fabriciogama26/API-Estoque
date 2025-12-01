import { dataClient as api } from './dataClient.js'

export const updateMaterial = (id, payload) => api.materiais.update(id, payload)
