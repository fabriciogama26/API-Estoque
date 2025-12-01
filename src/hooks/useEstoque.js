import { useCallback, useEffect, useRef, useState } from 'react'
import { listEstoqueAtual } from '../services/estoqueApi.js'
import { updateMaterial } from '../services/materiaisService.js'

let hasRunInitialLoad = false

export function useEstoque(initialFilters, userResolver, onError) {
  const [estoque, setEstoque] = useState({ itens: [], alertas: [] })
  const [error, setError] = useState(null)
  const [minStockDrafts, setMinStockDrafts] = useState({})
  const [savingMinStock, setSavingMinStock] = useState({})
  const [minStockErrors, setMinStockErrors] = useState({})
  const initRef = useRef(false)
  const lastLoadKeyRef = useRef(null)
  const estoqueRef = useRef({ itens: [], alertas: [] })
  const lastParamsRef = useRef(null)

  const load = useCallback(
    async (params = initialFilters, { force = false, silent = false } = {}) => {
      const key = JSON.stringify(params || {})
      if (!force && lastLoadKeyRef.current === key) {
        return null
      }
      lastLoadKeyRef.current = key
      try {
        const data = await listEstoqueAtual({
          periodoInicio: params.periodoInicio || undefined,
          periodoFim: params.periodoFim || undefined,
        })
        const next = { itens: data?.itens ?? [], alertas: data?.alertas ?? [] }
        const currentKey = JSON.stringify(estoqueRef.current)
        const nextKey = JSON.stringify(next)
        if (currentKey !== nextKey) {
          setEstoque(next)
          estoqueRef.current = next
          setMinStockDrafts(() => {
            const drafts = {}
            ;(next.itens ?? []).forEach((item) => {
              drafts[item.materialId] =
                item.estoqueMinimo !== undefined && item.estoqueMinimo !== null
                  ? String(item.estoqueMinimo)
                  : ''
            })
            return drafts
          })
          setMinStockErrors({})
        }
        lastParamsRef.current = params
        return data
      } catch (err) {
        setError(err.message)
        if (typeof onError === 'function') {
          onError(err, { area: 'load_estoque' })
        }
        return null
      }
    },
    [initialFilters, onError],
  )

  useEffect(() => {
    if (initRef.current || hasRunInitialLoad) {
      return
    }
    initRef.current = true
    hasRunInitialLoad = true
    load({ ...initialFilters }, { force: true })
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
      await load({ ...filters }, { force: true })
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
    isLoading: false,
    error,
    load,
    lastParams: lastParamsRef.current,
    minStockDrafts,
    savingMinStock,
    minStockErrors,
    handleMinStockChange,
    handleMinStockSave,
    setError,
  }
}
