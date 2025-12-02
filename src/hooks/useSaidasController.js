import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useErrorLogger } from './useErrorLogger.js'
import {
  MATERIAL_SEARCH_DEBOUNCE_MS,
  MATERIAL_SEARCH_MAX_RESULTS,
  MATERIAL_SEARCH_MIN_CHARS,
  PESSOA_SEARCH_DEBOUNCE_MS,
  PESSOA_SEARCH_MAX_RESULTS,
  PESSOA_SEARCH_MIN_CHARS,
  buildSaidasQuery,
  formatCurrency,
  formatDateToInput,
  formatDisplayDate,
  formatDisplayDateTime,
  formatMaterialSummary,
  formatPessoaDetail,
  formatPessoaSummary,
  initialSaidaFilters,
  initialSaidaForm,
  materialMatchesTerm,
  mergePessoasList,
  normalizeSearchValue,
  pessoaMatchesTerm,
} from '../utils/saidasUtils.js'
import {
  cancelSaida,
  createSaida,
  getMaterialEstoque,
  getSaidaHistory,
  listCentrosCusto,
  listCentrosServico,
  listMateriais,
  listPessoas,
  listPessoasByIds,
  listSaidas,
  searchMateriais,
  searchPessoas,
  updateSaida,
} from '../services/saidasService.js'

const HISTORY_INITIAL = {
  open: false,
  saida: null,
  registros: [],
  isLoading: false,
  error: null,
}

const CANCEL_INITIAL = {
  open: false,
  saida: null,
  motivo: '',
  isSubmitting: false,
  error: null,
}

