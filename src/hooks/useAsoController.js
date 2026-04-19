import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useErrorLogger } from './useErrorLogger.js'
import {
  ASO_CONFLICT_DEFAULT,
  ASO_FILTER_DEFAULT,
  ASO_HISTORY_DEFAULT,
  ASO_PESSOA_SEARCH_DEBOUNCE_MS,
  ASO_PESSOA_SEARCH_MIN_CHARS,
  ASO_REGISTER_EXAM_DEFAULT,
} from '../config/AsoConfig.js'
import {
  buildAsoCards,
  computeAsoNextDue,
  detailPessoa,
  formatDate,
  formatDateInputValue,
  normalizeAsoFilterDefaults,
  normalizeAsoFormDefaults,
  summarizePessoa,
  uniqueSorted,
} from '../utils/asoUtils.js'
import {
  createAso,
  getAsoHistory,
  listAsoTiposExame,
  listAsos,
  registerAsoExam,
  updateAso,
} from '../services/asoService.js'
import { listPessoasReferences, searchPessoas } from '../services/pessoasService.js'

const RENEWABLE_EXAM_CODES = new Set(['admissional', 'periodico', 'mudanca_funcao_setor'])
const NEXT_EXAM_ALLOWED_CODES = new Set(['periodico', 'mudanca_funcao_setor', 'demissional'])

const normalizeDateKey = (value) => formatDateInputValue(value)

const buildConflictState = (overrides = {}) => ({
  ...ASO_CONFLICT_DEFAULT,
  ...overrides,
  open: true,
})

