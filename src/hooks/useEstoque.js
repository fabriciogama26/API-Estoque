import { useCallback, useEffect, useState } from 'react'
import { listEstoqueAtual } from '../services/estoqueApi.js'
import { updateMaterial } from '../services/materiaisService.js'

export function useEstoque(initialFilters, userResolver, onError) {
  const [estoque, setEstoque] = useState({ itens: [], alertas: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [minStockDrafts, setMinStockDrafts] = useState({})
  const [savingMinStock, setSavingMinStock] = useState({})
  const [minStockErrors, setMinStockErrors] = useState({})

  const load = useCallback(
    async (params = initialFilters) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listEstoqueAtual({
          periodoInicio: params.periodoInicio || undefined,
          periodoFim: params.periodoFim || undefined,
        })
        setEstoque({ itens: data?.itens ?? [], alertas: data?.alertas ?? [] })
        setMinStockDrafts(() => {
          const drafts = {}
          ;(data?.itens ?? []).forEach((item) => {
            drafts[item.materialId] =
              item.estoqueMinimo !== undefined && item.estoqueMinimo !== null
                ? String(item.estoqueMinimo)
                : ''
          })
          return drafts
        })
        setMinStockErrors({})
      } catch (err) {
        setError(err.message)
        if (typeof onError === 'function') {
          onError(err, { area: 'load_estoque' })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [initialFilters, onError],
  )

  useEffect(() => {
    load({ ...initialFilters })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMinStockChange = (materialId, value) => {
    setMinStockDrafts((prev) => ({ ...prev, [materialId]: value }))
  }

  const handleMinStockSave = async (item, filters, onError) => {
    const draftValue = (minStockDrafts[item.materialId] ?? '').trim()
    if (draftValue === '') {
      setMinStockErrors((prev) => ({ ...prev, [item.materialId]: 'Informe um valor' }))
      return
    }

    const parsed = Number(draftValue)
    if (Number.isNaN(parsed) || parsed < 0) {
      setMinStockErrors((prev) => ({ ...prev, [item.materialId]: 'Valor invalido' }))
      return
    }

    if (Number(item.estoqueMinimo ?? 0) === parsed) {
      setMinStockErrors((prev) => {
        const next = { ...prev }
        delete next[item.materialId]
        return next
      })
      return
    }

    setMinStockErrors((prev) => {
      const next = { ...prev }
      delete next[item.materialId]
      return next
    })

    setSavingMinStock((prev) => ({ ...prev, [item.materialId]: true }))
    try {
      const usuario = typeof userResolver === 'function' ? userResolver() : 'sistema'
      await updateMaterial(item.materialId, {
        estoqueMinimo: parsed,
        usuarioResponsavel: usuario,
      })
      await load({ ...filters })
    } catch (err) {
      setError(err.message)
      if (typeof onError === 'function') {
        onError(err, { materialId: item.materialId })
      }
    } finally {
      setSavingMinStock((prev) => {
        const next = { ...prev }
        delete next[item.materialId]
        return next
      })
    }
  }

  return {
    estoque,
    isLoading,
    error,
    load,
    minStockDrafts,
    savingMinStock,
    minStockErrors,
    handleMinStockChange,
    handleMinStockSave,
    setError,
  }
}
