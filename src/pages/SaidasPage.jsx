import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ExitIcon } from '../components/icons.jsx'
import { TablePagination } from '../components/TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/MateriaisPage.css'

const initialForm = {
  pessoaId: '',
  materialId: '',
  quantidade: '',
  centroCusto: '',
  centroCustoId: '',
  centroServico: '',
  centroServicoId: '',
  dataEntrega: '',
}

const filterInitial = {
  termo: '',
  registradoPor: '',
  centroCusto: '',
  centroServico: '',
  status: '',
  dataInicio: '',
  dataFim: '',
}

const MATERIAL_SEARCH_MIN_CHARS = 2
const MATERIAL_SEARCH_MAX_RESULTS = 10
const MATERIAL_SEARCH_DEBOUNCE_MS = 250
const PESSOA_SEARCH_MIN_CHARS = 2
const PESSOA_SEARCH_MAX_RESULTS = 10
const PESSOA_SEARCH_DEBOUNCE_MS = 250

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isLikelyUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

const normalizeSearchValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const materialMatchesTerm = (material, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    material?.nome,
    material?.nomeItemRelacionado,
    material?.materialItemNome,
    material?.grupoMaterial,
    material?.grupoMaterialNome,
    material?.numeroCalcado,
    material?.numeroVestimenta,
    material?.numeroEspecifico,
    material?.fabricante,
    material?.fabricanteNome,
    material?.corMaterial,
    material?.coresTexto,
    material?.ca,
    material?.id,
  ]
  return campos
    .map((campo) => normalizeSearchValue(campo))
    .some((campo) => campo.includes(termoNormalizado))
}

const formatMaterialSummary = (material) => {
  if (!material) {
    return ''
  }
  const nome =
    [material.materialItemNome, material.nome, material.nomeId, material.id].find(
      (valor) => valor && !isLikelyUuid(valor),
    ) || ''
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ''
  const detalheCandidates = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes[0] : '',
  ]
  const detalhe = detalheCandidates.find(
    (valor) => valor && !isLikelyUuid(valor),
  ) || ''
  const corDescricao =
    material.coresTexto ||
    material.corMaterial ||
    (Array.isArray(material.coresNomes) ? material.coresNomes.join(', ') : '')
  const caracteristicaDescricao =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes)
      ? material.caracteristicasNomes.join(', ')
      : '')
  const fabricante =
    material.fabricanteNome ||
    (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : '') ||
    ''
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set()
  const partes = resumo.filter((parte) => {
    const texto = (parte || '').toString().trim()
    if (!texto) {
      return false
    }
    const chave = texto.toLowerCase()
    if (vistos.has(chave)) {
      return false
    }
    vistos.add(chave)
    return true
  })
  return partes.join(' | ')
}

const formatPessoaSummary = (pessoa) => {
  if (!pessoa) {
    return ''
  }
  const nome = (pessoa.nome || '').trim()
  const matricula = (pessoa.matricula || '').trim()
  const cargo = (pessoa.cargo || '').trim()
  if (nome && matricula) {
    return cargo ? `${nome} (${matricula}) - ${cargo}` : `${nome} (${matricula})`
  }
  return nome || matricula
}

const formatPessoaDetail = (pessoa) => {
  if (!pessoa) {
    return ''
  }
  return pessoa.cargo ? pessoa.cargo : ''
}

const pessoaMatchesTerm = (pessoa, termoNormalizado) => {
  if (!termoNormalizado) {
    return true
  }
  const campos = [
    pessoa?.nome,
    pessoa?.matricula,
    pessoa?.centroServico,
    pessoa?.local,
    pessoa?.setor,
    pessoa?.cargo,
  ]
  return campos
    .map((campo) => normalizeSearchValue(campo))
    .some((campo) => campo.includes(termoNormalizado))
}

