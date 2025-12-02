import { dataClient as api } from './dataClient.js'

export const listMateriaisDetalhado = () => api.materiais.listDetalhado()
export const getMaterial = (id) => api.materiais.get(id)
export const createMaterial = (payload) => api.materiais.create(payload)
export const updateMaterial = (id, payload) => api.materiais.update(id, payload)
export const priceHistory = (id) => api.materiais.priceHistory(id)
export const listGrupos = () => api.materiais.groups()
export const listFabricantes = () => (api.materiais.fabricantes ? api.materiais.fabricantes() : [])
export const listCaracteristicas = () => api.materiais.caracteristicas()
export const listCores = () => api.materiais.cores()
export const listCalcados = () => api.materiais.medidasCalcado()
export const listTamanhos = () => api.materiais.medidasVestimenta()
export const listItensDoGrupo = (grupoId) => api.materiais.items(grupoId)
