import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  validateAcidenteForm,
  createAcidentePayload,
  updateAcidentePayload,
} from '../rules/AcidentesRules.js'
import {
  toInputDateTime,
  parseList,
  normalizeAgenteKey,
  normalizeAgenteNome,
  extractAgenteNome,
  normalizeText,
} from '../utils/acidentesUtils.js'
import {
  formatPessoaDetail,
  formatPessoaSummary,
  normalizeSearchValue,
  pessoaMatchesTerm,
  PESSOA_SEARCH_DEBOUNCE_MS,
  PESSOA_SEARCH_MAX_RESULTS,
  PESSOA_SEARCH_MIN_CHARS,
} from '../utils/saidasUtils.js'
import {
  createAcidente,
  updateAcidente,
  listLesoesPorAgente,
  listTiposPorAgente,
} from '../services/acidentesService.js'
import { searchPessoas } from '../services/pessoasService.js'
import { listHhtMensal } from '../services/hhtMensalService.js'
import { listCentrosServico } from '../services/saidasService.js'
import { ACIDENTES_FORM_DEFAULT } from '../config/AcidentesConfig.js'

export function useAcidenteForm({
  pessoas = [],
  locais = [],
  agenteOpcoes = [],
  onSaved,
  onError,
}) {
  const { user } = useAuth()

  const [form, setForm] = useState(() => ({ ...ACIDENTES_FORM_DEFAULT }))
  const [editingAcidente, setEditingAcidente] = useState(null)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [tipoOpcoes, setTipoOpcoes] = useState([])
  const [tiposError, setTiposError] = useState(null)
  const [isLoadingTipos, setIsLoadingTipos] = useState(false)

  const [lesaoOpcoes, setLesaoOpcoes] = useState([])
  const [lesoesError, setLesoesError] = useState(null)
  const [isLoadingLesoes, setIsLoadingLesoes] = useState(false)

  const [pessoaSearchValue, setPessoaSearchValue] = useState('')
  const [pessoaSuggestions, setPessoaSuggestions] = useState([])
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const [isSearchingPessoas, setIsSearchingPessoas] = useState(false)
  const [pessoaSearchError, setPessoaSearchError] = useState(null)
  const pessoaSearchTimeoutRef = useRef(null)
  const pessoaBlurTimeoutRef = useRef(null)
  const [centrosServicoMap, setCentrosServicoMap] = useState(new Map())

  const normalizeCentroKey = useCallback((valor) => {
    if (!valor) return ''
    return String(valor)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }, [])

  const pessoasPorMatricula = useMemo(() => {
    const map = new Map()
    pessoas.forEach((pessoa) => {
      if (!pessoa?.matricula) {
        return
      }
      map.set(String(pessoa.matricula), pessoa)
    })
    return map
  }, [pessoas])

  const centrosServicoPessoas = useMemo(() => {
    const valores = new Set()
    pessoas.forEach((pessoa) => {
      const centro = (pessoa?.centroServico ?? pessoa?.setor ?? '').trim()
      if (!centro) {
        return
      }
      valores.add(centro)
    })
    return Array.from(valores).sort((a, b) => a.localeCompare(b))
  }, [pessoas])

  const resolveLocalDisponivel = useCallback(
    (valor) => {
      const alvo = valor?.trim()
      if (!alvo) {
        return ''
      }
      const matchDireto = locais.find((item) => item === alvo)
      if (matchDireto) {
        return matchDireto
      }
      const normalizar = (texto) =>
        texto
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const alvoNormalizado = normalizar(alvo)
      return locais.find((item) => normalizar(item) === alvoNormalizado) ?? ''
    },
    [locais],
  )

  const dedupePessoas = useCallback((lista = []) => {
    const mapa = new Map()
    ;(Array.isArray(lista) ? lista : []).forEach((pessoa) => {
      const chave = pessoa?.id ?? pessoa?.matricula ?? pessoa?.nome
      if (!chave) {
        return
      }
      const id = String(chave)
      if (!mapa.has(id)) {
        mapa.set(id, pessoa)
      }
    })
    return Array.from(mapa.values())
  }, [])

  const fallbackPessoaSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) return []
      return pessoas.filter((pessoa) => pessoaMatchesTerm(pessoa, normalized)).slice(0, PESSOA_SEARCH_MAX_RESULTS)
    },
    [pessoas],
  )

  const clearPessoaSelection = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      matricula: '',
      nome: '',
      cargo: '',
      centroServico: '',
      setor: '',
      local: '',
    }))
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }, [])

  const applyPessoaToForm = useCallback(
    (pessoa) => {
      if (!pessoa) {
        return
      }
      setForm((prev) => {
        const next = { ...prev }
        const matricula =
          pessoa?.matricula !== undefined && pessoa?.matricula !== null ? String(pessoa.matricula) : ''
        next.matricula = matricula
        next.nome = pessoa?.nome ?? ''
        next.cargo = pessoa?.cargo ?? ''
        const centroServico = pessoa?.centroServico ?? pessoa?.setor ?? ''
        next.centroServico = centroServico
        next.setor = centroServico
        const localBase = pessoa?.local ?? centroServico
        next.local = resolveLocalDisponivel(localBase)
        return next
      })
      const resumo = formatPessoaSummary(pessoa)
      const detalhe = formatPessoaDetail(pessoa)
      const label = resumo || [pessoa?.matricula, pessoa?.nome].filter(Boolean).join(' - ') || detalhe || ''
      setPessoaSearchValue(label)
      setPessoaSuggestions([])
      setPessoaDropdownOpen(false)
      setPessoaSearchError(null)
    },
    [resolveLocalDisponivel],
  )

  const selectPessoaPorMatricula = useCallback(
    (matricula) => {
      const pessoa = pessoasPorMatricula.get(matricula)
      if (pessoa) {
        applyPessoaToForm(pessoa)
        return
      }
      setForm((prev) => ({
        ...prev,
        matricula,
        nome: '',
        cargo: '',
        centroServico: '',
        setor: '',
        local: '',
      }))
    },
    [applyPessoaToForm, pessoasPorMatricula],
  )

  const agenteSelecionadoInfo = useMemo(() => {
    const alvo = normalizeAgenteKey(form.agente ?? '')
    if (!alvo) {
      return null
    }
    return (
      agenteOpcoes.find((item) => {
        if (!item) {
          return false
        }
        const nomeItem = extractAgenteNome(item)
        return normalizeAgenteKey(nomeItem) === alvo
      }) ?? null
    )
  }, [agenteOpcoes, form.agente])

  const agenteAtualPayload = useMemo(() => {
    const nome = normalizeAgenteNome(form.agente)
    if (agenteSelecionadoInfo && typeof agenteSelecionadoInfo === 'object') {
      const nomeOficial = normalizeAgenteNome(
        agenteSelecionadoInfo.nome ?? extractAgenteNome(agenteSelecionadoInfo),
      )
      const payloadNome = nomeOficial || nome
      return {
        nome: payloadNome,
        id: agenteSelecionadoInfo.id ?? agenteSelecionadoInfo.agenteId ?? null,
      }
    }
    if (nome) {
      return { nome, id: null }
    }
    return null
  }, [agenteSelecionadoInfo, form.agente])

  useEffect(() => {
    let cancelado = false
    if (!agenteAtualPayload) {
      setLesaoOpcoes([])
      setLesoesError(null)
      setIsLoadingLesoes(false)
      return () => {
        cancelado = true
      }
    }
    const fetchLesoes = async () => {
      setIsLoadingLesoes(true)
      setLesoesError(null)
      setLesaoOpcoes([])
      try {
        const response = await listLesoesPorAgente(agenteAtualPayload)
        if (!cancelado) {
          setLesaoOpcoes(Array.isArray(response) ? response : [])
        }
      } catch (err) {
        if (!cancelado) {
          setLesoesError(err.message)
          setLesaoOpcoes([])
        }
      } finally {
        if (!cancelado) {
          setIsLoadingLesoes(false)
        }
      }
    }
    fetchLesoes()
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  useEffect(() => {
    if (!agenteAtualPayload) {
      setTipoOpcoes([])
      setTiposError(null)
      setIsLoadingTipos(false)
      return
    }
    let cancelado = false
    setIsLoadingTipos(true)
    setTiposError(null)
    setTipoOpcoes([])
    listTiposPorAgente(agenteAtualPayload)
      .then((lista) => {
        if (!cancelado) {
          setTipoOpcoes(Array.isArray(lista) ? lista : [])
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setTiposError(err.message)
          setTipoOpcoes([])
        }
      })
      .finally(() => {
        if (!cancelado) {
          setIsLoadingTipos(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  const resetForm = useCallback(() => {
    setForm({ ...ACIDENTES_FORM_DEFAULT })
    setEditingAcidente(null)
    setTipoOpcoes([])
    setTiposError(null)
    setIsLoadingTipos(false)
    setLesaoOpcoes([])
    setLesoesError(null)
    setIsLoadingLesoes(false)
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
    setIsSearchingPessoas(false)
  }, [])

  const handleFormChange = useCallback(
    (event) => {
      const { name, type } = event.target
      const value =
        type === 'checkbox' && typeof event.target.checked === 'boolean'
          ? event.target.checked
          : event.target.value
      if (name === 'matricula') {
        selectPessoaPorMatricula(value)
        return
      }
      if (name === 'agentes') {
        const lista = Array.isArray(value)
          ? value
              .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
              .filter(Boolean)
          : parseList(value)
        let agenteAlterado = false
        setForm((prev) => {
          const agenteAtual = lista.length ? lista[lista.length - 1] : ''
          const chaveAtual = normalizeAgenteKey(agenteAtual)
          const chaveAnterior = normalizeAgenteKey(prev.agente ?? '')
          agenteAlterado = chaveAtual !== chaveAnterior
          const next = { ...prev, agentes: lista, agente: agenteAtual }
          if (!lista.length) {
            next.tipos = []
            next.tipo = ''
            next.lesoes = []
            next.lesao = ''
          }
          return next
        })
        if (!lista.length) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        if (agenteAlterado) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        return
      }
      if (name === 'agente') {
        let alterou = false
        setForm((prev) => {
          if (prev.agente === value) {
            alterou = false
            return prev
          }
          const chaveAnterior = normalizeAgenteKey(prev.agente ?? '')
          const chaveAtual = normalizeAgenteKey(value)
          alterou = chaveAnterior !== chaveAtual
          const next = { ...prev, agente: value }
          if (!value) {
            next.tipos = []
            next.tipo = ''
            next.lesoes = []
            next.lesao = ''
          }
          return next
        })
        if (!value || alterou) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        return
      }
      if (name === 'tipo') {
        setForm((prev) => ({ ...prev, tipo: value }))
        return
      }
      if (name === 'tipos') {
        const lista = Array.isArray(value)
          ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
          : parseList(value)
        setForm((prev) => ({ ...prev, tipos: lista, tipo: lista.join('; ') }))
        return
      }
      if (name === 'lesoes') {
        const lista = Array.isArray(value)
          ? value.filter((item) => item && item.trim())
          : typeof value === 'string' && value
            ? [value.trim()].filter(Boolean)
            : []
        setForm((prev) => ({ ...prev, lesoes: lista, lesao: lista[0] ?? '' }))
        return
      }
      if (name === 'partesLesionadas') {
        const lista = Array.isArray(value)
          ? value.filter((item) => item && item.trim())
          : typeof value === 'string' && value
          ? [value.trim()].filter(Boolean)
          : []
        setForm((prev) => ({ ...prev, partesLesionadas: lista }))
        return
      }
      if (name === 'local') {
        setForm((prev) => ({ ...prev, local: resolveLocalDisponivel(value) }))
        return
      }
      if (name === 'centroServico') {
        setForm((prev) => ({ ...prev, centroServico: value, setor: value, hht: '' }))
        return
      }
      if (name === 'data') {
        setForm((prev) => ({ ...prev, data: value, hht: '' }))
        return
      }
      setForm((prev) => ({ ...prev, [name]: value }))
    },
    [selectPessoaPorMatricula, resolveLocalDisponivel],
  )

  const handlePessoaInputChange = useCallback((event) => {
    const value = event.target.value
    setPessoaSearchValue(value)
    setPessoaSearchError(null)
    setForm((prev) => ({
      ...prev,
      matricula: '',
      nome: '',
      cargo: '',
      centroServico: '',
      setor: '',
      local: '',
    }))
    if (value.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    } else {
      setPessoaDropdownOpen(false)
      setPessoaSuggestions([])
    }
  }, [])

  const handlePessoaSelect = useCallback(
    (pessoa) => {
      if (!pessoa) return
      applyPessoaToForm(pessoa)
    },
    [applyPessoaToForm],
  )

  const handlePessoaFocus = useCallback(() => {
    if (!form.matricula && pessoaSearchValue.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    }
  }, [form.matricula, pessoaSearchValue])

  const handlePessoaBlur = useCallback(() => {
    pessoaBlurTimeoutRef.current = setTimeout(() => {
      setPessoaDropdownOpen(false)
    }, 120)
  }, [])

  const startEdit = useCallback(
    (acidente) => {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setEditingAcidente(acidente)
      const lesoesSelecionadas =
        Array.isArray(acidente.lesoes) && acidente.lesoes.length
          ? acidente.lesoes.slice()
          : acidente.lesao
            ? [acidente.lesao]
            : []
      const agentesSelecionados = parseList(acidente.agentes?.length ? acidente.agentes : acidente.agente)
      const tiposSelecionados = parseList(acidente.tipos?.length ? acidente.tipos : acidente.tipo)
      setForm({
        matricula: acidente.matricula || '',
        nome: acidente.nome || '',
        cargo: acidente.cargo || '',
        data: toInputDateTime(acidente.data),
        diasPerdidos: acidente.diasPerdidos !== null && acidente.diasPerdidos !== undefined ? String(acidente.diasPerdidos) : '',
        diasDebitados:
          acidente.diasDebitados !== null && acidente.diasDebitados !== undefined ? String(acidente.diasDebitados) : '',
        tipo: tiposSelecionados.join('; '),
        tipos: tiposSelecionados,
        agente: agentesSelecionados[agentesSelecionados.length - 1] || '',
        agentes: agentesSelecionados,
        cid: acidente.cid || '',
        lesao: lesoesSelecionadas[0] || '',
        lesoes: lesoesSelecionadas,
        parteLesionada: acidente.parteLesionada || '',
        hht:
          acidente.hht !== null && acidente.hht !== undefined ? String(acidente.hht) : '',
        centroServico: acidente.centroServico || acidente.setor || '',
        setor: acidente.centroServico || acidente.setor || '',
        local: resolveLocalDisponivel(acidente.local || acidente.centroServico || ''),
        partesLesionadas:
          Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
            ? acidente.partesLesionadas.slice()
            : acidente.parteLesionada
              ? [acidente.parteLesionada]
              : [],
        cat: acidente.cat || '',
        observacao: acidente.observacao || '',
        dataEsocial: acidente.dataEsocial || '',
        sesmt: Boolean(acidente.sesmt),
        dataSesmt: acidente.dataSesmt || '',
      })
      const pessoaSelecionada =
        pessoasPorMatricula.get(String(acidente.matricula ?? '').trim()) ?? null
      const resumoPessoa = pessoaSelecionada ? formatPessoaSummary(pessoaSelecionada) : ''
      const fallbackLabel = resumoPessoa || [acidente.nome, acidente.matricula].filter(Boolean).join(' - ')
      setPessoaSearchValue(fallbackLabel)
      setPessoaSuggestions([])
      setPessoaDropdownOpen(false)
      setPessoaSearchError(null)
      setIsSearchingPessoas(false)
      setTipoOpcoes([])
      setTiposError(null)
    },
    [pessoasPorMatricula, resolveLocalDisponivel],
  )

  useEffect(() => {
    if (pessoaSearchTimeoutRef.current) {
      clearTimeout(pessoaSearchTimeoutRef.current)
      pessoaSearchTimeoutRef.current = null
    }
    const termo = pessoaSearchValue.trim()
    if (form.matricula || termo.length < PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSuggestions([])
      setIsSearchingPessoas(false)
      setPessoaSearchError(null)
      setPessoaDropdownOpen(false)
      return
    }
    let cancelado = false
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
        if (!cancelado) {
          setPessoaSuggestions(dedupePessoas(resultados ?? []))
          setPessoaDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelado) {
          setPessoaSearchError(err.message || 'Falha ao buscar pessoas.')
          setPessoaSuggestions([])
          setPessoaDropdownOpen(true)
        }
      } finally {
        if (!cancelado) {
          setIsSearchingPessoas(false)
        }
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelado = true
      if (pessoaSearchTimeoutRef.current) {
        clearTimeout(pessoaSearchTimeoutRef.current)
        pessoaSearchTimeoutRef.current = null
      }
    }
  }, [pessoaSearchValue, form.matricula, fallbackPessoaSearch, dedupePessoas])

  const cancelEdit = useCallback(() => {
    resetForm()
  }, [resetForm])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setFormError(null)

      const validationError = validateAcidenteForm(form)
      if (validationError) {
        setFormError(validationError)
        return
      }

      setIsSaving(true)

      try {
        const usuario = user?.name || user?.username || user?.email || 'sistema'

        if (editingAcidente) {
          await updateAcidente(editingAcidente.id, updateAcidentePayload(form, usuario))
        } else {
          await createAcidente(createAcidentePayload(form, usuario))
        }

        resetForm()
        if (typeof onSaved === 'function') {
          await onSaved()
        }
      } catch (err) {
        setFormError(err.message)
        if (typeof onError === 'function') {
          onError(err, { form })
        }
      } finally {
        setIsSaving(false)
      }
    },
    [editingAcidente, form, onError, onSaved, resetForm, user],
  )

  useEffect(() => {
    return () => {
      if (pessoaBlurTimeoutRef.current) {
        clearTimeout(pessoaBlurTimeoutRef.current)
      }
      if (pessoaSearchTimeoutRef.current) {
        clearTimeout(pessoaSearchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelado = false
    const carregarCentros = async () => {
      try {
        const data = await listCentrosServico()
        if (cancelado) return
        const mapa = new Map()
        ;(Array.isArray(data) ? data : []).forEach((item) => {
          const nome = normalizeText(item?.nome || item?.label || '')
          if (nome && item?.id) {
            mapa.set(normalizeCentroKey(nome), item.id)
          }
        })
        setCentrosServicoMap(mapa)
      } catch {
        if (cancelado) return
        setCentrosServicoMap(new Map())
      }
    }
    carregarCentros()
    return () => {
      cancelado = true
    }
  }, [normalizeCentroKey])

  useEffect(() => {
    let cancelado = false
    const pad2 = (value) => String(value).padStart(2, '0')
    const toMonthRef = (value) => {
      const raw = value ? String(value) : ''
      if (!raw) return null
      const datePart = raw.split('T')[0]
      if (/^\d{4}-\d{2}$/.test(raw)) {
        return `${raw}-01`
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return `${datePart.slice(0, 7)}-01`
      }
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) {
        return null
      }
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      return `${year}-${pad2(month)}-01`
    }
    const fetchHht = async () => {
      const centroNome = normalizeText(form.centroServico || '')
      const dataAcidente = form.data
      if (!centroNome || !dataAcidente) {
        return
      }
      const mesRef = toMonthRef(dataAcidente)
      if (!mesRef) {
        return
      }
      const centroId = centrosServicoMap.get(normalizeCentroKey(centroNome))
      const query = {
        centroServicoId: centroId || undefined,
        centroServicoNome: centroNome,
        mesInicio: mesRef,
        mesFim: mesRef,
        incluirInativos: false,
      }

      try {
        const lista = await listHhtMensal(query)
        if (cancelado) return
        const registro = Array.isArray(lista) ? lista.find((item) => item) : null
        if (!registro) {
          return
        }
        const valor = registro.hhtFinal ?? registro.hht_final ?? registro.hhtCalculado ?? registro.hht_calculado
        if (valor === undefined || valor === null || Number.isNaN(Number(valor))) {
          return
        }
        setForm((prev) => ({ ...prev, hht: String(valor) }))
      } catch {
        if (cancelado) return
      }
    }
    fetchHht()
    return () => {
      cancelado = true
    }
  }, [centrosServicoMap, form.centroServico, form.data, normalizeCentroKey])

  return {
    form,
    setForm,
    formError,
    isSaving,
    handleFormChange,
    handleSubmit,
    startEdit,
    cancelEdit,
    resetForm,
    editingAcidente,
    tipoOpcoes,
    tiposError,
    isLoadingTipos,
    lesaoOpcoes,
    lesoesError,
    isLoadingLesoes,
    centrosServicoPessoas,
    pessoaSearchValue,
    pessoaSuggestions,
    pessoaDropdownOpen,
    isSearchingPessoas,
    pessoaSearchError,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    clearPessoaSelection,
  }
}
