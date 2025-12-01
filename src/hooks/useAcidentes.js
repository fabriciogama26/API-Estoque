import { useCallback, useEffect, useState } from 'react'
import { listAcidentes } from '../services/acidentesService.js'

export function useAcidentes() {
  const [acidentes, setAcidentes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listAcidentes()
      setAcidentes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Falha ao carregar acidentes.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    acidentes,
    isLoading,
    error,
    reload,
    setAcidentes,
  }
}
