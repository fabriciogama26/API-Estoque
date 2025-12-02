import { dataClient as dataApi } from './dataClient.js'

export async function fetchTermoEpiContext(query) {
  return dataApi.documentos.termoEpiContext(query)
}
