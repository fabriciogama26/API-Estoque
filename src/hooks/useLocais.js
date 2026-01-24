import { useCallback, useEffect, useState } from 'react'
import { listLocais } from '../services/acidentesService.js'

export function useLocais() {
  const [locais, setLocais] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listLocais()
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
              return {
                id: item.id ?? null,
                nome,
                label: String(item.label ?? nome).trim() || nome,
              }
            })
            .filter(Boolean)
        : []
      setLocais(lista)
    } catch (err) {
      setError(err.message || 'Falha ao carregar locais.')
      setLocais([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    locais,
    isLoading,
    error,
    reload,
  }
}
