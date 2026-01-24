import { useCallback, useEffect, useState } from 'react'
import { listPartes } from '../services/acidentesService.js'

export function usePartes() {
  const [partes, setPartes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listPartes()
      const lista = Array.isArray(data)
        ? data
            .map((item) => {
              if (!item) {
                return null
              }
              if (typeof item === 'string') {
                const nome = item.trim()
                return nome ? { id: null, nome, label: nome } : null
              }
              const nome = String(item.nome ?? item.label ?? item.value ?? '').trim()
              if (!nome) {
                return null
              }
              const label = String(item.label ?? nome).trim() || nome
              return {
                id: item.id ?? null,
                nome,
                label,
                grupoId: item.grupoId ?? null,
                subgrupoId: item.subgrupoId ?? null,
              }
            })
            .filter(Boolean)
        : []
      setPartes(lista)
    } catch (err) {
      setError(err.message || 'Falha ao carregar partes lesionadas.')
      setPartes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    partes,
    isLoading,
    error,
    reload,
  }
}