export function useAsoController() {
  const { reportError } = useErrorLogger('aso')
  const [form, setForm] = useState(() => normalizeAsoFormDefaults())
  const [filters, setFilters] = useState(() => normalizeAsoFilterDefaults())
  const [asos, setAsos] = useState([])
  const [allAsos, setAllAsos] = useState([])
  const [tiposExame, setTiposExame] = useState([])
  const [centrosServico, setCentrosServico] = useState([])
  const [setores, setSetores] = useState([])
  const [cargos, setCargos] = useState([])
  const [editingAso, setEditingAso] = useState(null)
  const [selectedPessoa, setSelectedPessoa] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [historyState, setHistoryState] = useState(() => ({ ...ASO_HISTORY_DEFAULT }))
  const [historyCache, setHistoryCache] = useState({})
  const [registerExamState, setRegisterExamState] = useState(() => ({ ...ASO_REGISTER_EXAM_DEFAULT }))
  const [conflictState, setConflictState] = useState(() => ({ ...ASO_CONFLICT_DEFAULT }))
  const [pessoaSearchValue, setPessoaSearchValue] = useState('')
  const [pessoaSuggestions, setPessoaSuggestions] = useState([])
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const [isSearchingPessoas, setIsSearchingPessoas] = useState(false)
  const [pessoaSearchError, setPessoaSearchError] = useState('')
  const pessoaBlurTimeoutRef = useRef(null)

  const tiposExameMap = useMemo(
    () => new Map((tiposExame || []).filter((item) => item?.id).map((item) => [item.id, item])),
    [tiposExame],
  )

  const recalculateNextDue = useCallback(
    (nextForm) => {
      const tipo = tiposExameMap.get(nextForm.tipoExameId)
      return {
        ...nextForm,
        proximoVencimento: computeAsoNextDue(nextForm.dataExame, tipo),
      }
    },
    [tiposExameMap],
  )

  const loadDependencies = useCallback(async () => {
    try {
      const [tipos, referencias] = await Promise.all([
        listAsoTiposExame(),
        listPessoasReferences(),
      ])
      setTiposExame(tipos ?? [])
      setCentrosServico(uniqueSorted((referencias?.centrosServico ?? []).map((item) => item?.nome)))
      setSetores(uniqueSorted((referencias?.setores ?? []).map((item) => item?.nome)))
      setCargos(uniqueSorted((referencias?.cargos ?? []).map((item) => item?.nome)))
    } catch (err) {
      reportError(err, { area: 'aso_dependencies' })
    }
  }, [reportError])

  const loadAsosData = useCallback(
    async (params = ASO_FILTER_DEFAULT) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listAsos(params)
        setAsos(data ?? [])
      } catch (err) {
        setError(err.message || 'Falha ao carregar registros de ASO.')
        reportError(err, { area: 'aso_load' })
      } finally {
        setIsLoading(false)
      }
    },
    [reportError],
  )

  const loadAllAsosData = useCallback(async () => {
    try {
      const data = await listAsos({})
      setAllAsos(data ?? [])
    } catch (err) {
      reportError(err, { area: 'aso_load_all' })
    }
  }, [reportError])

  const refreshAsoData = useCallback(
    async (params = ASO_FILTER_DEFAULT) => {
      await Promise.all([loadAsosData(params), loadAllAsosData()])
    },
    [loadAllAsosData, loadAsosData],
  )

  useEffect(() => {
    loadDependencies()
    refreshAsoData(ASO_FILTER_DEFAULT)
  }, [loadDependencies, refreshAsoData])

  useEffect(() => {
    if (!form.tipoExameId || !form.dataExame) {
      return
    }
    setForm((prev) => recalculateNextDue(prev))
  }, [form.tipoExameId, form.dataExame, recalculateNextDue])

  useEffect(() => {
    const term = pessoaSearchValue.trim()
    if (form.pessoaId || term.length < ASO_PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSuggestions([])
      setIsSearchingPessoas(false)
      setPessoaSearchError('')
      return undefined
    }

    const timeout = setTimeout(async () => {
      setIsSearchingPessoas(true)
      setPessoaSearchError('')
      try {
        const result = await searchPessoas({ termo: term, limit: 8, includeInactive: true })
        setPessoaSuggestions(result ?? [])
        setPessoaDropdownOpen(true)
      } catch (err) {
        setPessoaSuggestions([])
        setPessoaSearchError(err.message || 'Falha ao buscar funcionarios.')
        reportError(err, { area: 'aso_pessoa_search', termo: term })
      } finally {
        setIsSearchingPessoas(false)
      }
    }, ASO_PESSOA_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [form.pessoaId, pessoaSearchValue, reportError])

  const resetConflictState = useCallback(() => {
    setConflictState({ ...ASO_CONFLICT_DEFAULT })
  }, [])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => recalculateNextDue({ ...prev, [name]: value }))
  }

  const handlePessoaInputChange = (event) => {
    const value = event.target.value
    setPessoaSearchValue(value)
    setPessoaDropdownOpen(true)
    setPessoaSearchError('')
    setSelectedPessoa(null)
    setForm((prev) => ({
      ...prev,
      pessoaId: '',
      matricula: value,
      nome: '',
    }))
  }

  const handlePessoaSelect = (pessoa) => {
    if (!pessoa) return
    setSelectedPessoa(pessoa)
    setForm((prev) => ({
      ...prev,
      pessoaId: pessoa.id ?? '',
      matricula: pessoa.matricula ?? '',
      nome: pessoa.nome ?? '',
    }))
    setPessoaSearchValue(pessoa.matricula ?? pessoa.nome ?? '')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError('')
  }

  const handlePessoaFocus = () => {
    if (pessoaBlurTimeoutRef.current) {
      clearTimeout(pessoaBlurTimeoutRef.current)
    }
    setPessoaDropdownOpen(true)
  }

  const handlePessoaBlur = () => {
    pessoaBlurTimeoutRef.current = setTimeout(() => {
      setPessoaDropdownOpen(false)
    }, 150)
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = async (event) => {
    event.preventDefault()
    await loadAsosData(filters)
  }

  const handleFilterClear = async () => {
    const nextFilters = normalizeAsoFilterDefaults()
    setFilters(nextFilters)
    await loadAsosData(nextFilters)
  }

  const resetForm = useCallback(() => {
    setEditingAso(null)
    setSelectedPessoa(null)
    setForm(normalizeAsoFormDefaults())
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError('')
    resetConflictState()
  }, [resetConflictState])

  const startEdit = (aso) => {
    if (!aso) return
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    resetConflictState()
    setEditingAso(aso)
    setSelectedPessoa({
      id: aso.pessoaId ?? '',
      nome: aso.nome ?? aso.funcionario ?? '',
      matricula: aso.matricula ?? '',
      ativo: aso.ativo,
      dataDemissao: aso.dataDemissao ?? '',
      centroServico: aso.centroServico ?? '',
      setor: aso.setor ?? '',
      cargo: aso.cargo ?? '',
    })
    setForm({
      pessoaId: aso.pessoaId ?? '',
      matricula: aso.matricula ?? '',
      nome: aso.nome ?? aso.funcionario ?? '',
      tipoExameId: aso.tipoExameId ?? '',
      dataExame: formatDateInputValue(aso.dataExame),
      proximoVencimento: formatDateInputValue(aso.proximoVencimento),
      observacao: aso.observacao ?? '',
    })
    setPessoaSearchValue(aso.matricula ?? aso.nome ?? '')
  }

  const persistAso = useCallback(
    async (payload) => {
      if (editingAso?.id) {
        await updateAso(editingAso.id, payload)
      } else {
        await createAso(payload)
      }

      resetForm()
      setHistoryCache({})
      await refreshAsoData(filters)
    },
    [editingAso, filters, refreshAsoData, resetForm],
  )

  const buildPreSubmitConflict = useCallback(
    (payload) => {
      const tipo = tiposExameMap.get(payload.tipoExameId)
      const tipoCodigo = String(tipo?.codigo || '').trim().toLowerCase()
      const samePersonSameType = allAsos
        .filter(
          (item) =>
            item?.id !== editingAso?.id &&
            item?.pessoaId === payload.pessoaId &&
            item?.tipoExameId === payload.tipoExameId,
        )
        .sort((left, right) => String(right?.dataExame || '').localeCompare(String(left?.dataExame || '')))

      const activeRenewable = allAsos
        .filter(
          (item) =>
            item?.id !== editingAso?.id &&
            item?.pessoaId === payload.pessoaId &&
            item?.statusRegistro !== 'baixado' &&
            RENEWABLE_EXAM_CODES.has(String(item?.tipoExameCodigo || '').trim().toLowerCase()),
        )
        .sort((left, right) => String(right?.dataExame || '').localeCompare(String(left?.dataExame || '')))[0]

      const activeDemissional = allAsos
        .filter(
          (item) =>
            item?.id !== editingAso?.id &&
            item?.pessoaId === payload.pessoaId &&
            item?.statusRegistro !== 'baixado' &&
            String(item?.tipoExameCodigo || '').trim().toLowerCase() === 'demissional',
        )
        .sort((left, right) => String(right?.dataExame || '').localeCompare(String(left?.dataExame || '')))[0]

      const exactDuplicate = samePersonSameType.find(
        (item) => normalizeDateKey(item?.dataExame) === normalizeDateKey(payload.dataExame),
      )

      if (exactDuplicate) {
        return buildConflictState({
          title: 'Exame ja cadastrado',
          message: `Ja existe um exame ${tipo?.nome || 'deste tipo'} para este funcionario na data ${formatDate(
            exactDuplicate.dataExame,
          )}.`,
          existing: exactDuplicate,
          canContinue: false,
          openExistingLabel: 'Editar registro',
          pendingPayload: payload,
        })
      }

      if (RENEWABLE_EXAM_CODES.has(tipoCodigo) && activeRenewable) {
        return buildConflictState({
          title: 'Exame ativo existente',
          message: `Este funcionario ja possui um exame ${activeRenewable.tipoExame?.toLowerCase() || 'ativo'} em ${formatDate(
            activeRenewable.dataExame,
          )}. Use a baixa / novo exame para encerrar o atual antes de cadastrar outro.`,
          existing: activeRenewable,
          canContinue: false,
          openExistingLabel: 'Editar registro ativo',
          pendingPayload: payload,
        })
      }

      if (tipoCodigo === 'demissional' && (activeRenewable || activeDemissional)) {
        const existing = activeRenewable || activeDemissional
        return buildConflictState({
          title: 'Exame ativo existente',
          message: `Este funcionario ja possui um exame ${existing?.tipoExame?.toLowerCase() || 'ativo'} em ${formatDate(
            existing?.dataExame,
          )}. Use a baixa / novo exame para encerrar o atual antes de cadastrar um demissional.`,
          existing,
          canContinue: false,
          openExistingLabel: 'Editar registro ativo',
          pendingPayload: payload,
        })
      }

      return null
    },
    [allAsos, editingAso?.id, tiposExameMap],
  )

  const handleSubmit = async (event, options = {}) => {
    if (event?.preventDefault) {
      event.preventDefault()
    }

    setError(null)
    try {
      if (!form.pessoaId) {
        throw new Error('Selecione um funcionario pela matricula.')
      }
      if (!form.tipoExameId) {
        throw new Error('Selecione o tipo de exame.')
      }
      if (!form.dataExame) {
        throw new Error('Informe a data do exame.')
      }

      const payload = {
        pessoaId: form.pessoaId,
        tipoExameId: form.tipoExameId,
        dataExame: form.dataExame,
        observacao: form.observacao,
      }

      const tipo = tiposExameMap.get(payload.tipoExameId)
      const tipoCodigo = String(tipo?.codigo || '').trim().toLowerCase()

      if (
        tipoCodigo === 'demissional' &&
        selectedPessoa &&
        selectedPessoa.ativo !== false &&
        !selectedPessoa.dataDemissao
      ) {
        throw new Error('Exame demissional so pode ser cadastrado para funcionario inativo ou com data de desligamento.')
      }

      if (!options.skipWarnings) {
        const conflict = buildPreSubmitConflict(payload)
        if (conflict) {
          setConflictState(conflict)
          return
        }
      }

      setIsSaving(true)
      resetConflictState()
      await persistAso(payload)
    } catch (err) {
      setError(err.message || 'Falha ao salvar ASO.')
      reportError(err, { area: 'aso_submit', editing: Boolean(editingAso) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConflictClose = () => {
    if (isSaving) return
    resetConflictState()
  }

  const handleConflictOpenExisting = () => {
    const existing = conflictState?.existing
    resetConflictState()
    if (existing) {
      startEdit(existing)
    }
  }

  const handleConflictContinue = async () => {
    if (!conflictState?.pendingPayload) return
    await handleSubmit(null, { skipWarnings: true })
  }

  const openHistory = async (aso) => {
    if (!aso?.id) return
    const historyKey = aso.pessoaId || aso.id
    const cached = historyCache[historyKey]
    if (cached) {
      setHistoryState({ ...ASO_HISTORY_DEFAULT, open: true, aso, registros: cached })
      return
    }
    setHistoryState({ ...ASO_HISTORY_DEFAULT, open: true, aso, isLoading: true })
    try {
      const registros = await getAsoHistory(aso.id)
      setHistoryCache((prev) => ({ ...prev, [historyKey]: registros ?? [] }))
      setHistoryState({ ...ASO_HISTORY_DEFAULT, open: true, aso, registros: registros ?? [] })
    } catch (err) {
      setHistoryState({
        ...ASO_HISTORY_DEFAULT,
        open: true,
        aso,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
      reportError(err, { area: 'aso_history', asoId: aso.id })
    }
  }

  const closeHistory = () => setHistoryState({ ...ASO_HISTORY_DEFAULT })

  const openRegisterExam = (aso) => {
    const defaultNextType =
      tiposExame.find((item) => String(item?.codigo || '').trim().toLowerCase() === 'periodico')?.id || ''
    setRegisterExamState({
      ...ASO_REGISTER_EXAM_DEFAULT,
      open: true,
      aso,
      proximoTipoExameId: defaultNextType,
      dataRealizada: '',
      observacao: aso?.observacao ?? '',
    })
  }

  const closeRegisterExam = () => setRegisterExamState({ ...ASO_REGISTER_EXAM_DEFAULT })

  const handleRegisterExamChange = (event) => {
    const { name, value } = event.target
    setRegisterExamState((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegisterExamSubmit = async (event) => {
    event.preventDefault()
    if (!registerExamState.aso?.id) return
    if (!registerExamState.proximoTipoExameId) {
      setRegisterExamState((prev) => ({ ...prev, error: 'Selecione o tipo do proximo exame.' }))
      return
    }
    if (!registerExamState.dataRealizada) {
      setRegisterExamState((prev) => ({ ...prev, error: 'Informe a data realizada.' }))
      return
    }
    const proximoTipo = tiposExameMap.get(registerExamState.proximoTipoExameId)
    const proximoCodigo = String(proximoTipo?.codigo || '').trim().toLowerCase()
    if (!NEXT_EXAM_ALLOWED_CODES.has(proximoCodigo)) {
      setRegisterExamState((prev) => ({ ...prev, error: 'Selecione um tipo valido para o proximo exame.' }))
      return
    }
    if (
      proximoCodigo === 'demissional' &&
      registerExamState.aso &&
      registerExamState.aso.ativo !== false &&
      !registerExamState.aso.dataDemissao
    ) {
      setRegisterExamState((prev) => ({
        ...prev,
        error: 'Exame demissional so pode ser gerado para funcionario inativo ou com data de desligamento.',
      }))
      return
    }
    setRegisterExamState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      await registerAsoExam(registerExamState.aso.id, {
        proximoTipoExameId: registerExamState.proximoTipoExameId,
        dataRealizada: registerExamState.dataRealizada,
        observacao: registerExamState.observacao,
      })
      setHistoryCache({})
      closeRegisterExam()
      await refreshAsoData(filters)
    } catch (err) {
      setRegisterExamState((prev) => ({
        ...prev,
        isSaving: false,
        error: err.message || 'Falha ao dar baixa no exame.',
      }))
      reportError(err, { area: 'aso_register_exam', asoId: registerExamState.aso.id })
    }
  }

  const cards = useMemo(() => buildAsoCards(asos), [asos])

  return {
    form,
    filters,
    asos,
    allAsos,
    tiposExame,
    centrosServico,
    setores,
    cargos,
    editingAso,
    selectedPessoa,
    isLoading,
    isSaving,
    error,
    historyState,
    registerExamState,
    conflictState,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    cards,
    handleFormChange,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    startEdit,
    resetForm,
    openHistory,
    closeHistory,
    openRegisterExam,
    closeRegisterExam,
    handleRegisterExamChange,
    handleRegisterExamSubmit,
    handleConflictClose,
    handleConflictOpenExisting,
    handleConflictContinue,
    loadAsosData,
    refreshAsoData,
    summarizePessoa,
    detailPessoa,
  }
}
