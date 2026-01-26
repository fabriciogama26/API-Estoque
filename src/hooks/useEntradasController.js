import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { useErrorLogger } from './useErrorLogger.js'
import {
  MATERIAL_SEARCH_DEBOUNCE_MS,
  MATERIAL_SEARCH_MAX_RESULTS,
  MATERIAL_SEARCH_MIN_CHARS,
  STATUS_CANCELADO_NOME,
  buildEntradasQuery,
  formatDateToInput,
  formatMaterialSummary,
  initialEntradaFilters,
  initialEntradaForm,
  isLikelyUuid,
  materialMatchesTerm,
  normalizeCentroCustoOptions,
  normalizeSearchValue,
} from '../utils/entradasUtils.js'
import {
  createEntrada,
  cancelEntrada,
  getEntradaHistory,
  listCentrosEstoque,
  listEntradas,
  listMateriais,
  listStatusEntrada,
  searchMateriais,
  updateEntrada,
} from '../services/entradasService.js'

const HISTORY_INITIAL = {
  open: false,
  entrada: null,
  registros: [],
  isLoading: false,
  error: null,
}

const CANCEL_INITIAL = {
  open: false,
  entrada: null,
  motivo: '',
  isSubmitting: false,
  error: null,
}

export function useEntradasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('entradas')
  const [materiais, setMateriais] = useState([])
  const [entradas, setEntradas] = useState([])
  const [centrosCusto, setCentrosCusto] = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [editingEntrada, setEditingEntrada] = useState(null)
  const [form, setForm] = useState(initialEntradaForm)
  const [filters, setFilters] = useState(initialEntradaFilters)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [materialSearchValue, setMaterialSearchValue] = useState('')
  const [materialSuggestions, setMaterialSuggestions] = useState([])
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false)
  const [materialSearchError, setMaterialSearchError] = useState(null)
  const materialSearchTimeoutRef = useRef(null)
  const materialBlurTimeoutRef = useRef(null)
  const [historyState, setHistoryState] = useState({ ...HISTORY_INITIAL })
  const [cancelState, setCancelState] = useState({ ...CANCEL_INITIAL })

  const load = useCallback(
    async (params = filters, { resetPage = false, refreshCatalogs = false } = {}) => {
      if (resetPage) {
        setCurrentPage(1)
      }
      setIsLoading(true)
      setError(null)
      try {
        const shouldReloadMateriais = refreshCatalogs || materiais.length === 0
        const shouldReloadCentros = refreshCatalogs || centrosCusto.length === 0
        const shouldReloadStatus = refreshCatalogs || statusOptions.length === 0
        const [materiaisData, centrosData, statusData, entradasData] = await Promise.all([
          shouldReloadMateriais ? listMateriais() : Promise.resolve(null),
          shouldReloadCentros ? listCentrosEstoque() : Promise.resolve(null),
          shouldReloadStatus ? listStatusEntrada() : Promise.resolve(null),
          listEntradas(buildEntradasQuery(params)),
        ])
        if (materiaisData) {
          setMateriais(materiaisData ?? [])
        }
        if (centrosData) {
          setCentrosCusto(normalizeCentroCustoOptions(centrosData ?? []))
        }
        if (statusData) {
          const normalizados = (statusData ?? []).map((item) => ({
            id: item.id,
            nome: item.nome || item.status || '',
          }))
          setStatusOptions(normalizados)
        }
        setEntradas(entradasData ?? [])
        if (!centrosData) {
          const derivados = normalizeCentroCustoOptions([
            ...centrosCusto,
            ...(entradasData ?? []).map((entrada) => ({
              id: entrada.centroCustoId || entrada.centroCusto,
              nome: entrada.centroCusto || entrada.centroCustoId || '',
            })),
          ])
        if (derivados.length > 0) {
          setCentrosCusto(derivados)
        }
      }
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'entradas_load', params })
    } finally {
      setIsLoading(false)
    }
  },
    [centrosCusto, filters, materiais.length, reportError],
  )

  useEffect(() => {
    load(initialEntradaFilters, { resetPage: true, refreshCatalogs: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'centroCusto') {
      setForm((prev) => ({ ...prev, centroCusto: value, materialId: '' }))
      setMaterialSearchValue('')
      setMaterialSuggestions([])
      setMaterialDropdownOpen(false)
      setMaterialSearchError(null)
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const isEditMode = Boolean(editingEntrada)
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        materialId: form.materialId,
        quantidade: form.quantidade,
        centroCusto: form.centroCusto.trim(),
        dataEntrada: form.dataEntrada,
        usuarioResponsavel: user?.id || user?.user?.id || user?.name || user?.username || 'sistema',
      }
      if (!payload.materialId) {
        throw new Error('Selecione um material valido.')
      }
      if (!payload.dataEntrada) {
        throw new Error('Informe a data da entrada.')
      }
      if (isEditMode) {
        await updateEntrada(editingEntrada.id, payload)
      } else {
        await createEntrada(payload)
      }
      cancelEdit()
      await load(filters, { resetPage: !isEditMode, refreshCatalogs: true })
    } catch (err) {
      setError(err.message)
      reportError(err, {
        area: 'entradas_submit',
        mode: isEditMode ? 'update' : 'create',
        entradaId: editingEntrada?.id || null,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    load(filters, { resetPage: true })
  }

  const handleFilterClear = () => {
    setFilters(initialEntradaFilters)
    load(initialEntradaFilters, { resetPage: true, refreshCatalogs: true }).catch((err) =>
      reportError(err, { area: 'entradas_filter_clear' }),
    )
  }

  const handleMaterialInputChange = (event) => {
    const value = event.target.value
    setMaterialSearchValue(value)
    setForm((prev) => ({ ...prev, materialId: '' }))
    setMaterialSearchError(null)
    if (value.trim().length >= MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialDropdownOpen(true)
    } else {
      setMaterialDropdownOpen(false)
      setMaterialSuggestions([])
      setMaterialSearchError(null)
    }
  }

  const handleMaterialSelect = (material) => {
    if (!material) {
      return
    }
    setForm((prev) => ({ ...prev, materialId: material.id }))
    setMaterialSearchValue(formatMaterialSummary(material))
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
  }

  const handleMaterialFocus = () => {
    if (materialBlurTimeoutRef.current) {
      clearTimeout(materialBlurTimeoutRef.current)
      materialBlurTimeoutRef.current = null
    }
    if (!form.centroCusto) {
      return
    }
    if (!form.materialId && materialSearchValue.trim().length >= MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialDropdownOpen(true)
    }
  }

  const handleMaterialBlur = () => {
    materialBlurTimeoutRef.current = setTimeout(() => {
      setMaterialDropdownOpen(false)
    }, 120)
  }

  const handleMaterialClear = () => {
    setForm((prev) => ({ ...prev, materialId: '' }))
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setEditingEntrada(null)
  }

  const startEditEntrada = (entrada) => {
    if (!entrada) {
      return
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    const material = materiaisMap.get(entrada.materialId)
    setEditingEntrada(entrada)
    setForm({
      materialId: entrada.materialId,
      quantidade: String(entrada.quantidade ?? ''),
      centroCusto: entrada.centroCustoId || entrada.centroCusto || '',
      dataEntrada: formatDateToInput(entrada.dataEntrada),
    })
    setMaterialSearchValue(material ? formatMaterialSummary(material) : entrada.materialId || '')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingEntrada(null)
    setForm({ ...initialEntradaForm })
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
  }

  const openHistory = async (entrada) => {
    if (!entrada?.id) {
      return
    }
    setHistoryState({ ...HISTORY_INITIAL, open: true, entrada, isLoading: true })
    try {
      const registros = await getEntradaHistory(entrada.id)
      setHistoryState({
        open: true,
        entrada,
        isLoading: false,
        registros: registros ?? [],
        error: null,
      })
    } catch (err) {
      setHistoryState({
        ...HISTORY_INITIAL,
        open: true,
        entrada,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
      reportError(err, { area: 'entradas_history', entradaId: entrada.id })
    }
  }

  const closeHistory = () => {
    setHistoryState({ ...HISTORY_INITIAL })
  }

  const openCancelModal = (entrada) => {
    if (!entrada) return
    setCancelState({ ...CANCEL_INITIAL, open: true, entrada })
  }

  const closeCancelModal = () => {
    setCancelState({ ...CANCEL_INITIAL })
  }

  const handleCancelSubmit = async () => {
    if (!cancelState.entrada?.id) return
    setCancelState((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      await cancelEntrada(cancelState.entrada.id, cancelState.motivo)
      closeCancelModal()
      await load(filters, { resetPage: false })
    } catch (err) {
      setCancelState((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Falha ao cancelar.' }))
      reportError(err, { area: 'entradas_cancel', entradaId: cancelState.entrada.id })
    }
  }

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [materiais])

  const centrosCustoMap = useMemo(() => {
    const map = new Map()
    centrosCusto.forEach((item) => {
      const nome = (item?.nome ?? '').toString().trim()
      if (!nome) {
        return
      }
      if (item.id) {
        map.set(item.id, nome)
      }
      map.set(nome, nome)
      map.set(normalizeSearchValue(nome), nome)
    })
    return map
  }, [centrosCusto])

  const resolveCentroCustoLabel = useCallback(
    (entrada) => {
      if (!entrada) {
        return ''
      }
      const candidatos = [entrada.centroCustoId, entrada.centroCusto]
      for (const raw of candidatos) {
        if (!raw) {
          continue
        }
        const texto = raw.toString().trim()
        if (!texto) {
          continue
        }
        const label =
          centrosCustoMap.get(raw) ||
          centrosCustoMap.get(texto) ||
          centrosCustoMap.get(normalizeSearchValue(texto))
        if (label) {
          return label
        }
        if (!isLikelyUuid(texto)) {
          return texto
        }
      }
      return entrada.centroCustoId || entrada.centroCusto || ''
    },
    [centrosCustoMap],
  )

  const registeredOptions = useMemo(() => {
    const mapa = new Map()
    entradas.forEach((entrada) => {
      const nome = entrada.usuarioResponsavelNome || entrada.usuarioResponsavel || 'Nao informado'
      const id = entrada.usuarioResponsavelId || nome
      if (!nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [entradas])

  const centroCustoFilterOptions = useMemo(() => {
    const mapa = new Map()
    entradas.forEach((entrada) => {
      const nome = resolveCentroCustoLabel(entrada)
      if (!nome) {
        return
      }
      const chave = normalizeSearchValue(nome)
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          id: entrada.centroCustoId || entrada.centroCusto || nome,
          nome,
        })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [entradas, resolveCentroCustoLabel])

  const fallbackMaterialSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      return materiais.filter((material) => materialMatchesTerm(material, normalized)).slice(0, MATERIAL_SEARCH_MAX_RESULTS)
    },
    [materiais],
  )

  useEffect(() => {
    if (!form.materialId) {
      return
    }
    const selecionado = materiaisMap.get(form.materialId)
    if (selecionado) {
      setMaterialSearchValue(formatMaterialSummary(selecionado))
    }
  }, [form.materialId, materiaisMap])

  useEffect(() => {
    if (materialSearchTimeoutRef.current) {
      clearTimeout(materialSearchTimeoutRef.current)
      materialSearchTimeoutRef.current = null
    }
    const termo = materialSearchValue.trim()
    if (form.materialId || termo.length < MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialSuggestions([])
      setIsSearchingMaterials(false)
      setMaterialSearchError(null)
      setMaterialDropdownOpen(false)
      return
    }
    let cancelled = false
    setIsSearchingMaterials(true)
    materialSearchTimeoutRef.current = setTimeout(async () => {
      setMaterialSearchError(null)
      try {
        let resultados = []
        if (searchMateriais) {
          resultados = await searchMateriais({
            termo,
            limit: MATERIAL_SEARCH_MAX_RESULTS,
          })
        } else {
          resultados = fallbackMaterialSearch(termo)
        }
        if (!cancelled) {
          setMaterialSuggestions(resultados ?? [])
          setMaterialDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setMaterialSearchError(err.message || 'Falha ao buscar materiais.')
          setMaterialSuggestions([])
          setMaterialDropdownOpen(true)
        }
        reportError(err, { area: 'entradas_material_search', termo })
      } finally {
        if (!cancelled) {
          setIsSearchingMaterials(false)
        }
      }
    }, MATERIAL_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (materialSearchTimeoutRef.current) {
        clearTimeout(materialSearchTimeoutRef.current)
        materialSearchTimeoutRef.current = null
      }
    }
  }, [materialSearchValue, form.materialId, fallbackMaterialSearch])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(entradas.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [entradas.length])

  useEffect(() => {
    return () => {
      if (materialBlurTimeoutRef.current) {
        clearTimeout(materialBlurTimeoutRef.current)
      }
    }
  }, [])

  const filteredEntradas = useMemo(() => {
    const termoNormalizado = normalizeSearchValue(filters.termo)
    const registradoPorRaw = (filters.registradoPor ?? '').toString().trim()
    const registradoPorNormalizado = normalizeSearchValue(registradoPorRaw)
    const centroCustoRaw = (filters.centroCusto ?? '').toString().trim()
    const centroCustoNormalizado = normalizeSearchValue(centroCustoRaw)
    const statusRaw = (filters.status ?? '').toString().trim()
    const statusNormalizado = normalizeSearchValue(statusRaw)

    return entradas.filter((entrada) => {
      if (centroCustoRaw) {
        const resolvedCentro = resolveCentroCustoLabel(entrada)
        const centroCompare = normalizeSearchValue(resolvedCentro || entrada.centroCusto || entrada.centroCustoId || '')
        if (centroCompare !== centroCustoNormalizado && normalizeSearchValue(entrada.centroCustoId) !== centroCustoNormalizado) {
          return false
        }
      }

      if (statusRaw) {
        const statusId = (entrada?.statusId || '').toString().trim()
        if (statusId) {
          if (statusId !== statusRaw) {
            return false
          }
        } else {
          const statusNome = normalizeSearchValue(entrada?.statusNome || entrada?.status || '')
          if (statusNome !== statusNormalizado) {
            return false
          }
        }
      }

      if (registradoPorRaw) {
        const usuarioId = (entrada?.usuarioResponsavelId || '').toString().trim()
        if (usuarioId) {
          if (usuarioId !== registradoPorRaw) {
            return false
          }
        } else {
          const usuarioNome = normalizeSearchValue(entrada?.usuarioResponsavelNome || entrada?.usuarioResponsavel || '')
          if (usuarioNome !== registradoPorNormalizado) {
            return false
          }
        }
      }

      if (!termoNormalizado) {
        return true
      }

      const material = materiaisMap.get(entrada.materialId)
      if (materialMatchesTerm(material, termoNormalizado)) {
        return true
      }

      const extraCampos = [
        entrada?.materialId,
        entrada?.centroCusto,
        entrada?.centroCustoId,
        entrada?.usuarioResponsavel,
        entrada?.statusNome,
        entrada?.status,
      ]
      return extraCampos
        .map(normalizeSearchValue)
        .some((campo) => campo && campo.includes(termoNormalizado))
    })
  }, [entradas, filters, materiaisMap, resolveCentroCustoLabel])

  const paginatedEntradas = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return filteredEntradas.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [filteredEntradas, currentPage])

  const shouldShowMaterialDropdown =
    materialDropdownOpen &&
    !form.materialId &&
    (isSearchingMaterials || materialSearchError || materialSuggestions.length > 0)

  const hasCentrosCusto = centrosCusto.length > 0
  const isEditing = Boolean(editingEntrada)

  const isEntradaCancelada = useCallback((entrada) => {
    if (!entrada) return false
    const status = (entrada.statusNome || entrada.status || '').toString().trim().toUpperCase()
    const id = (entrada.statusId || '').toString().trim().toUpperCase()
    return status === STATUS_CANCELADO_NOME || id === STATUS_CANCELADO_NOME
  }, [])

  return {
    form,
    filters,
    entradas,
    materiais,
    centrosCusto,
    materiaisMap,
    registeredOptions,
    centroCustoFilterOptions,
    resolveCentroCustoLabel,
    statusOptions,
    isSaving,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    filteredEntradas,
    paginatedEntradas,
    statusOptions,
    load,
    handleChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleMaterialInputChange,
    handleMaterialSelect,
    handleMaterialFocus,
    handleMaterialBlur,
    handleMaterialClear,
    materialSearchValue,
    materialSuggestions,
    materialDropdownOpen,
    shouldShowMaterialDropdown,
    isSearchingMaterials,
    materialSearchError,
    startEditEntrada,
    cancelEdit,
    openHistory,
    closeHistory,
    historyState,
    hasCentrosCusto,
    isEditing,
    cancelState,
    openCancelModal,
    closeCancelModal,
    handleCancelSubmit,
    isEntradaCancelada,
    setCancelState,
  }
}
