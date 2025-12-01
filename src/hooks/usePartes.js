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
      setPartes(Array.isArray(data) ? data : [])
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
