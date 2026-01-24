import { useCallback, useEffect, useState } from 'react'
import { listAgentes } from '../services/acidentesService.js'
import { normalizeAgenteNome } from '../utils/acidentesUtils.js'

export function useAgentes() {
  const [agentes, setAgentes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listAgentes()
      const lista = Array.isArray(response)
        ? response
            .map((item) => {
              if (!item) {
                return null
              }
              if (typeof item === 'string') {
                const nome = normalizeAgenteNome(item)
                return nome ? { id: null, nome } : null
              }
              const nome = normalizeAgenteNome(item.nome ?? item.label ?? item.value)
              if (!nome) {
                return null
              }
              return {
                id: item.id ?? item.agenteId ?? null,
                nome,
                label: item.label ?? nome,
              }
            })
            .filter(Boolean)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        : []
      setAgentes(lista)
    } catch (err) {
      setError(err.message || 'Falha ao carregar agentes.')
      setAgentes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    agentes,
    isLoading,
    error,
    reload,
  }
}
