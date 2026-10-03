// Paginacao das listas de Entradas e Saidas quando a fonte nao pagina no banco (modo local).
import { getTrocaPrazoStatus } from './saidasUtils.js'

export const paginarNoNavegador = (lista, { page = 1, pageSize = 20 } = {}) => {
  const registros = Array.isArray(lista) ? lista : []
  const pagina = Math.max(1, Number(page) || 1)
  const limite = Math.max(1, Number(pageSize) || 20)
  return {
    itens: registros.slice((pagina - 1) * limite, pagina * limite),
    total: registros.length,
    page: pagina,
    pageSize: limite,
  }
}

export const registrantesDaLista = (lista) => {
  const mapa = new Map()
  ;(Array.isArray(lista) ? lista : []).forEach((registro) => {
    const nome = registro?.usuarioResponsavelNome || registro?.usuarioResponsavel || ''
    const id = registro?.usuarioResponsavelId || nome
    if (id && nome && !mapa.has(id)) {
      mapa.set(id, { id, nome })
    }
  })
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const filtrarTrocasNoNavegador = (lista, { trocaOnly = false, trocaPrazo = '' } = {}) => {
  let registros = Array.isArray(lista) ? lista : []
  if (trocaOnly) {
    registros = registros.filter((saida) => Boolean(saida?.isTroca))
  }
  const prazo = String(trocaPrazo || '').trim()
  if (prazo) {
    registros = registros.filter((saida) => {
      const status = getTrocaPrazoStatus(saida?.dataTroca)
      return prazo === 'sem-data' ? !status : status?.variant === prazo
    })
  }
  return registros
}
