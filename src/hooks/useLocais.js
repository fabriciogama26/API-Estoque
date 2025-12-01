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
      setLocais(Array.isArray(data) ? data : [])
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
