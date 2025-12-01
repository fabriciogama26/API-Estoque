import { useCallback, useEffect, useState } from 'react'
import { listPessoas } from '../services/pessoasService.js'

export function usePessoas() {
  const [pessoas, setPessoas] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listPessoas()
      setPessoas(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Falha ao carregar pessoas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    pessoas,
    isLoading,
    error,
    reload,
  }
}
