import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useErrorLogger } from './useErrorLogger.js'
import {
  PESSOAS_FILTER_DEFAULT,
  PESSOAS_FORM_DEFAULT,
  PESSOAS_HISTORY_DEFAULT,
} from '../config/PessoasConfig.js'
import {
  createPessoaPayload,
  extractCargos,
  extractCentrosServico,
  extractSetores,
  extractTiposExecucao,
  sortPessoasByNome,
  filterPessoas,
  updatePessoaPayload,
} from '../rules/PessoasRules.js'
import { resolveUsuarioNome } from '../utils/pessoasUtils.js'
import { buildPessoasQuery, formatDateInputValue, mapOptionsById, uniqueSorted } from '../utils/pessoasUtils.js'
import {
  createPessoa,
  getPessoaHistory,
  listPessoas,
  listPessoasReferences,
  updatePessoa,
} from '../services/pessoasService.js'

const CANCEL_INITIAL = {
  open: false,
  pessoa: null,
  isSubmitting: false,
  error: null,
  observacao: '',
}

export function usePessoasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('pessoas')
  const isMasterUser = useMemo(() => {
    const cred = (user?.metadata?.credential ?? '').toString().toLowerCase()
    return cred === 'master'
  }, [user])

  const [form, setForm] = useState(() => ({ ...PESSOAS_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...PESSOAS_FILTER_DEFAULT }))
  const [pessoas, setPessoas] = useState([])
  const [pessoasOptions, setPessoasOptions] = useState([])
  const pessoasOptionsRef = useRef([])

  const [editingPessoa, setEditingPessoa] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...PESSOAS_HISTORY_DEFAULT }))
  const [cancelState, setCancelState] = useState({ ...CANCEL_INITIAL })
  const [nomeDiffPrompt, setNomeDiffPrompt] = useState({
    open: false,
    payload: null,
    id: null,
    editing: false,
    details: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [referencias, setReferencias] = useState({
    centrosServico: [],
    setores: [],
    cargos: [],
    tiposExecucao: [],
  })
  const referenciasRef = useRef(referencias)
  const normalizeOptionKey = useCallback((value) => {
    if (value === undefined || value === null) {
      return ''
    }
    return String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }, [])

  useEffect(() => {
    pessoasOptionsRef.current = pessoasOptions
  }, [pessoasOptions])

  useEffect(() => {
    referenciasRef.current = referencias
  }, [referencias])

  const refreshReferencias = useCallback(async () => {
    try {
      const data = await listPessoasReferences()
      if (!data) return referenciasRef.current
      const normalizado = {
        centrosServico: data?.centrosServico ?? [],
        setores: data?.setores ?? [],
        cargos: data?.cargos ?? [],
        tiposExecucao: data?.tiposExecucao ?? [],
      }
      referenciasRef.current = normalizado
      setReferencias(normalizado)
      return normalizado
    } catch (err) {
      reportError(err, { area: 'pessoas_referencias' })
      return referenciasRef.current
    }
  }, [reportError])

  const loadPessoas = useCallback(
    async (params = PESSOAS_FILTER_DEFAULT, refreshOptions = false) => {
      setIsLoading(true)
      setError(null)
      try {
        const query = {} // filtros aplicados apenas no frontend
        const needsOptionsRefresh = refreshOptions || pessoasOptions.length === 0
        const [optionsData, filteredData] = await Promise.all([
          needsOptionsRefresh ? listPessoas() : Promise.resolve(null),
          listPessoas(query),
        ])

        const baseOptions = optionsData ?? pessoasOptionsRef.current
        let referenciasAtuais = referenciasRef.current
        if (optionsData) {
          const nextOptions = optionsData ?? []
          pessoasOptionsRef.current = nextOptions
          setPessoasOptions(nextOptions)
          referenciasAtuais = await refreshReferencias()
        }

        const centrosMap = mapOptionsById(referenciasAtuais?.centrosServico)
        const setoresMap = mapOptionsById(referenciasAtuais?.setores)
        const cargosMap = mapOptionsById(referenciasAtuais?.cargos)
        const tiposExecucaoMap = mapOptionsById(referenciasAtuais?.tiposExecucao)

        const enrichedPessoas = (filteredData ?? []).map((pessoa) => {
          if (!pessoa || typeof pessoa !== 'object') return pessoa
          const fallback = baseOptions.find((item) => item?.id === pessoa.id) || {}
          const centroServicoIdAtual = pessoa.centroServicoId ?? fallback.centroServicoId ?? null
          const centroServicoAtual =
            pessoa.centroServico ??
            pessoa.local ??
            fallback.centroServico ??
            fallback.local ??
            (centroServicoIdAtual ? centrosMap.get(centroServicoIdAtual) ?? '' : '')
          const localAtual =
            pessoa.local ??
            pessoa.centroServico ??
            fallback.local ??
            fallback.centroServico ??
            (centroServicoIdAtual ? centrosMap.get(centroServicoIdAtual) ?? '' : '')

          const setorIdAtual = pessoa.setorId ?? fallback.setorId ?? null
          const setorAtual = pessoa.setor ?? fallback.setor ?? (setorIdAtual ? setoresMap.get(setorIdAtual) ?? '' : '')

          const cargoIdAtual = pessoa.cargoId ?? fallback.cargoId ?? null
          const cargoTextoAtual = pessoa.cargo ?? fallback.cargo ?? (cargoIdAtual ? cargosMap.get(cargoIdAtual) ?? '' : '')

          const tipoExecucaoIdAtual = pessoa.tipoExecucaoId ?? fallback.tipoExecucaoId ?? null
          const tipoExecucaoAtual =
            pessoa.tipoExecucao ?? fallback.tipoExecucao ?? (tipoExecucaoIdAtual ? tiposExecucaoMap.get(tipoExecucaoIdAtual) ?? '' : '')

          const pessoaNormalizada = {
            ...fallback,
            ...pessoa,
            centroServico: centroServicoAtual,
            local: localAtual,
            setor: setorAtual,
            cargo: cargoTextoAtual,
            tipoExecucao: tipoExecucaoAtual,
          }

          return pessoaNormalizada
        })

        const finalPessoas = filterPessoas(enrichedPessoas, { ...params })
        setPessoas(finalPessoas)
      } catch (err) {
        setError(err.message)
        reportError(err, { area: 'pessoas_load' })
      } finally {
        setIsLoading(false)
      }
    },
    [pessoasOptions.length, refreshReferencias, reportError],
  )

  useEffect(() => {
    loadPessoas(PESSOAS_FILTER_DEFAULT, true)
    refreshReferencias()
  }, [loadPessoas, refreshReferencias])

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    if (name === 'ativo') {
      const proximoValor = type === 'checkbox' ? Boolean(checked) : value !== 'false'
      setForm((prev) => ({ ...prev, ativo: proximoValor }))
      return
    }
    if (name === 'centroServico') {
      setForm((prev) => ({ ...prev, centroServico: value, local: value }))
      return
    }
    if (name === 'tipoExecucao') {
      setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    if (name === 'centroServico') {
      setFilters((prev) => ({ ...prev, centroServico: value, local: value }))
      return
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    loadPessoas(filters)
  }

  const handleFilterClear = () => {
    const nextFilters = { ...PESSOAS_FILTER_DEFAULT }
    setFilters(nextFilters)
    loadPessoas(nextFilters)
  }

  const buildFormFromPessoa = useCallback(
    (pessoa) => ({
      nome: pessoa?.nome || '',
      matricula: pessoa?.matricula || '',
      centroServico: pessoa?.centroServico ?? pessoa?.local ?? '',
      local: pessoa?.centroServico ?? pessoa?.local ?? '',
      setor: pessoa?.setor ?? '',
      cargo: pessoa?.cargo || '',
      dataAdmissao: formatDateInputValue(pessoa?.dataAdmissao),
      dataDemissao: formatDateInputValue(pessoa?.dataDemissao),
      tipoExecucao: pessoa?.tipoExecucao || '',
      ativo: pessoa?.ativo !== false,
      observacao: pessoa?.observacao || '',
    }),
    [],
  )

  const resetForm = () => {
    setEditingPessoa(null)
    setForm({ ...PESSOAS_FORM_DEFAULT })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const usuario = (user && (user.id || user.user?.id)) || resolveUsuarioNome(user)
      const payload = editingPessoa ? updatePessoaPayload(form, usuario) : createPessoaPayload(form, usuario)
      if (editingPessoa) {
        try {
          await updatePessoa(editingPessoa.id, payload)
        } catch (err) {
          if (err?.code === 'PESSOA_NOME_CONFLITO') {
            setNomeDiffPrompt({
              open: true,
              payload,
              id: editingPessoa?.id ?? null,
              editing: true,
              details: Array.isArray(err?.details) ? err.details : [],
            })
            setIsSaving(false)
            return
          }
          throw err
        }
      } else {
        try {
          await createPessoa(payload)
        } catch (err) {
          if (err?.code === 'PESSOA_NOME_CONFLITO') {
            setNomeDiffPrompt({
              open: true,
              payload,
              id: null,
              editing: false,
              details: Array.isArray(err?.details) ? err.details : [],
            })
            setIsSaving(false)
            return
          }
          throw err
        }
      }
      resetForm()
      setHistoryCache({})
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
      await loadPessoas(filters, true)
      await refreshReferencias()
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'pessoas_submit', editing: Boolean(editingPessoa) })
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (pessoa) => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setEditingPessoa(pessoa)
    setForm(buildFormFromPessoa(pessoa))
  }

  const cancelEdit = () => {
    resetForm()
  }

  const openHistory = async (pessoa) => {
    if (!pessoa?.id) return
    setError(null)
    const cached = historyCache[pessoa.id]
    if (cached) {
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, registros: cached })
      return
    }
    setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, isLoading: true })
    try {
      const registros = (await getPessoaHistory(pessoa.id)) ?? []
      setHistoryCache((prev) => ({ ...prev, [pessoa.id]: registros }))
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT, open: true, pessoa, registros })
    } catch (err) {
      setHistoryState({
        ...PESSOAS_HISTORY_DEFAULT,
        open: true,
        pessoa,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
      reportError(err, { area: 'pessoas_history', pessoaId: pessoa.id })
    }
  }

  const closeHistory = () => {
    setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
  }

  const openCancelModal = (pessoa) => setCancelState({ ...CANCEL_INITIAL, open: true, pessoa })

  const closeCancelModal = () => setCancelState({ ...CANCEL_INITIAL })

  const handleCancelObservationChange = (value) =>
    setCancelState((prev) => ({ ...prev, observacao: typeof value === 'string' ? value : '' }))

  const handleCancelSubmit = async () => {
    if (!cancelState.pessoa?.id) return
    const observacao = (cancelState.observacao || '').trim()
    if (!observacao) {
      setCancelState((prev) => ({ ...prev, error: 'Descreva o motivo do cancelamento.' }))
      return
    }
    setCancelState((prev) => ({ ...prev, isSubmitting: true, error: null }))
    try {
      const usuario = (user && (user.id || user.user?.id)) || resolveUsuarioNome(user)
      const payloadBase = { ...buildFormFromPessoa(cancelState.pessoa), ativo: false, observacao }
      await updatePessoa(cancelState.pessoa.id, updatePessoaPayload(payloadBase, usuario))
      if (editingPessoa?.id === cancelState.pessoa.id) {
        resetForm()
      }
      setHistoryCache({})
      closeCancelModal()
      await loadPessoas(filters, true)
    } catch (err) {
      setCancelState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Falha ao cancelar pessoa.',
      }))
      reportError(err, { area: 'pessoas_cancel', pessoaId: cancelState.pessoa.id })
    }
  }

  const cancelNomeDiff = () => {
    setNomeDiffPrompt({
      open: false,
      payload: null,
      id: null,
      editing: false,
      details: [],
    })
  }

  const confirmNomeDiff = useCallback(async () => {
    if (!nomeDiffPrompt.open || !nomeDiffPrompt.payload) return
    setIsSaving(true)
    setError(null)
    try {
      if (nomeDiffPrompt.editing) {
        await updatePessoa(nomeDiffPrompt.id, { ...nomeDiffPrompt.payload, forceNomeConflict: true })
      } else {
        await createPessoa({ ...nomeDiffPrompt.payload, forceNomeConflict: true })
      }
      resetForm()
      setHistoryCache({})
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
      await loadPessoas(filters, true)
      await refreshReferencias()
    } catch (err) {
      setError(err.message)
      reportError(err, { area: 'pessoas_submit_nome_conflict', editing: nomeDiffPrompt.editing })
    } finally {
      setIsSaving(false)
      cancelNomeDiff()
    }
  }, [filters, loadPessoas, nomeDiffPrompt, refreshReferencias, reportError, resetForm])

  const pessoasOrdenadas = useMemo(() => sortPessoasByNome(pessoas), [pessoas])

  const pessoasAtivas = useMemo(() => pessoas.filter((pessoa) => pessoa?.ativo !== false), [pessoas])

  const resumo = useMemo(() => {
    const porCentroMap = new Map()
    const porSetorMap = new Map()
    pessoasAtivas.forEach((pessoa) => {
      const centro = pessoa?.centroServico ?? pessoa?.local ?? ''
      const centroKey = normalizeOptionKey(centro)
      if (centroKey) {
        const atual = porCentroMap.get(centroKey) ?? { centro_servico: centro, total: 0 }
        atual.total += 1
        porCentroMap.set(centroKey, atual)
      }
      const setor = pessoa?.setor ?? ''
      const setorKey = normalizeOptionKey(setor)
      if (setorKey) {
        const atual = porSetorMap.get(setorKey) ?? { setor, total: 0 }
        atual.total += 1
        porSetorMap.set(setorKey, atual)
      }
    })
    const porCentro = Array.from(porCentroMap.values()).sort((a, b) =>
      String(a?.centro_servico ?? '').localeCompare(String(b?.centro_servico ?? ''), 'pt-BR')
    )
    const porSetor = Array.from(porSetorMap.values()).sort((a, b) =>
      String(a?.setor ?? '').localeCompare(String(b?.setor ?? ''), 'pt-BR')
    )
    return { totalGeral: pessoasAtivas.length, porCentro, porSetor }
  }, [normalizeOptionKey, pessoasAtivas])

  const centrosServicoBase = useMemo(() => extractCentrosServico(pessoasOptions), [pessoasOptions])
  const setoresBase = useMemo(() => extractSetores(pessoasOptions), [pessoasOptions])
  const cargosBase = useMemo(() => extractCargos(pessoasOptions), [pessoasOptions])
  const tiposExecucaoBase = useMemo(() => extractTiposExecucao(pessoasOptions), [pessoasOptions])

  const resolveScopedOptions = useCallback(
    (referenciasLista = [], baseOptions = []) => {
      const referenciasNomes = (referenciasLista ?? []).map((item) => item?.nome ?? '').filter(Boolean)
      if (isMasterUser) {
        return referenciasNomes.length > 0 ? uniqueSorted(referenciasNomes) : baseOptions
      }
      if (!baseOptions || baseOptions.length === 0) {
        return uniqueSorted(referenciasNomes)
      }
      const allowed = new Set(baseOptions.map(normalizeOptionKey).filter(Boolean))
      const filtrados = referenciasNomes.filter((nome) => allowed.has(normalizeOptionKey(nome)))
      if (filtrados.length > 0) {
        return uniqueSorted(filtrados)
      }
      return baseOptions
    },
    [isMasterUser, normalizeOptionKey],
  )

  const centrosServico = useMemo(() => {
    return resolveScopedOptions(referencias.centrosServico, centrosServicoBase)
  }, [centrosServicoBase, referencias.centrosServico, resolveScopedOptions])

  const setores = useMemo(() => {
    return resolveScopedOptions(referencias.setores, setoresBase)
  }, [referencias.setores, resolveScopedOptions, setoresBase])

  const cargos = useMemo(() => {
    return resolveScopedOptions(referencias.cargos, cargosBase)
  }, [cargosBase, referencias.cargos, resolveScopedOptions])

  const tiposExecucao = useMemo(() => {
    return resolveScopedOptions(referencias.tiposExecucao, tiposExecucaoBase)
  }, [referencias.tiposExecucao, resolveScopedOptions, tiposExecucaoBase])

  const formOptions = useMemo(
    () => ({
      centrosServico,
      setores,
      cargos,
      tiposExecucao,
    }),
    [centrosServico, setores, cargos, tiposExecucao],
  )

  return {
    form,
    filters,
    pessoas,
    pessoasOrdenadas,
    pessoasAtivas,
    resumo,
    editingPessoa,
    historyState,
    cancelState,
    isSaving,
    isLoading,
    error,
    centrosServico,
    setores,
    cargos,
    tiposExecucao,
    formOptions,
    handleFormChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    resetForm,
    startEdit,
    cancelEdit,
    openHistory,
    closeHistory,
    openCancelModal,
    closeCancelModal,
    handleCancelObservationChange,
    handleCancelSubmit,
    loadPessoas,
    nomeDiffPrompt,
    cancelNomeDiff,
    confirmNomeDiff,
  }
}
