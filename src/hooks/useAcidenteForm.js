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
import { listCentrosServico } from '../services/saidasService.js'
import { ACIDENTES_FORM_DEFAULT } from '../config/AcidentesConfig.js'

export function useAcidenteForm({
  pessoas = [],
  locais = [],
  agenteOpcoes = [],
  acidentes = [],
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
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])
  const [centrosServicoMap, setCentrosServicoMap] = useState(new Map())

  const normalizeLookupKey = useCallback((valor) => {
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
    if (centrosServicoOptions.length) {
      return centrosServicoOptions.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    }
    const valores = new Set()
    pessoas.forEach((pessoa) => {
      const centro = (pessoa?.centroServico ?? pessoa?.setor ?? '').trim()
      if (!centro) {
        return
      }
      valores.add(centro)
    })
    return Array.from(valores)
      .map((nome) => ({ id: null, nome, label: nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [centrosServicoOptions, pessoas])

  const resolveCentroServicoId = useCallback(
    (nome, fallbackId) => {
      const direto = fallbackId ? String(fallbackId).trim() : ''
      if (direto) {
        return direto
      }
      const chave = normalizeLookupKey(nome)
      if (!chave) {
        return ''
      }
      return centrosServicoMap.get(chave) ?? ''
    },
    [centrosServicoMap, normalizeLookupKey],
  )

  const resolveCentroServicoOption = useCallback(
    (valor) => {
      const alvo = valor !== undefined && valor !== null ? String(valor).trim() : ''
      if (!alvo) {
        return null
      }
      const lista = Array.isArray(centrosServicoOptions) ? centrosServicoOptions : []
      const matchId = lista.find((item) => String(item?.id ?? '') === alvo)
      if (matchId) {
        return {
          id: matchId.id ?? null,
          nome: String(matchId.nome ?? matchId.label ?? alvo).trim(),
        }
      }
      const alvoNormalizado = normalizeLookupKey(alvo)
      const matchNome = lista.find((item) => {
        const nome = String(item?.nome ?? item?.label ?? item ?? '').trim()
        return nome && normalizeLookupKey(nome) === alvoNormalizado
      })
      if (matchNome) {
        return {
          id: matchNome.id ?? null,
          nome: String(matchNome.nome ?? matchNome.label ?? alvo).trim(),
        }
      }
      return { id: null, nome: alvo }
    },
    [centrosServicoOptions, normalizeLookupKey],
  )

  const resolveLocalOption = useCallback(
    (valor) => {
      const alvo = valor !== undefined && valor !== null ? String(valor).trim() : ''
      if (!alvo) {
        return null
      }
      const lista = Array.isArray(locais) ? locais : []
      const direto = lista.find((item) => String(item?.id ?? item ?? '') === alvo)
      if (direto) {
        const nome = String(direto?.nome ?? direto?.label ?? direto ?? '').trim()
        return {
          id: direto?.id ?? null,
          nome: nome || alvo,
        }
      }
      const alvoNormalizado = normalizeLookupKey(alvo)
      const match = lista.find((item) => {
        const nome = String(item?.nome ?? item?.label ?? item ?? '').trim()
        return nome && normalizeLookupKey(nome) === alvoNormalizado
      })
      if (match) {
        const nome = String(match?.nome ?? match?.label ?? match ?? '').trim()
        return {
          id: match?.id ?? null,
          nome: nome || alvo,
        }
      }
      return { id: null, nome: alvo }
    },
    [locais, normalizeLookupKey],
  )

  const resolveLocalDisponivel = useCallback(
    (valor) => resolveLocalOption(valor)?.nome ?? '',
    [resolveLocalOption],
  )

  const resolveLocalId = useCallback(
    (valor) => resolveLocalOption(valor)?.id ?? null,
    [resolveLocalOption],
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
      pessoaId: '',
      matricula: '',
      nome: '',
      cargo: '',
      centroServico: '',
      centroServicoId: '',
      setor: '',
      local: '',
      localId: '',
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
        next.pessoaId = pessoa?.id ?? ''
        const matricula =
          pessoa?.matricula !== undefined && pessoa?.matricula !== null ? String(pessoa.matricula) : ''
        next.matricula = matricula
        next.nome = pessoa?.nome ?? ''
        next.cargo = pessoa?.cargo ?? ''
        const centroServico = pessoa?.centroServico ?? pessoa?.setor ?? ''
        next.centroServico = centroServico
        next.centroServicoId =
          resolveCentroServicoId(centroServico, pessoa?.centroServicoId ?? pessoa?.centro_servico_id) || ''
        next.setor = centroServico
        const localBase = pessoa?.local ?? centroServico
        next.local = resolveLocalDisponivel(localBase)
        next.localId = resolveLocalId(localBase) || ''
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
    [resolveCentroServicoId, resolveLocalDisponivel, resolveLocalId],
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
        pessoaId: '',
        matricula,
        nome: '',
        cargo: '',
        centroServico: '',
        centroServicoId: '',
        setor: '',
        local: '',
        localId: '',
      }))
    },
    [applyPessoaToForm, pessoasPorMatricula],
  )

  const agenteSelecionadoInfo = useMemo(() => {
    const agenteId = String(form.agenteId ?? '').trim()
    if (agenteId) {
      return (
        agenteOpcoes.find(
          (item) => item && String(item.id ?? item.agenteId ?? '') === agenteId,
        ) ?? { id: agenteId, nome: form.agente ?? '' }
      )
    }
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
  }, [agenteOpcoes, form.agente, form.agenteId])

  const agenteAtualPayload = useMemo(() => {
    const nome = normalizeAgenteNome(form.agente)
    if (agenteSelecionadoInfo && typeof agenteSelecionadoInfo === 'object') {
      const nomeOficial = normalizeAgenteNome(
        agenteSelecionadoInfo.nome ?? extractAgenteNome(agenteSelecionadoInfo),
      )
      const payloadNome = nomeOficial || nome
      return {
        nome: payloadNome,
        id: agenteSelecionadoInfo.id ?? agenteSelecionadoInfo.agenteId ?? form.agenteId ?? null,
      }
    }
    if (nome) {
      return { nome, id: form.agenteId ?? null }
    }
    return null
  }, [agenteSelecionadoInfo, form.agente, form.agenteId])

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
      if (name === 'agenteId') {
        let agenteAlterado = false
        setForm((prev) => {
          const atualId = String(prev.agenteId ?? '')
          const novoId = String(value ?? '')
          agenteAlterado = atualId !== novoId
          const next = { ...prev, agenteId: novoId }
          if (!novoId || agenteAlterado) {
            next.tipos = []
            next.tipo = ''
            next.tiposIds = []
            next.lesoes = []
            next.lesao = ''
            next.lesoesIds = []
          }
          return next
        })
        if (!value || agenteAlterado) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
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
            next.tiposIds = []
            next.lesoes = []
            next.lesao = ''
            next.lesoesIds = []
          }
          if (agenteAlterado) {
            next.tiposIds = []
            next.lesoesIds = []
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
            next.tiposIds = []
            next.lesoes = []
            next.lesao = ''
            next.lesoesIds = []
          }
          if (alterou) {
            next.tiposIds = []
            next.lesoesIds = []
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
      if (name === 'classificacoesAgentes') {
        const lista = Array.isArray(value) ? value : []
        setForm((prev) => ({ ...prev, classificacoesAgentes: lista }))
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
      if (name === 'tiposIds') {
        const lista = Array.isArray(value)
          ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
          : []
        setForm((prev) => ({ ...prev, tiposIds: lista }))
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
      if (name === 'lesoesIds') {
        const lista = Array.isArray(value)
          ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
          : []
        setForm((prev) => ({ ...prev, lesoesIds: lista }))
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
      if (name === 'partesIds') {
        const lista = Array.isArray(value)
          ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
          : []
        setForm((prev) => ({ ...prev, partesIds: lista }))
        return
      }
      if (name === 'centroServicoId') {
        const raw = value !== undefined && value !== null ? String(value).trim() : ''
        const option = resolveCentroServicoOption(raw)
        const nome = option?.nome ?? ''
        const idValue = option?.id ?? raw
        setForm((prev) => ({
          ...prev,
          centroServicoId: idValue,
          centroServico: nome,
          setor: nome,
        }))
        return
      }
      if (name === 'localId') {
        const raw = value !== undefined && value !== null ? String(value).trim() : ''
        const option = resolveLocalOption(raw)
        const nome = option?.nome ?? ''
        const idValue = option?.id ?? raw
        setForm((prev) => ({ ...prev, localId: idValue, local: nome }))
        return
      }
      if (name === 'local') {
        const localNome = resolveLocalDisponivel(value)
        setForm((prev) => ({ ...prev, local: localNome, localId: resolveLocalId(localNome || value) || '' }))
        return
      }
      if (name === 'centroServico') {
        const centroNome = typeof value === 'string' ? value : ''
        const centroServicoId = resolveCentroServicoId(centroNome)
        setForm((prev) => ({
          ...prev,
          centroServico: centroNome,
          setor: centroNome,
          centroServicoId: centroServicoId || '',
        }))
        return
      }
      if (name === 'data') {
        setForm((prev) => ({ ...prev, data: value }))
        return
      }
      setForm((prev) => ({ ...prev, [name]: value }))
    },
    [
      selectPessoaPorMatricula,
      resolveCentroServicoId,
      resolveCentroServicoOption,
      resolveLocalDisponivel,
      resolveLocalId,
      resolveLocalOption,
    ],
  )

  const handlePessoaInputChange = useCallback((event) => {
    const value = event.target.value
    setPessoaSearchValue(value)
    setPessoaSearchError(null)
    setForm((prev) => ({
      ...prev,
      pessoaId: '',
      matricula: '',
      nome: '',
      cargo: '',
      centroServico: '',
      centroServicoId: '',
      setor: '',
      local: '',
      localId: '',
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
      const centroServicoBase = acidente.centroServico || acidente.setor || ''
      const centroServicoId =
        acidente.centroServicoId || resolveCentroServicoId(centroServicoBase) || ''
      const localNome = resolveLocalDisponivel(acidente.local || centroServicoBase)
      const localId = acidente.localId || resolveLocalId(localNome) || ''
      const classificacoesAgentes = Array.isArray(acidente.classificacoesAgentes)
        ? acidente.classificacoesAgentes.slice()
        : []
      setForm({
        pessoaId: acidente.pessoaId || acidente.peopleId || '',
        matricula: acidente.matricula || '',
        nome: acidente.nome || '',
        cargo: acidente.cargo || '',
        data: toInputDateTime(acidente.data),
        diasPerdidos: acidente.diasPerdidos !== null && acidente.diasPerdidos !== undefined ? String(acidente.diasPerdidos) : '',
        diasDebitados:
          acidente.diasDebitados !== null && acidente.diasDebitados !== undefined ? String(acidente.diasDebitados) : '',
        tipo: '',
        tipos: [],
        tiposIds: [],
        agente: '',
        agentes: [],
        agenteId: '',
        classificacoesAgentes,
        cid: acidente.cid || '',
        lesao: '',
        lesoes: [],
        lesoesIds: [],
        parteLesionada: acidente.parteLesionada || '',
        centroServico: centroServicoBase,
        centroServicoId,
        setor: centroServicoBase,
        local: localNome,
        localId,
        partesLesionadas:
          Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
            ? acidente.partesLesionadas.slice()
            : acidente.parteLesionada
              ? [acidente.parteLesionada]
              : [],
        partesIds: Array.isArray(acidente.partesIds) ? acidente.partesIds.slice() : [],
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
    [pessoasPorMatricula, resolveCentroServicoId, resolveLocalDisponivel, resolveLocalId],
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

      const validationError = validateAcidenteForm(form, acidentes, editingAcidente?.id ?? null)
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
    [acidentes, editingAcidente, form, onError, onSaved, resetForm, user],
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
        const lista = (Array.isArray(data) ? data : [])
          .map((item) => {
            const nome = normalizeText(item?.nome || item?.label || '')
            if (!nome) {
              return null
            }
            return {
              id: item?.id ?? null,
              nome,
              label: normalizeText(item?.label || nome) || nome,
            }
          })
          .filter(Boolean)
        const mapa = new Map()
        lista.forEach((item) => {
          if (item?.id) {
            mapa.set(normalizeLookupKey(item.nome), item.id)
          }
        })
        setCentrosServicoOptions(lista)
        setCentrosServicoMap(mapa)
      } catch {
        if (cancelado) return
        setCentrosServicoOptions([])
        setCentrosServicoMap(new Map())
      }
    }
    carregarCentros()
    return () => {
      cancelado = true
    }
  }, [normalizeLookupKey])

  useEffect(() => {
    // HHT não é mais preenchido no formulário; taxas são calculadas no dashboard usando hht_mensal.
  }, [centrosServicoMap, form.centroServico, form.data, normalizeLookupKey])

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
