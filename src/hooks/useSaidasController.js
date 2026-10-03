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
  formatDisplayDateSimple,
  formatDisplayDate,
  formatDisplayDateTime,
  formatMaterialSummary,
  formatPessoaDetail,
  formatPessoaSummary,
  getTrocaPrazoStatus,
  initialSaidaFilters,
  initialSaidaForm,
  materialMatchesTerm,
  normalizeSearchValue,
  pessoaMatchesTerm,
} from '../utils/saidasUtils.js'
import {
  cancelSaida,
  createSaida,
  exportarSaidas,
  getMaterialEstoque,
  getSaidaHistory,
  listCentrosEstoque,
  listCentrosCusto,
  listCentrosServico,
  listMateriais,
  listPessoas,
  listRegistrantesSaidas,
  listSaidasPagina,
  listStatusSaida,
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

const TROCA_PROMPT_INITIAL = {
  open: false,
  payload: null,
  details: null,
}

export function useSaidasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('saidas')
  const userScopeKey = useMemo(() => {
    const authId = user?.id ?? user?.user?.id ?? ''
    const ownerId = user?.metadata?.app_user_id ?? user?.metadata?.dependent_of ?? ''
    return `${authId}|${ownerId}`
  }, [user?.id, user?.user?.id, user?.metadata?.app_user_id, user?.metadata?.dependent_of])

  const [pessoas, setPessoas] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [totalSaidas, setTotalSaidas] = useState(0)
  const [registrantes, setRegistrantes] = useState([])
  // Muda a cada carga da lista; o saldo do material no formulario e reconsultado depois de cada saida.
  const [saidasVersao, setSaidasVersao] = useState(0)
  const [centrosEstoqueOptions, setCentrosEstoqueOptions] = useState([])
  const [centrosCustoOptions, setCentrosCustoOptions] = useState([])
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])
  const [statusOptions, setStatusOptions] = useState([])

  const [form, setForm] = useState(initialSaidaForm)
  const [filters, setFilters] = useState(initialSaidaFilters)
  const [editingSaida, setEditingSaida] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  // Filtros da ultima consulta: a lista so muda ao clicar em Aplicar.
  const filtrosAplicadosRef = useRef(initialSaidaFilters)
  const paginaAtualRef = useRef(1)
  const [historyState, setHistoryState] = useState(HISTORY_INITIAL)
  const [cancelState, setCancelState] = useState(CANCEL_INITIAL)
  const [trocaPrompt, setTrocaPrompt] = useState(TROCA_PROMPT_INITIAL)

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
  const materialSaldoCacheRef = useRef(new Map())

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
    async (params = filtrosAplicadosRef.current, { resetPage = false, refreshCatalogs = false, page = null } = {}) => {
      const paginaAlvo = resetPage ? 1 : Math.max(1, Number(page ?? paginaAtualRef.current) || 1)
      setIsLoading(true)
      setError(null)
      try {
        const query = buildSaidasQuery(params)
        const [
          pessoasData,
          materiaisData,
          pagina,
          centrosEstoqueData,
          centrosCustoData,
          centrosServicoData,
          statusData,
          registrantesData,
        ] = await Promise.all([
          refreshCatalogs || pessoas.length === 0 ? listPessoas() : Promise.resolve(null),
          refreshCatalogs || materiais.length === 0 ? listMateriais() : Promise.resolve(null),
          listSaidasPagina(query, { page: paginaAlvo, pageSize: TABLE_PAGE_SIZE }),
          centrosEstoqueOptions.length === 0 ? listCentrosEstoque() : Promise.resolve(null),
          centrosCustoOptions.length === 0 ? listCentrosCusto() : Promise.resolve(null),
          centrosServicoOptions.length === 0 ? listCentrosServico() : Promise.resolve(null),
          statusOptions.length === 0 ? listStatusSaida() : Promise.resolve(null),
          refreshCatalogs || registrantes.length === 0 ? listRegistrantesSaidas() : Promise.resolve(null),
        ])
        let resultado = pagina
        const ultimaPagina = Math.max(1, Math.ceil((resultado?.total ?? 0) / TABLE_PAGE_SIZE))
        if (!resultado?.itens?.length && paginaAlvo > ultimaPagina) {
          resultado = await listSaidasPagina(query, { page: ultimaPagina, pageSize: TABLE_PAGE_SIZE })
        }
        if (pessoasData) setPessoas(pessoasData ?? [])
        if (materiaisData) setMateriais(materiaisData ?? [])
        if (centrosEstoqueData) {
          const normalizarCentro = (item) => {
            const id = item?.id || item?.centroCustoId || item?.centro_custo || null
            const nome = item?.nome || item?.almox || item?.descricao || item?.codigo || ''
            if (!id) return null
            return { id, nome: nome || id }
          }
          const centrosNormalizados = (centrosEstoqueData ?? []).map(normalizarCentro).filter(Boolean)
          const nomesDuplicados = new Set(
            centrosNormalizados
              .filter((centro, index) => centrosNormalizados.some((outro, outroIndex) => outroIndex !== index && outro.nome === centro.nome))
              .map((centro) => centro.nome),
          )
          setCentrosEstoqueOptions(centrosNormalizados.map((centro) => ({
            ...centro,
            nome: nomesDuplicados.has(centro.nome) ? `${centro.nome} (${String(centro.id).slice(0, 8)})` : centro.nome,
          })))
        }
        if (centrosCustoData) setCentrosCustoOptions(centrosCustoData ?? [])
        if (centrosServicoData) setCentrosServicoOptions(centrosServicoData ?? [])
        if (statusData) {
          setStatusOptions(
            (statusData ?? [])
              .map((item) => ({ id: item.id, label: (item.nome || item.status || '').toString().trim() }))
              .filter((item) => item.id && item.label),
          )
        }
        if (registrantesData) setRegistrantes(registrantesData ?? [])
        filtrosAplicadosRef.current = params
        paginaAtualRef.current = resultado?.page ?? paginaAlvo
        setSaidas(resultado?.itens ?? [])
        setTotalSaidas(resultado?.total ?? 0)
        setCurrentPage(paginaAtualRef.current)
        setSaidasVersao((versao) => versao + 1)
      } catch (err) {
        setError(err.message)
        reportError(err, { area: 'saidas_load' })
      } finally {
        setIsLoading(false)
      }
    },
    [
      centrosCustoOptions.length,
      centrosEstoqueOptions.length,
      centrosServicoOptions.length,
      materiais.length,
      pessoas.length,
      registrantes.length,
      reportError,
      statusOptions.length,
    ],
  )

  const goToPage = useCallback(
    (pagina) => {
      load(filtrosAplicadosRef.current, { page: pagina }).catch((err) => reportError(err, { area: 'saidas_page' }))
    },
    [load, reportError],
  )

  // Todas as saidas dos filtros aplicados (nao so a pagina aberta), para a exportacao.
  const exportSaidas = useCallback(() => exportarSaidas(buildSaidasQuery(filtrosAplicadosRef.current)), [])

  const dedupeMateriais = useCallback((lista = []) => {
    const mapa = new Map()
    ;(Array.isArray(lista) ? lista : []).forEach((item) => {
      const id = item?.id ?? item?.materialId ?? item?.material_id
      if (!id) return
      if (!mapa.has(id)) {
        mapa.set(id, item)
      }
    })
    return Array.from(mapa.values())
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => {
      if (name === 'centroEstoqueId') {
        const centro = centrosEstoqueOptions.find((c) => String(c.id) === String(value))
        return {
          ...prev,
          centroEstoqueId: value,
          centroEstoque: centro?.nome || value,
          materialId: '',
        }
      }
      return { ...prev, [name]: value }
    })
    if (name === 'centroEstoqueId') {
      setMaterialSearchValue('')
      setMaterialSuggestions([])
      setMaterialDropdownOpen(false)
      setMaterialSearchError(null)
      setMaterialEstoque(null)
    }
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

  const closeTrocaPrompt = useCallback(() => {
    setTrocaPrompt(TROCA_PROMPT_INITIAL)
  }, [])

  useEffect(() => {
    setPessoas([])
    setMateriais([])
    setSaidas([])
    setTotalSaidas(0)
    setRegistrantes([])
    filtrosAplicadosRef.current = initialSaidaFilters
    paginaAtualRef.current = 1
    setCentrosEstoqueOptions([])
    setCentrosCustoOptions([])
    setCentrosServicoOptions([])
    setStatusOptions([])
    setFilters(initialSaidaFilters)
    setEditingSaida(null)
    setCurrentPage(1)
    materialSaldoCacheRef.current = new Map()
    resetFormState()
    load(initialSaidaFilters, { resetPage: true, refreshCatalogs: true }).catch((err) => {
      reportError(err, { area: 'saidas_scope_change', userScopeKey })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userScopeKey])

  const confirmTroca = useCallback(async () => {
    if (!trocaPrompt.open || !trocaPrompt.payload) {
      closeTrocaPrompt()
      return
    }
    setIsSaving(true)
    try {
      const estoqueAtual = Number(materialEstoque?.quantidade ?? 0)
      if (materialEstoqueLoading) {
        throw new Error('Aguarde a consulta do estoque do material.')
      }
      if (!Number.isFinite(estoqueAtual)) {
        throw new Error('Nao foi possivel validar o estoque do material.')
      }
      const quantidadeTroca = Number(trocaPrompt.payload.quantidade ?? 0)
      if (!Number.isFinite(quantidadeTroca) || quantidadeTroca <= 0) {
        throw new Error('Informe uma quantidade valida.')
      }
      let estoquePermitido = estoqueAtual
      if (editingSaida && String(editingSaida.materialId) === String(trocaPrompt.payload.materialId)) {
        estoquePermitido += Number(editingSaida.quantidade ?? 0)
      }
      if (estoquePermitido <= 0) {
        throw new Error('Sem estoque disponivel para este material.')
      }
      if (quantidadeTroca > estoquePermitido) {
        throw new Error('Quantidade informada maior que o estoque disponivel.')
      }
      await createSaida({ ...trocaPrompt.payload, forceTroca: true })
      cancelEditSaida()
      await load(filtrosAplicadosRef.current, { resetPage: true, refreshCatalogs: true })
      closeTrocaPrompt()
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'saidas_submit_troca' })
    } finally {
      setIsSaving(false)
    }
  }, [
    cancelEditSaida,
    closeTrocaPrompt,
    editingSaida,
    load,
    materialEstoque,
    materialEstoqueLoading,
    reportError,
    trocaPrompt,
  ])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const payload = {
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: form.quantidade,
        centroEstoque: form.centroEstoque || form.centroEstoqueId,
        centroEstoqueId: form.centroEstoqueId,
        centroCusto: form.centroCusto,
        centroCustoId: form.centroCustoId,
        centroServico: form.centroServico,
        centroServicoId: form.centroServicoId,
        dataEntrega: form.dataEntrega,
        usuarioResponsavel: user?.id || user?.user?.id || user?.name || user?.username || 'sistema',
      }
      if (!payload.pessoaId || !payload.materialId || !payload.dataEntrega || !payload.centroEstoqueId) {
        throw new Error('Preencha pessoa, centro de estoque, material e data da entrega.')
      }
      if (materialEstoqueLoading) {
        throw new Error('Aguarde a consulta do estoque do material.')
      }
      const estoqueAtual = Number(materialEstoque?.quantidade ?? 0)
      if (!Number.isFinite(estoqueAtual)) {
        throw new Error('Nao foi possivel validar o estoque do material.')
      }
      const quantidadeInformada = Number(payload.quantidade ?? 0)
      if (!Number.isFinite(quantidadeInformada) || quantidadeInformada <= 0) {
        throw new Error('Informe uma quantidade valida.')
      }
      let estoquePermitido = estoqueAtual
      if (editingSaida && String(editingSaida.materialId) === String(payload.materialId)) {
        estoquePermitido += Number(editingSaida.quantidade ?? 0)
      }
      if (estoquePermitido <= 0) {
        throw new Error('Sem estoque disponivel para este material.')
      }
      if (quantidadeInformada > estoquePermitido) {
        throw new Error('Quantidade informada maior que o estoque disponivel.')
      }
      if (editingSaida) {
        await updateSaida(editingSaida.id, payload)
      } else {
        try {
          await createSaida(payload)
        } catch (err) {
          if (err?.code === 'TROCA_CONFIRM') {
            setTrocaPrompt({
              open: true,
              payload,
              details: err?.details ?? null,
            })
            setIsSaving(false)
            return
          }
          throw err
        }
      }
      cancelEditSaida()
      await load(filtrosAplicadosRef.current, { resetPage: !editingSaida, refreshCatalogs: true })
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'saidas_submit', editing: Boolean(editingSaida) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target
    setFilters((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    load(filters, { resetPage: true })
  }

  const handleFilterClear = () => {
    setFilters(initialSaidaFilters)
    load(initialSaidaFilters, { resetPage: true, refreshCatalogs: true })
  }

  const startEditSaida = (saida) => {
    if (!saida) return
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setEditingSaida(saida)
    setForm({
      pessoaId: saida.pessoaId || '',
      materialId: saida.materialId || '',
      quantidade: String(saida.quantidade ?? ''),
      centroEstoque: saida.centroEstoque || '',
      centroEstoqueId: saida.centroEstoqueId || '',
      centroCusto: saida.centroCusto || '',
      centroCustoId: saida.centroCustoId || '',
      centroServico: saida.centroServico || '',
      centroServicoId: saida.centroServicoId || '',
      dataEntrega: formatDateToInput(saida.dataEntrega),
    })
    const pessoa = saida.pessoa || pessoas.find((p) => p.id === saida.pessoaId)
    if (pessoa) {
      setPessoaSearchValue(formatPessoaSummary(pessoa))
    }
    const material = saida.material || materiais.find((m) => m.id === saida.materialId)
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
      await load(filtrosAplicadosRef.current, { resetPage: false })
    } catch (err) {
      setCancelState((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Falha ao cancelar.' }))
      reportError(err, { area: 'saidas_cancel', saidaId: cancelState.saida.id })
    }
  }

  const handleMaterialInputChange = (event) => {
    const value = event.target.value
    setMaterialSearchValue(value)
    setMaterialSearchError(null)
    setForm((prev) => ({ ...prev, materialId: '' }))
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
      centroServico: pessoa.centroServico || '',
      centroServicoId: pessoa.centroServicoId || '',
      centroCusto: pessoa.centroCusto || '',
      centroCustoId: pessoa.centroCustoId || '',
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

  const resolveMaterialSaldo = useCallback(async (materialId, centroEstoqueId) => {
    const key = `${String(centroEstoqueId || '')}:${String(materialId || '')}`
    if (materialSaldoCacheRef.current.has(key)) {
      return materialSaldoCacheRef.current.get(key)
    }
    const estoque = await getMaterialEstoque(materialId, centroEstoqueId)
    const quantidade = Number(estoque?.quantidade ?? estoque?.saldo ?? 0)
    materialSaldoCacheRef.current.set(key, quantidade)
    return quantidade
  }, [getMaterialEstoque])

  const filtrarMateriaisComSaldo = useCallback(async (lista = [], centroEstoqueId) => {
    const candidatos = Array.isArray(lista) ? lista : []
    if (!candidatos.length) return []
    const verificacoes = await Promise.all(
      candidatos.map(async (material) => {
        const materialId = material?.id ?? material?.materialId
        if (!materialId) return null
        const saldo = await resolveMaterialSaldo(materialId, centroEstoqueId)
        return { material, saldo }
      }),
    )
    return verificacoes
      .filter((item) => item && Number(item.saldo ?? 0) > 0)
      .map((item) => item.material)
  }, [resolveMaterialSaldo])

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
    const termoNormalizado = normalizeSearchValue(termo)
    if (!form.centroEstoqueId) {
      setMaterialSuggestions([])
      setIsSearchingMaterials(false)
      setMaterialSearchError(null)
      setMaterialDropdownOpen(false)
      return
    }
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
            centroEstoqueId: form.centroEstoqueId,
            ca: termo,
          })
        } else {
          resultados = fallbackMaterialSearch(termo)
        }
        if (!cancelled) {
          const itens =
            (!resultados || resultados.length === 0) && termoNormalizado
              ? fallbackMaterialSearch(termo)
              : resultados
          const deduped = dedupeMateriais(itens ?? [])
          try {
            const filtrados = await filtrarMateriaisComSaldo(deduped, form.centroEstoqueId)
            setMaterialSuggestions(filtrados)
            if (deduped.length > 0 && filtrados.length === 0) {
              setMaterialSearchError('Nenhum material com saldo disponivel.')
            }
          } catch (saldoErr) {
            setMaterialSearchError(saldoErr?.message || 'Falha ao validar saldo do material.')
            setMaterialSuggestions([])
          }
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
  }, [
    materialSearchValue,
    form.materialId,
    form.centroEstoqueId,
    fallbackMaterialSearch,
    filtrarMateriaisComSaldo,
    reportError,
  ])

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
    if (!form.materialId || !form.centroEstoqueId) {
      setMaterialEstoqueLoading(false)
      setMaterialEstoque(null)
      return
    }
    setMaterialEstoqueLoading(true)
    setMaterialEstoqueError(null)
    getMaterialEstoque(form.materialId, form.centroEstoqueId)
      .then((estoque) => setMaterialEstoque(estoque))
      .catch((err) => {
        setMaterialEstoqueError(err.message || 'Falha ao obter estoque.')
        setMaterialEstoque(null)
        reportError(err, { area: 'saidas_material_estoque', materialId: form.materialId })
      })
      .finally(() => setMaterialEstoqueLoading(false))
}, [form.materialId, form.centroEstoqueId, saidasVersao, reportError])

  const saidasComPrazo = useMemo(
    () =>
      saidas.map((saida) => ({
        ...saida,
        trocaPrazo: getTrocaPrazoStatus(saida.dataTroca),
      })),
    [saidas],
  )

  // A pagina ja vem filtrada e paginada do banco.
  const saidasFiltradas = saidasComPrazo

  const statusFilterOptions = statusOptions

  const centroEstoqueFilterOptions = useMemo(() => {
    const mapaIdParaNome = new Map(
      (centrosEstoqueOptions ?? []).map((c) => [String(c.id ?? c.nome ?? ''), c.nome ?? c.id ?? ''])
    )
    const uniqIds = new Set(
      saidas
        .map((s) => (s.centroEstoqueId || s.centroEstoque || '').toString().trim())
        .filter(Boolean)
    )
    return Array.from(uniqIds)
      .map((id) => ({
        id,
        label: mapaIdParaNome.get(id) || id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [saidas, centrosEstoqueOptions])

  const centroServicoFilterOptions = useMemo(() => {
    const uniq = new Set(
      saidas
        .map((s) => (s.centroServico || s.centroServicoId || '').toString().trim())
        .filter(Boolean)
    )
    return Array.from(uniq)
      .map((label) => ({ id: label, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [saidas])

  const centroCustoFilterOptions = useMemo(() => {
    const uniq = new Set(
      saidas
        .map((s) => (s.centroCusto || s.centroCustoId || '').toString().trim())
        .filter(Boolean)
    )
    return Array.from(uniq)
      .map((label) => ({ id: label, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [saidas])

  const registradoPorFilterOptions = useMemo(
    () => registrantes.map((item) => ({ id: item.id, label: item.nome || item.id })),
    [registrantes],
  )

  const paginatedSaidas = saidasComPrazo

  const trocaPrazoFilterOptions = useMemo(
    () => [
      { id: 'limite', label: 'Data limite' },
      { id: 'alerta', label: '7 dias para o limite da troca' },
      { id: 'atrasada', label: 'Limite passado' },
      { id: 'sem-data', label: 'Sem data de troca' },
    ],
    [],
  )

  return {
    form,
    filters,
    saidas,
    pessoas,
    materiais,
    centrosEstoqueOptions,
    centrosCustoOptions,
    centrosServicoOptions,
    statusOptions: statusFilterOptions,
    centroEstoqueFilterOptions,
    centroServicoFilterOptions,
    centroCustoFilterOptions,
    registradoPorFilterOptions,
    editingSaida,
    isSaving,
    isLoading,
    error,
    currentPage,
    setCurrentPage: goToPage,
    totalSaidas,
    exportSaidas,
    historyState,
    cancelState,
    trocaPrompt,
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
    load,
    cancelEditSaida,
    startEditSaida,
    openHistory,
    closeHistory,
    openCancelModal,
    closeCancelModal,
    handleCancelSubmit,
    confirmTroca,
    closeTrocaPrompt,
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
    formatDisplayDateSimple,
    formatDisplayDate,
    formatDisplayDateTime,
    formatMaterialSummary,
    formatPessoaSummary,
    formatPessoaDetail,
    trocaPrazoFilterOptions,
    setCancelState,
    setHistoryState,
  }
}
