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
  exportarEntradas,
  getEntradaHistory,
  getSaldoMaterialCentro,
  listCentrosEstoque,
  listEntradasPagina,
  listMateriais,
  listRegistrantesEntradas,
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
  checkLoading: false,
  canCancel: true,
  checkMessage: '',
  checkDetails: null,
  materialLabel: '',
}

export function useEntradasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('entradas')
  const userScopeKey = useMemo(() => {
    const authId = user?.id ?? user?.user?.id ?? ''
    const ownerId = user?.metadata?.app_user_id ?? user?.metadata?.dependent_of ?? ''
    return `${authId}|${ownerId}`
  }, [user?.id, user?.user?.id, user?.metadata?.app_user_id, user?.metadata?.dependent_of])
  const [materiais, setMateriais] = useState([])
  const [entradas, setEntradas] = useState([])
  const [totalEntradas, setTotalEntradas] = useState(0)
  const [registrantes, setRegistrantes] = useState([])
  const [centrosCusto, setCentrosCusto] = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [editingEntrada, setEditingEntrada] = useState(null)
  const [form, setForm] = useState(initialEntradaForm)
  const [filters, setFilters] = useState(initialEntradaFilters)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  // Filtros da ultima consulta: a lista so muda ao clicar em Aplicar.
  const filtrosAplicadosRef = useRef(initialEntradaFilters)
  const paginaAtualRef = useRef(1)
  const [materialSearchValue, setMaterialSearchValue] = useState('')
  const [materialSuggestions, setMaterialSuggestions] = useState([])
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false)
  const [materialSearchError, setMaterialSearchError] = useState(null)
  const materialSearchTimeoutRef = useRef(null)
  const materialBlurTimeoutRef = useRef(null)
  const [historyState, setHistoryState] = useState({ ...HISTORY_INITIAL })
  const [cancelState, setCancelState] = useState({ ...CANCEL_INITIAL })
  const cancelCheckRef = useRef(0)

  const load = useCallback(
    async (params = filtrosAplicadosRef.current, { resetPage = false, refreshCatalogs = false, page = null } = {}) => {
      const paginaAlvo = resetPage ? 1 : Math.max(1, Number(page ?? paginaAtualRef.current) || 1)
      setIsLoading(true)
      setError(null)
      try {
        const shouldReloadMateriais = refreshCatalogs || materiais.length === 0
        const shouldReloadCentros = refreshCatalogs || centrosCusto.length === 0
        const shouldReloadStatus = refreshCatalogs || statusOptions.length === 0
        const query = buildEntradasQuery(params)
        const [materiaisData, centrosData, statusData, registrantesData, pagina] = await Promise.all([
          shouldReloadMateriais ? listMateriais() : Promise.resolve(null),
          shouldReloadCentros ? listCentrosEstoque() : Promise.resolve(null),
          shouldReloadStatus ? listStatusEntrada() : Promise.resolve(null),
          refreshCatalogs || registrantes.length === 0 ? listRegistrantesEntradas() : Promise.resolve(null),
          listEntradasPagina(query, { page: paginaAlvo, pageSize: TABLE_PAGE_SIZE }),
        ])
        let resultado = pagina
        const ultimaPagina = Math.max(1, Math.ceil((resultado?.total ?? 0) / TABLE_PAGE_SIZE))
        if (!resultado?.itens?.length && paginaAlvo > ultimaPagina) {
          resultado = await listEntradasPagina(query, { page: ultimaPagina, pageSize: TABLE_PAGE_SIZE })
        }
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
        if (registrantesData) {
          setRegistrantes(registrantesData ?? [])
        }
        filtrosAplicadosRef.current = params
        paginaAtualRef.current = resultado?.page ?? paginaAlvo
        setEntradas(resultado?.itens ?? [])
        setTotalEntradas(resultado?.total ?? 0)
        setCurrentPage(paginaAtualRef.current)
      } catch (err) {
        setError(err.message)
        reportError(err, { area: 'entradas_load', params })
      } finally {
        setIsLoading(false)
      }
    },
    [centrosCusto.length, materiais.length, registrantes.length, reportError, statusOptions.length],
  )

  const goToPage = useCallback(
    (pagina) => {
      load(filtrosAplicadosRef.current, { page: pagina }).catch((err) => reportError(err, { area: 'entradas_page' }))
    },
    [load, reportError],
  )

  // Todas as entradas dos filtros aplicados (nao so a pagina aberta), para a exportacao.
  const exportEntradas = useCallback(
    () => exportarEntradas(buildEntradasQuery(filtrosAplicadosRef.current)),
    [],
  )

  useEffect(() => {
    setMateriais([])
    setEntradas([])
    setTotalEntradas(0)
    setRegistrantes([])
    filtrosAplicadosRef.current = initialEntradaFilters
    paginaAtualRef.current = 1
    setCentrosCusto([])
    setStatusOptions([])
    setEditingEntrada(null)
    setForm(initialEntradaForm)
    setFilters(initialEntradaFilters)
    setCurrentPage(1)
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    load(initialEntradaFilters, { resetPage: true, refreshCatalogs: true }).catch((err) =>
      reportError(err, { area: 'entradas_scope_change', userScopeKey }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userScopeKey])

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
      await load(filtrosAplicadosRef.current, { resetPage: !isEditMode, refreshCatalogs: true })
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
    const material = entrada.material || materiaisMap.get(entrada.materialId)
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

  const resolveMaterialLabel = useCallback(
    (entrada) => {
      if (!entrada?.materialId) {
        return 'Material nao informado'
      }
      const material = entrada.material || materiais.find((item) => item.id === entrada.materialId)
      return material ? formatMaterialSummary(material) : entrada.materialId
    },
    [materiais],
  )

  const isRegistroCancelado = (registro) => {
    const status = (registro?.statusNome || registro?.status || '').toString().trim().toLowerCase()
    return status === STATUS_CANCELADO_NOME.toLowerCase() || status === 'cancelado'
  }

  const validarCancelamentoEntrada = useCallback(
    async (entrada) => {
      if (!entrada?.materialId) {
        setCancelState((prev) => ({
          ...prev,
          checkLoading: false,
          canCancel: true,
          checkMessage: 'Nao foi possivel validar: material nao informado.',
        }))
        return
      }

      const requestId = cancelCheckRef.current + 1
      cancelCheckRef.current = requestId
      setCancelState((prev) => ({
        ...prev,
        checkLoading: true,
        canCancel: true,
        checkMessage: '',
        checkDetails: null,
      }))

      try {
        // Mesma regra do banco (validar_cancelamento_entrada): o saldo do centro nao pode ficar negativo.
        const saldoAtual = await getSaldoMaterialCentro(entrada.materialId, entrada.centroCustoId)
        if (cancelCheckRef.current !== requestId) {
          return
        }
        const quantidadeEntrada = isRegistroCancelado(entrada) ? 0 : Number(entrada.quantidade ?? 0)
        const saldoAposCancelar = saldoAtual - quantidadeEntrada

        const canCancel = saldoAposCancelar >= 0
        const materialLabel = resolveMaterialLabel(entrada)
        const checkMessage = canCancel
          ? `Cancelamento permitido para ${materialLabel}.`
          : `Nao e possivel cancelar ${materialLabel}: o saldo do centro ficaria negativo (${saldoAposCancelar}).`

        setCancelState((prev) => ({
          ...prev,
          checkLoading: false,
          canCancel,
          checkMessage,
          checkDetails: {
            saldoAtual,
            saldoAposCancelar,
          },
          materialLabel,
        }))
      } catch (err) {
        if (cancelCheckRef.current !== requestId) {
          return
        }
        setCancelState((prev) => ({
          ...prev,
          checkLoading: false,
          canCancel: true,
          checkMessage: err?.message || 'Nao foi possivel validar o cancelamento.',
          checkDetails: null,
        }))
      }
    },
    [resolveMaterialLabel],
  )

  const openCancelModal = (entrada) => {
    if (!entrada) return
    const materialLabel = resolveMaterialLabel(entrada)
    setCancelState({ ...CANCEL_INITIAL, open: true, entrada, materialLabel })
    validarCancelamentoEntrada(entrada)
  }

  const closeCancelModal = () => {
    setCancelState({ ...CANCEL_INITIAL })
  }

  const handleCancelSubmit = async () => {
    if (!cancelState.entrada?.id) return
    if (cancelState.checkLoading) return
    if (cancelState.canCancel === false) {
      setCancelState((prev) => ({
        ...prev,
        error: prev.checkMessage || 'Nao e possivel cancelar esta entrada.',
      }))
      return
    }
    setCancelState((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      await cancelEntrada(cancelState.entrada.id, cancelState.motivo)
      closeCancelModal()
      await load(filtrosAplicadosRef.current, { resetPage: false })
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

  const registeredOptions = registrantes

  const centroCustoFilterOptions = useMemo(
    () =>
      centrosCusto
        .filter((centro) => centro?.id && centro?.nome)
        .map((centro) => ({ id: centro.id, nome: centro.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [centrosCusto],
  )

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
    return () => {
      if (materialBlurTimeoutRef.current) {
        clearTimeout(materialBlurTimeoutRef.current)
      }
    }
  }, [])

  // A pagina ja vem filtrada e paginada do banco.
  const filteredEntradas = entradas
  const paginatedEntradas = entradas

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
    setCurrentPage: goToPage,
    totalEntradas,
    exportEntradas,
    filteredEntradas,
    paginatedEntradas,
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
