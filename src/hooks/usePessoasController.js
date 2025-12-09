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
  updatePessoaPayload,
} from '../rules/PessoasRules.js'
import { resolveUsuarioNome } from '../utils/pessoasUtils.js'
import { buildPessoasQuery, formatDateInputValue, mapOptionsById } from '../utils/pessoasUtils.js'
import {
  createPessoa,
  getPessoaHistory,
  getPessoasResumo,
  listPessoas,
  listPessoasReferences,
  updatePessoa,
} from '../services/pessoasService.js'

export function usePessoasController() {
  const { user } = useAuth()
  const { reportError } = useErrorLogger('pessoas')

  const [form, setForm] = useState(() => ({ ...PESSOAS_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...PESSOAS_FILTER_DEFAULT }))
  const [pessoas, setPessoas] = useState([])
  const [pessoasOptions, setPessoasOptions] = useState([])
  const pessoasOptionsRef = useRef([])
  const [resumo, setResumo] = useState({ totalGeral: 0, porCentro: [], porSetor: [] })

  const [editingPessoa, setEditingPessoa] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [historyState, setHistoryState] = useState(() => ({ ...PESSOAS_HISTORY_DEFAULT }))
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
        const query = buildPessoasQuery(params)
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

        setPessoas(enrichedPessoas)
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

  useEffect(() => {
    getPessoasResumo()
      .then((data) => setResumo(data ?? { totalGeral: 0, porCentro: [], porSetor: [] }))
      .catch(() => setResumo({ totalGeral: 0, porCentro: [], porSetor: [] }))
  }, [])

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    if (name === 'ativo') {
      const proximoValor = type === 'checkbox' ? Boolean(checked) : value !== 'false'
      const mensagem = proximoValor
        ? 'Deseja reativar este colaborador? Ele volta a ser considerado nos calculos e dashboards.'
        : 'Deseja realmente inativar este colaborador? Ele continuara visivel na lista, mas sera ignorado nos calculos e dashboards.'
      const aprovado = typeof window === 'undefined' ? true : window.confirm(mensagem)
      if (!aprovado) {
        event.preventDefault?.()
        return
      }
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
      if (editingPessoa) {
        await updatePessoa(editingPessoa.id, updatePessoaPayload(form, usuario))
      } else {
        await createPessoa(createPessoaPayload(form, usuario))
      }
      resetForm()
      setHistoryCache({})
      setHistoryState({ ...PESSOAS_HISTORY_DEFAULT })
      await loadPessoas(filters, true)
      await refreshReferencias()
      getPessoasResumo()
        .then((data) => setResumo(data ?? { totalGeral: 0, porCentro: [], porSetor: [] }))
        .catch(() => setResumo({ totalGeral: 0, porCentro: [], porSetor: [] }))
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
    setForm({
      nome: pessoa.nome || '',
      matricula: pessoa.matricula || '',
      centroServico: pessoa.centroServico ?? pessoa.local ?? '',
      local: pessoa.centroServico ?? pessoa.local ?? '',
      setor: pessoa.setor ?? '',
      cargo: pessoa.cargo || '',
      dataAdmissao: formatDateInputValue(pessoa.dataAdmissao),
      tipoExecucao: pessoa.tipoExecucao || '',
      ativo: pessoa.ativo !== false,
    })
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

  const pessoasOrdenadas = useMemo(() => sortPessoasByNome(pessoas), [pessoas])

  const pessoasAtivas = useMemo(() => pessoas.filter((pessoa) => pessoa?.ativo !== false), [pessoas])

  const centrosServico = useMemo(() => {
    const referenciasNomes = (referencias.centrosServico ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) return referenciasNomes
    return extractCentrosServico(pessoasOptions)
  }, [referencias.centrosServico, pessoasOptions])

  const setores = useMemo(() => {
    const referenciasNomes = (referencias.setores ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) return referenciasNomes
    return extractSetores(pessoasOptions)
  }, [referencias.setores, pessoasOptions])

  const cargos = useMemo(() => {
    const referenciasNomes = (referencias.cargos ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) return referenciasNomes
    return extractCargos(pessoasOptions)
  }, [referencias.cargos, pessoasOptions])

  const tiposExecucao = useMemo(() => {
    const referenciasNomes = (referencias.tiposExecucao ?? []).map((item) => item?.nome ?? '').filter(Boolean)
    if (referenciasNomes.length > 0) return referenciasNomes
    return extractTiposExecucao(pessoasOptions)
  }, [referencias.tiposExecucao, pessoasOptions])

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
    loadPessoas,
  }
}