const buildSaidasQuery = (filters) => {
  const query = {}
  const centroCusto = filters.centroCusto?.trim()
  if (centroCusto) {
    query.centroCusto = centroCusto
  }
  const centroServico = filters.centroServico?.trim()
  if (centroServico) {
    query.centroServico = centroServico
  }
  const status = filters.status?.trim()
  if (status) {
    query.status = status
  }
  if (filters.dataInicio) {
    query.dataInicio = filters.dataInicio
  }
  if (filters.dataFim) {
    query.dataFim = filters.dataFim
  }
  const termo = filters.termo?.trim()
  if (termo) {
    query.termo = termo
  }
  return query
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

const formatDisplayDateTime = (value) => {
  if (!value) {
    return 'Nao informado'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nao informado'
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
    timeZone,
  })
}

export function SaidasPage() {
  const { user } = useAuth()
  const [Nomes, setNomes] = useState([])
  const [materiais, setMateriais] = useState([])
  const [saidas, setSaidas] = useState([])
  const [centrosCustoOptions, setCentrosCustoOptions] = useState([])
  const [centrosServicoOptions, setCentrosServicoOptions] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState(filterInitial)
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
  const [pessoaSearchValue, setPessoaSearchValue] = useState('')
  const [pessoaSuggestions, setPessoaSuggestions] = useState([])
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const [isSearchingPessoas, setIsSearchingPessoas] = useState(false)
  const [pessoaSearchError, setPessoaSearchError] = useState(null)
  const pessoaSearchTimeoutRef = useRef(null)
  const pessoaBlurTimeoutRef = useRef(null)

  const load = async (params = filters, { resetPage = false } = {}) => {
    if (resetPage) {
      setCurrentPage(1)
    }
    setIsLoading(true)
    setError(null)
    try {
      const materiaisPromise =
        api?.entradas?.materialOptions && typeof api.entradas.materialOptions === 'function'
          ? api.entradas.materialOptions()
          : api.materiais.list()
      const shouldLoadCentrosCusto =
        centrosCustoOptions.length === 0 && api?.centrosCusto && typeof api.centrosCusto.list === 'function'
      const shouldLoadCentrosServico =
        centrosServicoOptions.length === 0 && api?.centrosServico && typeof api.centrosServico.list === 'function'
      const [NomesData, materiaisData, saidasData, centrosCustoData, centrosServicoData] = await Promise.all([
        api.pessoas.list(),
        materiaisPromise,
        api.saidas.list(buildSaidasQuery(params)),
        shouldLoadCentrosCusto ? api.centrosCusto.list() : Promise.resolve(null),
        shouldLoadCentrosServico ? api.centrosServico.list() : Promise.resolve(null),
      ])
      setNomes(NomesData ?? [])
      setMateriais(materiaisData ?? [])
      setSaidas(saidasData ?? [])
      if (centrosCustoData) {
        setCentrosCustoOptions(centrosCustoData ?? [])
      }
      if (centrosServicoData) {
        setCentrosServicoOptions(centrosServicoData ?? [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(filterInitial, { resetPage: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.pessoaId) {
      setError('Selecione um colaborador valido.')
      return
    }
    if (!form.materialId) {
      setError('Selecione um material valido.')
      return
    }
    if (!form.dataEntrega) {
      setError('Informe a data de entrega.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        pessoaId: form.pessoaId,
        materialId: form.materialId,
        quantidade: Number(form.quantidade),
        centroCusto: form.centroCusto.trim(),
        centroCustoId: form.centroCustoId,
        centroServico: form.centroServico.trim(),
        centroServicoId: form.centroServicoId,
        dataEntrega: form.dataEntrega,
        usuarioResponsavel: user?.name || user?.username || 'sistema',
      }
      await api.saidas.create(payload)
      setForm({ ...initialForm })
      setPessoaSearchValue('')
      setPessoaSuggestions([])
      setPessoaDropdownOpen(false)
      setPessoaSearchError(null)
      setMaterialSearchValue('')
      setMaterialSuggestions([])
      setMaterialDropdownOpen(false)
      setMaterialSearchError(null)
      await load(filters, { resetPage: true })
    } catch (err) {
      setError(err.message)
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
    setFilters({ ...filterInitial })
    load(filterInitial, { resetPage: true })
  }

  const handleMaterialInputChange = (event) => {
    const { value } = event.target
    if (materialBlurTimeoutRef.current) {
      clearTimeout(materialBlurTimeoutRef.current)
      materialBlurTimeoutRef.current = null
    }
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
  }

  const handlePessoaInputChange = (event) => {
    const { value } = event.target
    if (pessoaBlurTimeoutRef.current) {
      clearTimeout(pessoaBlurTimeoutRef.current)
      pessoaBlurTimeoutRef.current = null
    }
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
    if (!pessoa) {
      return
    }
    const centroServicoNome = pessoa.centroServico ?? pessoa.setor ?? pessoa.local ?? ''
    const centroCustoNome = pessoa.centroCusto ?? ''
    setForm((prev) => ({
      ...prev,
      pessoaId: pessoa.id,
      centroServico: centroServicoNome,
      centroServicoId: pessoa.centroServicoId ?? '',
      centroCusto: centroCustoNome,
      centroCustoId: pessoa.centroCustoId ?? '',
    }))
    setPessoaSearchValue(formatPessoaSummary(pessoa))
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }

  const handlePessoaFocus = () => {
    if (pessoaBlurTimeoutRef.current) {
      clearTimeout(pessoaBlurTimeoutRef.current)
      pessoaBlurTimeoutRef.current = null
    }
    if (!form.pessoaId && pessoaSearchValue.trim().length >= PESSOA_SEARCH_MIN_CHARS) {
      setPessoaDropdownOpen(true)
    }
  }

  const handlePessoaBlur = () => {
    pessoaBlurTimeoutRef.current = setTimeout(() => {
      setPessoaDropdownOpen(false)
    }, 120)
  }

  const handlePessoaClear = () => {
    setForm((prev) => ({
      ...prev,
      pessoaId: '',
      centroCusto: '',
      centroCustoId: '',
      centroServico: '',
      centroServicoId: '',
    }))
    setPessoaSearchValue('')
    setPessoaSuggestions([])
    setPessoaDropdownOpen(false)
    setPessoaSearchError(null)
  }

  const NomesMap = useMemo(() => {
    const map = new Map()
    Nomes.forEach((item) => map.set(item.id, item))
    return map
  }, [Nomes])

  const materiaisMap = useMemo(() => {
    const map = new Map()
    materiais.forEach((item) => map.set(item.id, { ...item, valorUnitario: Number(item.valorUnitario ?? 0) }))
    return map
  }, [materiais])

  const statusOptions = useMemo(() => {
    const values = new Set()
    saidas.forEach((item) => {
      if (item?.status) {
        values.add(item.status)
      }
    })
    return Array.from(values).sort()
  }, [saidas])

  const registradoOptions = useMemo(() => {
    const mapa = new Map()
    saidas.forEach((saida) => {
      const nome = saida.usuarioResponsavelNome || saida.usuarioResponsavel || 'Nao informado'
      const id = saida.usuarioResponsavelId || nome
      if (!nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas])

  const centrosCustoMap = useMemo(() => {
    const map = new Map()
    centrosCustoOptions.forEach((item) => {
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
  }, [centrosCustoOptions])

  const centrosServicoMap = useMemo(() => {
    const map = new Map()
    centrosServicoOptions.forEach((item) => {
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
  }, [centrosServicoOptions])

  const resolveCentroCustoLabel = useCallback(
    (saida) => {
      if (!saida) {
        return ''
      }
      const candidatos = [saida.centroCustoId, saida.centroCusto]
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
      return saida.centroCusto || ''
    },
    [centrosCustoMap]
  )

  const resolveCentroServicoLabel = useCallback(
    (saida) => {
      if (!saida) {
        return ''
      }
      const candidatos = [saida.centroServicoId, saida.centroServico]
      for (const raw of candidatos) {
        if (!raw) {
          continue
        }
        const texto = raw.toString().trim()
        if (!texto) {
          continue
        }
        const label =
          centrosServicoMap.get(raw) ||
          centrosServicoMap.get(texto) ||
          centrosServicoMap.get(normalizeSearchValue(texto))
        if (label) {
          return label
        }
        if (!isLikelyUuid(texto)) {
          return texto
        }
      }
      return saida.centroServico || ''
    },
    [centrosServicoMap]
  )

  const centroCustoFilterOptions = useMemo(() => {
    const mapa = new Map()
    ;(saidas ?? []).forEach((saida) => {
      if (!saida) {
        return
      }
      const id = saida.centroCustoId || saida.centroCusto
      const nome = resolveCentroCustoLabel(saida)
      if (!id || !nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas, resolveCentroCustoLabel])

  const centroServicoFilterOptions = useMemo(() => {
    const mapa = new Map()
    ;(saidas ?? []).forEach((saida) => {
      if (!saida) {
        return
      }
      const id = saida.centroServicoId || saida.centroServico
      const nome = resolveCentroServicoLabel(saida)
      if (!id || !nome) {
        return
      }
      if (!mapa.has(id)) {
        mapa.set(id, { id, nome })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [saidas, resolveCentroServicoLabel])

  const fallbackPessoaSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      return Nomes.filter((pessoa) => pessoaMatchesTerm(pessoa, normalized)).slice(
        0,
        PESSOA_SEARCH_MAX_RESULTS,
      )
    },
    [Nomes],
  )

  const fallbackMaterialSearch = useCallback(
    (term) => {
      const normalized = normalizeSearchValue(term)
      if (!normalized) {
        return []
      }
      return materiais
        .filter((material) => materialMatchesTerm(material, normalized))
        .slice(0, MATERIAL_SEARCH_MAX_RESULTS)
    },
    [materiais],
  )

  useEffect(() => {
    if (!form.pessoaId) {
      return
    }
    const selecionada = NomesMap.get(form.pessoaId)
    if (selecionada) {
      setPessoaSearchValue(formatPessoaSummary(selecionada))
      setForm((prev) => ({
        ...prev,
        centroServico:
          selecionada.centroServico ??
          selecionada.setor ??
          selecionada.local ??
          prev.centroServico ??
          '',
        centroServicoId: selecionada.centroServicoId ?? prev.centroServicoId ?? '',
        centroCusto: selecionada.centroCusto ?? prev.centroCusto ?? '',
        centroCustoId: selecionada.centroCustoId ?? prev.centroCustoId ?? '',
      }))
    }
  }, [form.pessoaId, NomesMap])

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
        if (api?.pessoas?.search) {
          resultados = await api.pessoas.search({
            termo,
            limit: PESSOA_SEARCH_MAX_RESULTS,
          })
        } else if (api?.pessoas?.list) {
          resultados = await api.pessoas.list({ termo })
        } else {
          resultados = fallbackPessoaSearch(termo)
        }
        if (!Array.isArray(resultados)) {
          resultados = []
        }
        if (!cancelled) {
          setPessoaSuggestions((resultados ?? []).slice(0, PESSOA_SEARCH_MAX_RESULTS))
          setPessoaDropdownOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setPessoaSearchError(err.message || 'Falha ao buscar pessoas.')
          setPessoaSuggestions([])
          setPessoaDropdownOpen(true)
        }
      } finally {
        if (!cancelled) {
          setIsSearchingPessoas(false)
        }
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      if (pessoaSearchTimeoutRef.current) {
        clearTimeout(pessoaSearchTimeoutRef.current)
        pessoaSearchTimeoutRef.current = null
      }
    }
  }, [pessoaSearchValue, form.pessoaId, fallbackPessoaSearch])

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
        if (api?.entradas?.searchMateriais) {
          resultados = await api.entradas.searchMateriais({
            termo,
            limit: MATERIAL_SEARCH_MAX_RESULTS,
          })
        } else if (api?.materiais?.search) {
          resultados = await api.materiais.search({
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
      if (pessoaBlurTimeoutRef.current) {
        clearTimeout(pessoaBlurTimeoutRef.current)
      }
    }
  }, [])

  const selectedPessoa = form.pessoaId ? NomesMap.get(form.pessoaId) : null
  const selectedCentroCustoLabel =
    selectedPessoa?.centroCusto ||
    (form.centroCustoId ? centrosCustoMap.get(form.centroCustoId) : '') ||
    form.centroCusto ||
    ''
  const selectedCentroServicoLabel =
    selectedPessoa?.centroServico ||
    (form.centroServicoId ? centrosServicoMap.get(form.centroServicoId) : '') ||
    form.centroServico ||
    ''

  const normalizedSearchTerm = normalizeSearchValue(filters.termo)
  const startTimestamp = filters.dataInicio ? Date.parse(`${filters.dataInicio}T00:00:00Z`) : null
  const endTimestamp = filters.dataFim ? Date.parse(`${filters.dataFim}T23:59:59Z`) : null

  const filteredSaidas = useMemo(() => {
    return saidas.filter((saida) => {
      const dataEntrega = saida.dataEntrega ? Date.parse(saida.dataEntrega) : null
      if (startTimestamp && (dataEntrega === null || dataEntrega < startTimestamp)) {
        return false
      }
      if (endTimestamp && (dataEntrega === null || dataEntrega > endTimestamp)) {
        return false
      }
      if (filters.status) {
        const statusAtual = (saida.status || '').trim()
        if (statusAtual !== filters.status) {
          return false
        }
      }
      if (filters.registradoPor) {
        const candidatos = [
          saida.usuarioResponsavelId,
          saida.usuarioResponsavel,
          saida.usuarioResponsavelNome,
        ]
          .map((valor) => (valor ? String(valor).trim() : ''))
        if (!candidatos.includes(filters.registradoPor)) {
          return false
        }
      }
      if (filters.centroCusto) {
        const saidaId = (saida.centroCustoId || '').toString().trim()
        if (!saidaId || saidaId !== filters.centroCusto) {
          return false
        }
      }
      if (filters.centroServico) {
        const saidaId = (saida.centroServicoId || '').toString().trim()
        if (!saidaId || saidaId !== filters.centroServico) {
          return false
        }
      }
      if (normalizedSearchTerm) {
        const pessoa = NomesMap.get(saida.pessoaId)
        const material = materiaisMap.get(saida.materialId)
        const campos = [
          pessoa?.nome,
          pessoa?.matricula,
          pessoa?.centroServico,
          pessoa?.setor,
          material ? formatMaterialSummary(material) : '',
          material?.descricao,
          saida.usuarioResponsavel,
          saida.usuarioResponsavelNome,
          saida.status,
          resolveCentroCustoLabel(saida),
          resolveCentroServicoLabel(saida),
        ]
        const inclui = campos
          .map((campo) => normalizeSearchValue(campo))
          .some((campo) => campo.includes(normalizedSearchTerm))
        if (!inclui) {
          return false
        }
      }
      return true
    })
  }, [
    saidas,
    filters.status,
    filters.registradoPor,
    filters.centroCusto,
    filters.centroServico,
    normalizedSearchTerm,
    startTimestamp,
    endTimestamp,
    NomesMap,
    materiaisMap,
    resolveCentroCustoLabel,
    resolveCentroServicoLabel,
    centrosCustoMap,
    centrosServicoMap,
  ])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredSaidas.length / TABLE_PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [filteredSaidas.length])

  const paginatedSaidas = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE
    return filteredSaidas.slice(startIndex, startIndex + TABLE_PAGE_SIZE)
  }, [filteredSaidas, currentPage])

  const shouldShowPessoaDropdown =
    pessoaDropdownOpen &&
    !form.pessoaId &&
    (isSearchingPessoas || pessoaSearchError || pessoaSuggestions.length > 0)

  const shouldShowMaterialDropdown =
    materialDropdownOpen &&
    !form.materialId &&
    (isSearchingMaterials || materialSearchError || materialSuggestions.length > 0)

  return (
    <div className="stack">
      <PageHeader
        icon={<ExitIcon size={28} />}
        title="Saidas"
        subtitle="Controle entregas de EPIs garantindo disponibilidade e rastreabilidade."
      />

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field field--autocomplete">
            <span>Nome*</span>
            <div className="autocomplete">
              <input
                type="text"
                className="autocomplete__input"
                value={pessoaSearchValue}
                onChange={handlePessoaInputChange}
                onFocus={handlePessoaFocus}
                onBlur={handlePessoaBlur}
                placeholder="Busque por nome ou matricula"
                aria-autocomplete="list"
                aria-expanded={shouldShowPessoaDropdown}
                autoComplete="off"
                spellCheck="false"
              />
              <input type="hidden" name="pessoaId" value={form.pessoaId} readOnly />
              {form.pessoaId ? (
                <button
                  type="button"
                  className="autocomplete__clear"
                  onClick={handlePessoaClear}
                  aria-label="Limpar pessoa selecionada"
                >
                  x
                </button>
              ) : null}
              {shouldShowPessoaDropdown ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingPessoas ? (
                    <p className="autocomplete__feedback">Buscando pessoas...</p>
                  ) : null}
                  {!isSearchingPessoas && pessoaSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{pessoaSearchError}</p>
                  ) : null}
                  {!isSearchingPessoas && !pessoaSearchError && pessoaSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhuma pessoa encontrada.</p>
                  ) : null}
                  {pessoaSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handlePessoaSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatPessoaSummary(item)}</span>
                      <span className="autocomplete__secondary">
                        {formatPessoaDetail(item)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field field--autocomplete">
            <span>Material*</span>
            <div className="autocomplete">
              <input
                type="text"
                className="autocomplete__input"
                value={materialSearchValue}
                onChange={handleMaterialInputChange}
                onFocus={handleMaterialFocus}
                onBlur={handleMaterialBlur}
                placeholder="Busque por nome, grupo ou fabricante"
                aria-autocomplete="list"
                aria-expanded={shouldShowMaterialDropdown}
                autoComplete="off"
                spellCheck="false"
              />
              <input type="hidden" name="materialId" value={form.materialId} readOnly />
              {form.materialId ? (
                <button
                  type="button"
                  className="autocomplete__clear"
                  onClick={handleMaterialClear}
                  aria-label="Limpar material selecionado"
                >
                  x
                </button>
              ) : null}
              {shouldShowMaterialDropdown ? (
                <div className="autocomplete__dropdown" role="listbox">
                  {isSearchingMaterials ? (
                    <p className="autocomplete__feedback">Buscando materiais...</p>
                  ) : null}
                  {!isSearchingMaterials && materialSearchError ? (
                    <p className="autocomplete__feedback autocomplete__feedback--error">{materialSearchError}</p>
                  ) : null}
                  {!isSearchingMaterials && !materialSearchError && materialSuggestions.length === 0 ? (
                    <p className="autocomplete__feedback">Nenhum material encontrado.</p>
                  ) : null}
                  {materialSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="autocomplete__item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleMaterialSelect(item)}
                    >
                      <span className="autocomplete__primary">{formatMaterialSummary(item)}</span>
                      <span className="autocomplete__secondary">ID: {item.nomeId || item.id}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field">
            <span>Quantidade*</span>
            <input type="number" min="1" name="quantidade" value={form.quantidade} onChange={handleChange} required />
          </label>
        <label className="field">
          <span>Centro de custo*</span>
          <>
            <input
              name="centroCusto"
              value={selectedCentroCustoLabel}
              readOnly
              placeholder="Selecionado automaticamente"
            />
            <input type="hidden" name="centroCustoId" value={form.centroCustoId} />
          </>
        </label>
        <label className="field">
          <span>Centro de servico*</span>
          <>
            <input
              name="centroServico"
              value={selectedCentroServicoLabel}
              readOnly
              placeholder="Selecionado automaticamente"
            />
            <input type="hidden" name="centroServicoId" value={form.centroServicoId} />
          </>
        </label>
        <label className="field">
          <span>Data de entrega*</span>
          <input type="date" name="dataEntrega" value={form.dataEntrega} onChange={handleChange} required />
        </label>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar saida'}
          </button>
        </div>
      </form>

      <form className="form form--inline" onSubmit={handleFilterSubmit}>
        <label className="field">
          <span>Buscar</span>
          <input
            name="termo"
            value={filters.termo}
            onChange={handleFilterChange}
            placeholder="Pessoa, material ou responsável"
          />
        </label>
        <label className="field">
          <span>Registrado por</span>
          <select name="registradoPor" value={filters.registradoPor} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {registradoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Centro de custo</span>
          <select name="centroCusto" value={filters.centroCusto} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {centroCustoFilterOptions.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Centro de serviço</span>
          <select name="centroServico" value={filters.centroServico} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {centroServicoFilterOptions.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Data inicial</span>
          <input type="date" name="dataInicio" value={filters.dataInicio} onChange={handleFilterChange} />
        </label>
        <label className="field">
          <span>Data final</span>
          <input type="date" name="dataFim" value={filters.dataFim} onChange={handleFilterChange} />
        </label>
        <div className="form__actions">
          <button type="submit" className="button button--ghost">Aplicar</button>
          <button type="button" className="button button--ghost" onClick={handleFilterClear}>Limpar</button>
        </div>
      </form>

      <section className="card">
        <header className="card__header">
          <h2>Historico de saidas</h2>
          <button type="button" className="button button--ghost" onClick={() => load(filters)} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading && filteredSaidas.length === 0 ? (
          <p className="feedback">Nenhuma saida registrada.</p>
        ) : null}
        {filteredSaidas.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Nome</th>
                  <th>Quantidade</th>
                  <th>Centro de custo</th>
                  <th>Centro de servico</th>
                  <th>Status</th>
                  <th>Data entrega</th>
                  <th>Data troca</th>
                  <th>Valor total</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSaidas.map((saida) => {
                  const Nome = NomesMap.get(saida.pessoaId)
                  const material = materiaisMap.get(saida.materialId)
                  const total = (material?.valorUnitario ?? 0) * Number(saida.quantidade ?? 0)
                  const centroCustoLabel = resolveCentroCustoLabel(saida) || '-'
                  const centroServicoLabel = resolveCentroServicoLabel(saida) || '-'
                  const materialResumo = material ? formatMaterialSummary(material) : 'Material removido'
                  const materialIdLabel = material?.id || saida.materialId || 'Nao informado'
                  const pessoaCargo = Nome?.cargo || 'Cargo nao informado'
                  const registradoPor = saida.usuarioResponsavelNome || saida.usuarioResponsavel || 'Nao informado'

                  return (
                    <tr key={saida.id}>
                      <td>
                        <strong>{materialResumo}</strong>
                        <p className="data-table__muted">ID: {materialIdLabel}</p>
                      </td>
                      <td>
                        <strong>{Nome?.nome || 'Nome removida'}</strong>
                        <p className="data-table__muted">{pessoaCargo}</p>
                      </td>
                      <td>{saida.quantidade}</td>
                      <td>{centroCustoLabel}</td>
                      <td>{centroServicoLabel}</td>
                      <td>{saida.status || '-'}</td>
                      <td>{formatDisplayDateTime(saida.dataEntrega)}</td>
                      <td>
                        {saida.dataTroca ? formatDisplayDateTime(saida.dataTroca) : 'Nao informado'}
                      </td>
                      <td>{formatCurrency(total)}</td>
                      <td>{registradoPor}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <TablePagination
          totalItems={filteredSaidas.length}
          pageSize={TABLE_PAGE_SIZE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  )
}

