export function useSaidasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('saidas')

  const [pessoas, setPessoas] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [centrosCustoOptions, setCentrosCustoOptions] = useState([])
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])

  const [form, setForm] = useState(initialSaidaForm)
  const [filters, setFilters] = useState(initialSaidaFilters)
  const [editingSaida, setEditingSaida] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [historyState, setHistoryState] = useState(HISTORY_INITIAL)
  const [cancelState, setCancelState] = useState(CANCEL_INITIAL)

  const [materialSearchValue, setMaterialSearchValue] = useState('')
  const [materialEstoque, setMaterialEstoque] = useState(null)
  const [materialEstoqueLoading, setMaterialEstoqueLoading] = useState(false)
  const [materialEstoqueError, setMaterialEstoqueError] = useState(null)
  const [materialSuggestions, setMaterialSuggestions] = useState([])
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false)
  const [isSearchingMaterials, setIsSearchingMaterials] = useState(false)
  const [materialSearchError, setMaterialSearchError] = useState(null)
  const materialSearchTimeoutRef = useRef(null)
  const materialBlurTimeoutRef = useRef(null)

  const [pessoaSearchValue, setPessoaSearchValue] = useState('')
  const [pessoaSuggestions, setPessoaSuggestions] = useState([])
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const [isSearchingPessoas, setIsSearchingPessoas] = useState(false)
  const [pessoaSearchError, setPessoaSearchError] = useState(null)
  const pessoaSearchTimeoutRef = useRef(null)
  const pessoaBlurTimeoutRef = useRef(null)

  const isSaidaCancelada = useCallback((saida) => {
    const texto = (saida?.status || '').toString().trim().toLowerCase()
    return texto === 'cancelado'
  }, [])

  const load = useCallback(
    async (params = filters, { resetPage = false } = {}) => {
      if (resetPage) setCurrentPage(1)
      setIsLoading(true)
      setError(null)
      try {
        const materiaisPromise = listMateriais()
        const shouldLoadCentrosCusto = centrosCustoOptions.length === 0
        const shouldLoadCentrosServico = centrosServicoOptions.length === 0
        const [pessoasData, materiaisData, saidasData, centrosCustoData, centrosServicoData] = await Promise.all([
          listPessoas(),
          materiaisPromise,
          listSaidas(buildSaidasQuery(params)),
          shouldLoadCentrosCusto ? listCentrosCusto() : Promise.resolve(null),
          shouldLoadCentrosServico ? listCentrosServico() : Promise.resolve(null),
        ])
        const pessoaIds = Array.from(new Set((saidasData ?? []).map((s) => s.pessoaId).filter(Boolean)))
        if (pessoaIds.length && listPessoasByIds) {
          try {
            const extras = await listPessoasByIds(pessoaIds)
            setPessoas(mergePessoasList(pessoasData ?? [], extras ?? []))
          } catch (extraErr) {
            console.warn('Falha ao obter pessoas adicionais.', extraErr)
            setPessoas(pessoasData ?? [])
          }
        } else {
          setPessoas(pessoasData ?? [])
        }
        setMateriais(materiaisData ?? [])
        setSaidas(saidasData ?? [])
        if (centrosCustoData) setCentrosCustoOptions(centrosCustoData ?? [])
        if (centrosServicoData) setCentrosServicoOptions(centrosServicoData ?? [])
      } catch (err) {
        setError(err.message)
        reportError(err, { area: 'saidas_load' })
      } finally {
        setIsLoading(false)
      }
    },
    [filters, centrosCustoOptions.length, centrosServicoOptions.length, reportError],
  )

  useEffect(() => {
    load(initialSaidaFilters, { resetPage: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetFormState = useCallback(() => {
    setForm({ ...initialSaidaForm })
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
    setMaterialSearchValue('')
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
    setMaterialEstoqueLoading(false)
  }, [])

  const cancelEditSaida = useCallback(() => {
    setEditingSaida(null)
    resetFormState()
    setError(null)
  }, [resetFormState])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const payload = {
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: form.quantidade,
        centroCusto: form.centroCusto,
        centroCustoId: form.centroCustoId,
        centroServico: form.centroServico,
        centroServicoId: form.centroServicoId,
        dataEntrega: form.dataEntrega,
        usuarioResponsavel: user?.id || user?.user?.id || user?.name || user?.username || 'sistema',
      }
      if (!payload.pessoaId || !payload.materialId || !payload.dataEntrega) {
        throw new Error('Preencha pessoa, material e data da entrega.')
      }
      if (editingSaida) {
        await updateSaida(editingSaida.id, payload)
      } else {
        await createSaida(payload)
      }
      cancelEditSaida()
      await load(filters, { resetPage: !editingSaida })
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'saidas_submit', editing: Boolean(editingSaida) })
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
    setFilters(initialSaidaFilters)
    load(initialSaidaFilters, { resetPage: true })
  }

  const startEditSaida = (saida) => {
    if (!saida) return
    setEditingSaida(saida)
    setForm({
      pessoaId: saida.pessoaId || '',
      materialId: saida.materialId || '',
      quantidade: String(saida.quantidade ?? ''),
      centroCusto: saida.centroCusto || '',
      centroCustoId: saida.centroCustoId || '',
      centroServico: saida.centroServico || '',
      centroServicoId: saida.centroServicoId || '',
      dataEntrega: formatDateToInput(saida.dataEntrega),
    })
    const pessoa = pessoas.find((p) => p.id === saida.pessoaId)
    if (pessoa) {
      setPessoaSearchValue(formatPessoaSummary(pessoa))
    }
    const material = materiais.find((m) => m.id === saida.materialId)
    if (material) {
      setMaterialSearchValue(formatMaterialSummary(material))
    }
  }

  const openHistory = async (saida) => {
    if (!saida?.id) return
    setHistoryState({ ...HISTORY_INITIAL, open: true, saida, isLoading: true })
    try {
      const registros = await getSaidaHistory(saida.id)
      setHistoryState({
        open: true,
        saida,
        registros: registros ?? [],
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setHistoryState({
        ...HISTORY_INITIAL,
        open: true,
        saida,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
      reportError(err, { area: 'saidas_history', saidaId: saida.id })
    }
  }

  const closeHistory = () => setHistoryState({ ...HISTORY_INITIAL })

  const openCancelModal = (saida) => setCancelState({ ...CANCEL_INITIAL, open: true, saida, motivo: '' })
  const closeCancelModal = () => setCancelState({ ...CANCEL_INITIAL })

  const handleCancelSubmit = async () => {
    if (!cancelState.saida?.id) return
    setCancelState((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      await cancelSaida(cancelState.saida.id, cancelState.motivo)
      closeCancelModal()
      await load(filters, { resetPage: false })
    } catch (err) {
      setCancelState((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Falha ao cancelar.' }))
      reportError(err, { area: 'saidas_cancel', saidaId: cancelState.saida.id })
    }
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
    if (!material) return
    setForm((prev) => ({ ...prev, materialId: material.id }))
    setMaterialSearchValue(formatMaterialSummary(material))
    setMaterialSuggestions([])
    setMaterialDropdownOpen(false)
    setMaterialSearchError(null)
    setMaterialEstoque(null)
    setMaterialEstoqueError(null)
  }

  const handleMaterialFocus = () => {
    if (!form.materialId && materialSearchValue.trim().length >= MATERIAL_SEARCH_MIN_CHARS) {
      setMaterialDropdownOpen(true)
    }
  }

  const handleMaterialBlur = () => {
    materialBlurTimeoutRef.current = setTimeout(() => {
      setMaterialDropdownOpen(false)
    }, 120)
  }

  const handlePessoaInputChange = (event) => {
    const value = event.target.value
    setPessoaSearchValue(value)
    setForm((prev) => ({ ...prev, pessoaId: '' }))
    setPessoaSearchError(null)
    if (value.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    } else {
      setPessoaDropdownOpen(false)
      setPessoaSuggestions([])
      setPessoaSearchError(null)
    }
  }

  const handlePessoaSelect = (pessoa) => {
    if (!pessoa) return
    setForm((prev) => ({
      ...prev,
      pessoaId: pessoa.id,
      centroServico: pessoa.centroServico || prev.centroServico,
      centroServicoId: pessoa.centroServicoId || prev.centroServicoId,
      centroCusto: pessoa.centroCusto || prev.centroCusto,
      centroCustoId: pessoa.centroCustoId || prev.centroCustoId,
    }))
    setPessoaSearchValue(formatPessoaSummary(pessoa))
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }

  const handlePessoaFocus = () => {
    if (!form.pessoaId && pessoaSearchValue.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    }
  }

  const handlePessoaBlur = () => {
    pessoaBlurTimeoutRef.current = setTimeout(() => {
      setPessoaDropdownOpen(false)
    }, 120)
  }

  useEffect(() => {
    return () => {
      if (materialBlurTimeoutRef.current) clearTimeout(materialBlurTimeoutRef.current)
      if (materialSearchTimeoutRef.current) clearTimeout(materialSearchTimeoutRef.current)
      if (pessoaBlurTimeoutRef.current) clearTimeout(pessoaBlurTimeoutRef.current)
      if (pessoaSearchTimeoutRef.current) clearTimeout(pessoaSearchTimeoutRef.current)
    }
  }, [])

  const fallbackMaterialSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) return []
      return materiais.filter((material) => materialMatchesTerm(material, normalized)).slice(0, MATERIAL_SEARCH_MAX_RESULTS)
    },
    [materiais],
  )

  const fallbackPessoaSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) return []
      return pessoas.filter((p) => pessoaMatchesTerm(p, normalized)).slice(0, PESSOA_SEARCH_MAX_RESULTS)
    },
    [pessoas],
  )

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
          resultados = await searchMateriais({ termo, limit: MATERIAL_SEARCH_MAX_RESULTS })
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
          reportError(err, { area: 'saidas_material_search' })
        }
      } finally {
        if (!cancelled) setIsSearchingMaterials(false)
      }
    }, MATERIAL_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (materialSearchTimeoutRef.current) {
        clearTimeout(materialSearchTimeoutRef.current)
        materialSearchTimeoutRef.current = null
      }
    }
  }, [materialSearchValue, form.materialId, fallbackMaterialSearch, reportError])

  useEffect(() => {
    if (pessoaSearchTimeoutRef.current) {
      clearTimeout(pessoaSearchTimeoutRef.current)
      pessoaSearchTimeoutRef.current = null
    }
    const termo = pessoaSearchValue.trim()
    if (form.pessoaId || termo.length < PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSuggestions([])
      setIsSearchingPessoas(false)
      setPessoaSearchError(null)
      setPessoaDropdownOpen(false)
      return
    }
    let cancelled = false
    setIsSearchingPessoas(true)
    pessoaSearchTimeoutRef.current = setTimeout(async () => {
      setPessoaSearchError(null)
      try {
        let resultados = []
        if (searchPessoas) {
          resultados = await searchPessoas({ termo, limit: PESSOA_SEARCH_MAX_RESULTS })
        } else {
          resultados = fallbackPessoaSearch(termo)
        }
        if (!cancelled) {
          setPessoaSuggestions(resultados ?? [])
          setPessoaDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setPessoaSearchError(err.message || 'Falha ao buscar pessoas.')
          setPessoaSuggestions([])
          setPessoaDropdownOpen(true)
          reportError(err, { area: 'saidas_pessoa_search' })
        }
      } finally {
        if (!cancelled) setIsSearchingPessoas(false)
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (pessoaSearchTimeoutRef.current) {
        clearTimeout(pessoaSearchTimeoutRef.current)
        pessoaSearchTimeoutRef.current = null
      }
    }
  }, [pessoaSearchValue, form.pessoaId, fallbackPessoaSearch, reportError])

  useEffect(() => {
    if (!form.materialId) return
    setMaterialEstoqueLoading(true)
    setMaterialEstoqueError(null)
    getMaterialEstoque(form.materialId)
      .then((estoque) => setMaterialEstoque(estoque))
      .catch((err) => {
        setMaterialEstoqueError(err.message || 'Falha ao obter estoque.')
        setMaterialEstoque(null)
        reportError(err, { area: 'saidas_material_estoque', materialId: form.materialId })
      })
      .finally(() => setMaterialEstoqueLoading(false))
  }, [form.materialId, reportError])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(saidas.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) return 1
      if (prev > totalPages) return totalPages
      return prev
    })
  }, [saidas.length])

  const normalizedSearchTerm = normalizeSearchValue(filters.termo)
  const startTimestamp = filters.dataInicio ? Date.parse(`${filters.dataInicio}T00:00:00Z`) : null
  const endTimestamp = filters.dataFim ? Date.parse(`${filters.dataFim}T23:59:59Z`) : null

  const saidasFiltradas = useMemo(
    () =>
      saidas.filter((saida) => {
        const dataEntrega = saida.dataEntrega ? Date.parse(saida.dataEntrega) : null
        if (startTimestamp && (dataEntrega === null || dataEntrega < startTimestamp)) return false
        if (endTimestamp && (dataEntrega === null || dataEntrega > endTimestamp)) return false
        if (filters.registradoPor) {
          const candidatos = [saida.usuarioResponsavelId, saida.usuarioResponsavel, saida.usuarioResponsavelNome]
            .map((valor) => (valor ? String(valor).trim() : ''))
          if (!candidatos.includes(filters.registradoPor)) return false
        }
        if (filters.centroCusto) {
          const candidato = normalizeSearchValue(saida.centroCusto || saida.centroCustoId || '')
          const filtro = normalizeSearchValue(filters.centroCusto)
          if (!candidato.includes(filtro)) return false
        }
        if (filters.centroServico) {
          const candidato = normalizeSearchValue(saida.centroServico || saida.centroServicoId || '')
          const filtro = normalizeSearchValue(filters.centroServico)
          if (!candidato.includes(filtro)) return false
        }
        if (filters.status) {
          const statusLower = normalizeSearchValue(saida.status)
          if (statusLower !== normalizeSearchValue(filters.status)) return false
        }
        if (normalizedSearchTerm) {
          const pessoa = pessoas.find((p) => p.id === saida.pessoaId)
          const pessoaResumo = normalizeSearchValue(pessoa ? formatPessoaSummary(pessoa) : '')
          const material = materiais.find((m) => m.id === saida.materialId)
          const materialResumo = normalizeSearchValue(material ? formatMaterialSummary(material) : '')
          if (!pessoaResumo.includes(normalizedSearchTerm) && !materialResumo.includes(normalizedSearchTerm)) {
            return false
          }
        }
        return true
      }),
    [
      saidas,
      filters.registradoPor,
      filters.centroCusto,
      filters.centroServico,
      filters.status,
      normalizedSearchTerm,
      pessoas,
      materiais,
      startTimestamp,
      endTimestamp,
    ],
  )

  const paginatedSaidas = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return saidasFiltradas.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [saidasFiltradas, currentPage])

  return {
    form,
    filters,
    saidas,
    pessoas,
    materiais,
    centrosCustoOptions,
    centrosServicoOptions,
    editingSaida,
    isSaving,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    historyState,
    cancelState,
    materialSearchValue,
    materialSuggestions,
    materialDropdownOpen,
    isSearchingMaterials,
    materialSearchError,
    materialEstoque,
    materialEstoqueLoading,
    materialEstoqueError,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    isSaidaCancelada,
    handleChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    cancelEditSaida,
    startEditSaida,
    openHistory,
    closeHistory,
    openCancelModal,
    closeCancelModal,
    handleCancelSubmit,
    handleMaterialInputChange,
    handleMaterialSelect,
    handleMaterialFocus,
    handleMaterialBlur,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    resetFormState,
    paginatedSaidas,
    saidasFiltradas,
    formatCurrency,
    formatDisplayDate,
    formatDisplayDateTime,
    formatMaterialSummary,
    formatPessoaSummary,
    formatPessoaDetail,
    setCancelState,
    setHistoryState,
  }
}
